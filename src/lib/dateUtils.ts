import { addMonths, format } from "date-fns";
import { Account, AppTransaction } from "@/types";
import { logger } from "@/lib/logger";

/**
 * Helper para criar uma data de fallback (1970) quando o parse falha.
 */
function createFallbackDate(invalidInput?: any): Date {
  logger.warn(
    "createDateFromString não conseguiu parsear:",
    invalidInput,
    ". Usando data de fallback (1970)."
  );
  return new Date(0); // Retorna "1 Jan 1970"
}

/**
 * Calcula o mês de fatura (YYYY-MM) baseado na DATA DA COMPRA e DIA DE FECHAMENTO.
 * 
 * Regra: O mês da fatura é o mês de VENCIMENTO, não de fechamento.
 *        Normalmente a fatura vence alguns dias APÓS o fechamento.
 * 
 * Exemplo: Fechamento dia 30, Vencimento dia 10
 * - Compra em 12/11 → Fecha em 30/11 → Vence em 10/12 → Mês da fatura = "2025-12" (dezembro)
 * - Compra em 05/12 → Fecha em 30/12 → Vence em 10/01 → Mês da fatura = "2026-01" (janeiro)
 */
export function calculateInvoiceMonthByDue(
  transactionDate: Date,
  closingDate: number,
  dueDate: number = 10 // Dia de vencimento padrão
): string {
  // Normaliza a data da transação para UTC meio-dia
  const txDate = new Date(Date.UTC(
    transactionDate.getUTCFullYear(),
    transactionDate.getUTCMonth(),
    transactionDate.getUTCDate(),
    12, 0, 0
  ));

  const txDay = txDate.getUTCDate();
  const txMonth = txDate.getUTCMonth();
  const txYear = txDate.getUTCFullYear();

  // Determina o mês de FECHAMENTO da fatura
  let closingMonth: number;
  let closingYear: number;

  if (txDay <= closingDate) {
    // Compra ANTES ou NO dia do fechamento → fecha no mês corrente
    closingMonth = txMonth;
    closingYear = txYear;
  } else {
    // Compra DEPOIS do fechamento → fecha no próximo mês
    closingMonth = txMonth + 1;
    closingYear = txYear;
    
    // Ajusta ano se necessário
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear++;
    }
  }

  // Calcula o mês de VENCIMENTO (que é o "mês da fatura")
  // Se vencimento <= fechamento, vence no mês seguinte ao fechamento
  // Se vencimento > fechamento, vence no mesmo mês do fechamento
  let invoiceMonth: number;
  let invoiceYear: number;

  if (dueDate <= closingDate) {
    // Vence no mês seguinte ao fechamento
    invoiceMonth = closingMonth + 1;
    invoiceYear = closingYear;
    
    if (invoiceMonth > 11) {
      invoiceMonth = 0;
      invoiceYear++;
    }
  } else {
    // Vence no mesmo mês do fechamento (caso raro)
    invoiceMonth = closingMonth;
    invoiceYear = closingYear;
  }

  const result = `${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}`;
  
  console.info(`[calculateInvoiceMonthByDue] Compra ${format(txDate, 'dd/MM/yyyy')} | Fecha ${closingDate}/${closingMonth+1} | Vence ${dueDate}/${invoiceMonth+1} → Fatura ${result}`);

  return result;
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

  // Trata Date object diretamente
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
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
 * Normalize transaction date to Date object
 * Use this helper to ensure consistent date handling across the app
 */
export function normalizeTransactionDate<T extends { date: string | Date }>(
  transaction: T
): T & { date: Date } {
  return {
    ...transaction,
    date: createDateFromString(transaction.date)
  };
}

/**
 * Normalize array of transactions dates
 * Convenience function for bulk normalization
 */
export function normalizeTransactionDates<T extends { date: string | Date }>(
  transactions: T[]
): Array<T & { date: Date }> {
  return transactions.map(normalizeTransactionDate);
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
  let currentBillEnd = new Date(
    Date.UTC(
      todayNormalized.getUTCFullYear(),
      todayNormalized.getUTCMonth(),
      closingDate, 12, 0, 0
    )
  );

  if (todayNormalized.getUTCDate() > closingDate) {
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

  for (const t of transactions) {
    const tDate = t.date; // t.date agora é um Objeto Date
    
    if (!tDate || isNaN(tDate.getTime())) {
      logger.warn('Transação com data inválida:', t.id, t.description);
      continue; // Pula datas inválidas
    }

    // 1. Calcula o Saldo Total (Limite Utilizado)
    // Soma despesas (aumenta dívida) e subtrai pagamentos (diminui dívida)
    // APENAS transações concluídas são contabilizadas
    if (t.status === 'completed') {
      if (t.type === 'expense') {
        newTotalBalance += Math.abs(t.amount);
      } else if (t.type === 'income') {
        newTotalBalance -= Math.abs(t.amount); // Subtrai pagamentos
      }
    }

    // 2. Calcula o Saldo da Fatura Atual (currentBillAmount)
    // Se o usuário marcou override manual, usa o invoice_month salvo; caso contrário calcula
    const effectiveInvoiceMonth = (t as any).invoice_month_overridden && t.invoice_month
      ? t.invoice_month
      : (account.closing_date
          ? calculateInvoiceMonthByDue(tDate, account.closing_date, account.due_date || 1)
          : format(tDate, "yyyy-MM"));

    const belongsToCurrentBill = effectiveInvoiceMonth === currentInvoiceMonth;

    if (belongsToCurrentBill) {
      // APENAS transações concluídas são contabilizadas na fatura
      if (t.status === 'completed') {
        if (t.type === 'expense') {
          currentBillAmount += Math.abs(t.amount);
        } else if (t.type === 'income') {
          currentBillAmount -= Math.abs(t.amount);
          paymentTransactions.push(t);
        }
      }
    }
    // 3. Calcula a Próxima Fatura (nextBillAmount)
    else {
      const belongsToNextBill = effectiveInvoiceMonth === nextInvoiceMonth;
      // APENAS transações concluídas são contabilizadas na próxima fatura
      if (belongsToNextBill && t.type === 'expense' && t.status === 'completed') {
        nextBillAmount += Math.abs(t.amount);
      }
    }
  }

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
    currentInvoiceMonth, // <-- ADICIONADO: mês (YYYY-MM) da fatura atual
    nextInvoiceMonth,    // <-- ADICIONADO: mês (YYYY-MM) da próxima fatura
  };
}