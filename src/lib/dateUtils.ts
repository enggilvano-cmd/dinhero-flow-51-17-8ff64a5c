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
 */
export function calculateBillDetails(
  transactions: AppTransaction[], // Aceita AppTransaction (com datas corretas)
  account: Account
) {
  const today = new Date();
  const closingDate = account.closing_date || 1; 

  const todayNormalized = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
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

  // --- INÍCIO DA CORREÇÃO DO BUG ---
  let currentBillAmount = 0;
  let nextBillAmount = 0;
  let newTotalBalance = 0; // 1. Começa a calcular o saldo do zero

  for (const t of transactions) {
    const tDate = t.date; // t.date agora é um Objeto Date
    
    if (!tDate || isNaN(tDate.getTime())) continue; // Pula datas inválidas

    // 2. Calcula o Saldo Total (Limite Utilizado) manualmente
    // Isso ignora o `account.balance` antigo (stale)
    if (t.type === 'expense') {
      newTotalBalance += t.amount;
    } else if (t.type === 'income') {
      newTotalBalance -= t.amount; // Subtrai pagamentos
    }

    // 3. Para o cálculo da "Fatura Atual", ignoramos os pagamentos
    if (t.type === 'income') continue;

    // 4. Encontra a fatura correta
    if (tDate >= currentBillStart && tDate <= currentBillEnd) {
      currentBillAmount += t.amount;
    }
    else if (tDate >= nextBillStart && tDate <= nextBillEnd) {
      nextBillAmount += t.amount;
    }
  }

  // 5. Usa os novos valores calculados
  const totalBalance = newTotalBalance; // <-- Correto (ex: R$ 200,00)
  const availableLimit = (account.limit_amount || 0) - totalBalance; // <-- Correto (ex: R$ 1.800,00)
  // --- FIM DA CORREÇÃO ---

  return {
    currentBillAmount, // Fatura Atual (ex: R$ 200,00)
    nextBillAmount,    // Próxima Fatura
    totalBalance,      // Limite Utilizado (ex: R$ 200,00)
    availableLimit,    // Limite Disponível (ex: R$ 1.800,00)
  };
}