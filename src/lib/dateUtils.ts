import { addMonths, format } from "date-fns";
import { Account, Transaction } from "@/types";
import { AppTransaction } from "@/stores/TransactionStore"; // Importar AppTransaction

/**
 * Helper para criar uma data de fallback (1970) quando o parse falha.
 */
function createFallbackDate(invalidInput?: any): Date {
  console.warn(
    "createDateFromString não conseguiu parsear:",
    invalidInput,
    ". Usando data de fallback (1970)."
  );
  return new Date(0); // Retorna "1 Jan 1970"
}

/**
 * Retorna a data de hoje como uma string no formato "YYYY-MM-DD".
 */
export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Adiciona um número de meses a uma data.
 */
export function addMonthsToDate(date: Date, months: number): Date {
  return addMonths(date, months);
}

/**
 * Cria um objeto Date a partir de qualquer input (string, nulo, etc),
 * garantindo que não haja problemas de fuso horário (UTC) e NUNCA quebre.
 */
export function createDateFromString(dateInput: any): Date {
  const dateString = String(dateInput || "").trim();
  if (dateString === "") {
    return createFallbackDate(dateInput);
  }

  // Tenta ISO 8601
  if (dateString.includes("T") || dateString.includes("Z")) {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d;
  }

  // Tenta YYYY-MM-DD
  try {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [_, year, month, day] = match.map(Number);
      if (year && month && day) {
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        if (!isNaN(d.getTime())) return d;
      }
    }
  } catch (e) { /* ignora */ }

  // Fallback final
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) {
     return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
  }

  return createFallbackDate(dateInput);
}

/**
 * Calcula os valores da fatura atual e da próxima fatura
 * com base nas transações e datas do cartão.
 * @param monthOffset - Offset de meses (0 = atual, 1 = próximo, -1 = anterior)
 */
export function calculateBillDetails(
  transactions: AppTransaction[],
  account: Account,
  monthOffset: number = 0
) {
  // Retorna vazio se a conta não for de crédito
  if (!account.closing_date || !account.due_date) {
    return {
      currentBillAmount: 0,
      nextBillAmount: 0,
      totalBalance: 0,
      availableLimit: 0,
      paymentTransactions: [], // <-- ADICIONADO
    };
  }
  
  const today = new Date();
  const closingDate = account.closing_date || 1; 

  // Aplica o offset de meses à data de referência
  const referenceDate = addMonths(today, monthOffset);
  
  const todayNormalized = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      12, 0, 0
    )
  );

  // --- Lógica de data (sem alterações) ---
  let currentBillStart = new Date(
    Date.UTC(
      todayNormalized.getUTCFullYear(),
      todayNormalized.getUTCMonth() - 1,
      closingDate + 1, 12, 0, 0
    )
  );
  let currentBillEnd = new Date(
    Date.UTC(
      todayNormalized.getUTCFullYear(),
      todayNormalized.getUTCMonth(),
      closingDate, 12, 0, 0
    )
  );

  if (todayNormalized.getUTCDate() > closingDate) {
    currentBillStart = new Date(
      Date.UTC(
        todayNormalized.getUTCFullYear(),
        todayNormalized.getUTCMonth(),
        closingDate + 1, 12, 0, 0
      )
    );
    currentBillEnd = new Date(
      Date.UTC(
        todayNormalized.getUTCFullYear(),
        todayNormalized.getUTCMonth() + 1,
        closingDate, 12, 0, 0
      )
    );
  }

  const nextBillStart = new Date(currentBillEnd.getTime() + 24 * 60 * 60 * 1000);
  const nextBillEnd = new Date(
    Date.UTC(
      nextBillStart.getUTCFullYear(),
      nextBillStart.getUTCMonth() + 1,
      closingDate, 12, 0, 0
    )
  );

  // Calcula a data de vencimento para cada fatura
  const dueDate = account.due_date || 1;
  
  // Data de vencimento da fatura atual
  let currentDueDate = new Date(
    Date.UTC(
      currentBillEnd.getUTCFullYear(),
      currentBillEnd.getUTCMonth(),
      dueDate, 12, 0, 0
    )
  );
  
  // Se a data de vencimento for antes do fechamento, o vencimento é no mês seguinte
  if (dueDate <= closingDate) {
    currentDueDate = new Date(
      Date.UTC(
        currentBillEnd.getUTCFullYear(),
        currentBillEnd.getUTCMonth() + 1,
        dueDate, 12, 0, 0
      )
    );
  }
  
  // Data de vencimento da próxima fatura
  let nextDueDate = new Date(
    Date.UTC(
      nextBillEnd.getUTCFullYear(),
      nextBillEnd.getUTCMonth(),
      dueDate, 12, 0, 0
    )
  );
  
  // Se a data de vencimento for antes do fechamento, o vencimento é no mês seguinte
  if (dueDate <= closingDate) {
    nextDueDate = new Date(
      Date.UTC(
        nextBillEnd.getUTCFullYear(),
        nextBillEnd.getUTCMonth() + 1,
        dueDate, 12, 0, 0
      )
    );
  }

  // Calcula o mês da fatura baseado na data de VENCIMENTO no formato YYYY-MM
  const currentInvoiceMonth = format(currentDueDate, "yyyy-MM");
  const nextInvoiceMonth = format(nextDueDate, "yyyy-MM");

  // --- INÍCIO DA CORREÇÃO (Saldo Credor e Saldo Parcial) ---
  let currentBillAmount = 0;
  let nextBillAmount = 0;
  let newTotalBalance = 0; // Saldo devedor total (limite utilizado)
  const paymentTransactions: AppTransaction[] = []; // <-- ADICIONADO

  console.log('=== DEBUG calculateBillDetails ===');
  console.log('Account:', account.name);
  console.log('Current Invoice Month:', currentInvoiceMonth);
  console.log('Next Invoice Month:', nextInvoiceMonth);
  console.log('Current Bill Period:', currentBillStart, 'to', currentBillEnd);
  console.log('Next Bill Period:', nextBillStart, 'to', nextBillEnd);

  for (const t of transactions) {
    const tDate = t.date; // t.date agora é um Objeto Date
    
    if (!tDate || isNaN(tDate.getTime())) continue; // Pula datas inválidas

    // 1. Calcula o Saldo Total (Limite Utilizado)
    // Soma despesas (aumenta dívida) e subtrai pagamentos (diminui dívida)
    if (t.type === 'expense') {
      newTotalBalance += Math.abs(t.amount);
    } else if (t.type === 'income') {
      newTotalBalance -= Math.abs(t.amount); // Subtrai pagamentos
    }

    // 2. Calcula o Saldo da Fatura Atual (currentBillAmount)
    // Prioriza invoice_month, senão usa a data da transação
    const belongsToCurrentBill = t.invoice_month 
      ? t.invoice_month === currentInvoiceMonth
      : (tDate >= currentBillStart && tDate <= currentBillEnd);

    console.log(`Transaction: ${t.description}, invoice_month: ${t.invoice_month}, amount: ${t.amount}, belongsToCurrentBill: ${belongsToCurrentBill}`);

    if (belongsToCurrentBill) {
      if (t.type === 'expense') {
        // Usa Math.abs() porque o amount já vem negativo do banco
        currentBillAmount += Math.abs(t.amount);
        console.log(`  Added to current bill: ${Math.abs(t.amount)}, new total: ${currentBillAmount}`);
      } else if (t.type === 'income') {
        // CORREÇÃO: Subtrai o pagamento do valor da fatura atual.
        // Isso permite que currentBillAmount fique negativo (crédito).
        currentBillAmount -= Math.abs(t.amount);
        paymentTransactions.push(t); // <-- ADICIONADO
        console.log(`  Payment subtracted from current bill: ${Math.abs(t.amount)}, new total: ${currentBillAmount}`);
      }
    }
    // 3. Calcula a Próxima Fatura (nextBillAmount)
    // Prioriza invoice_month, senão usa a data da transação
    else {
      const belongsToNextBill = t.invoice_month
        ? t.invoice_month === nextInvoiceMonth
        : (tDate >= nextBillStart && tDate <= nextBillEnd);

      if (belongsToNextBill && t.type === 'expense') {
        // Usa Math.abs() porque o amount já vem negativo do banco
        nextBillAmount += Math.abs(t.amount);
        console.log(`  Added to next bill: ${Math.abs(t.amount)}, new total: ${nextBillAmount}`);
      }
    }
  }

  console.log('Final current bill amount:', currentBillAmount);
  console.log('Final next bill amount:', nextBillAmount);
  console.log('=== END DEBUG ===');

  // 4. Usa os novos valores calculados
  const totalBalance = newTotalBalance; // Saldo devedor total (correto)
  const availableLimit = (account.limit_amount || 0) - totalBalance; // Limite disponível (correto)
  // --- FIM DA CORREÇÃO ---

  return {
    currentBillAmount, // Agora pode ser negativo (crédito)
    nextBillAmount,    // Próxima Fatura (apenas despesas)
    totalBalance,      // Limite Utilizado (saldo devedor total)
    availableLimit,    // Limite Disponível
    paymentTransactions, // <-- ADICIONADO
  };
}