import { addMonths, format, parse } from "date-fns";
import { Account, Transaction } from "@/types"; // Importa os tipos

/**
 * Retorna a data de hoje como uma string no formato "YYYY-MM-DD".
 */
export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Adiciona um número de meses a uma data.
 * @param date - O objeto Date inicial.
 * @param months - O número de meses a adicionar.
 * @returns Um novo objeto Date.
 */
export function addMonthsToDate(date: Date, months: number): Date {
  return addMonths(date, months);
}

/**
 * Cria um objeto Date a partir de uma string YYYY-MM-DD,
 * garantindo que não haja problemas de fuso horário (UTC).
 * Isso trata a data como "meio-dia" para evitar bugs de "um dia antes".
 * @param dateString - A data no formato "YYYY-MM-DD".
 * @returns Um objeto Date.
 */
export function createDateFromString(dateString: string): Date {
  // Se a string já tiver informação de hora/fuso, apenas parseia
  if (dateString.includes("T") || dateString.includes("Z")) {
    return new Date(dateString);
  }
  
  // Se for apenas YYYY-MM-DD, parseia como UTC para evitar fuso
  // "2025-10-01" -> "2025-10-01T12:00:00.000Z"
  // Isso garante que .getDate() retorne '1' e não '30' (do mês anterior)
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (year && month && day) {
      // Cria a data em UTC
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  } catch (e) {
    console.error("Falha ao parsear data, usando fallback:", dateString, e);
  }
  
  // Fallback para o parser nativo se o formato falhar
  return new Date(dateString);
}


// --- NOVO CONTEÚDO ADICIONADO ABAIXO ---

/**
 * Calcula os valores da fatura atual e da próxima fatura
 * com base nas transações e datas do cartão.
 */
export function calculateBillDetails(
  transactions: Transaction[], 
  account: Account
) {
  const today = new Date();
  const closingDate = account.closing_date || 1; // Dia do fechamento
  const dueDate = account.due_date || 1;       // Dia do vencimento

  // Garante que a data de hoje use o mesmo fuso (meio-dia UTC)
  const todayNormalized = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0));

  // Determina o período da fatura atual
  let currentBillStart = new Date(Date.UTC(todayNormalized.getUTCFullYear(), todayNormalized.getUTCMonth() - 1, closingDate + 1, 12, 0, 0));
  let currentBillEnd = new Date(Date.UTC(todayNormalized.getUTCFullYear(), todayNormalized.getUTCMonth(), closingDate, 12, 0, 0));

  // Se a data de hoje já passou o fechamento deste mês,
  // a "Fatura Atual" (a que está para fechar ou acabou de fechar) é a que termina no próximo mês.
  if (todayNormalized.getUTCDate() > closingDate) {
    currentBillStart = new Date(Date.UTC(todayNormalized.getUTCFullYear(), todayNormalized.getUTCMonth(), closingDate + 1, 12, 0, 0));
    currentBillEnd = new Date(Date.UTC(todayNormalized.getUTCFullYear(), todayNormalized.getUTCMonth() + 1, closingDate, 12, 0, 0));
  }

  // A "Próxima Fatura" começa um dia depois do fim da atual
  const nextBillStart = new Date(currentBillEnd.getTime() + (24 * 60 * 60 * 1000));
  const nextBillEnd = new Date(Date.UTC(currentBillStart.getUTCFullYear(), currentBillStart.getUTCMonth() + 1, closingDate, 12, 0, 0));

  let currentBillAmount = 0;
  let nextBillAmount = 0;

  for (const t of transactions) {
    // O store já garante que t.date é um objeto Date
    const tDate = t.date; 

    // Ignora transações de pagamento (tipo 'income' no cartão)
    if (t.type === 'income') continue;

    // Verifica se a transação pertence à fatura atual
    if (tDate >= currentBillStart && tDate <= currentBillEnd) {
      currentBillAmount += t.amount;
    }
    // Verifica se a transação pertence à próxima fatura
    else if (tDate >= nextBillStart && tDate <= nextBillEnd) {
      nextBillAmount += t.amount;
    }
  }

  // O Saldo Total (account.balance) deve ser a dívida total
  const totalBalance = Math.abs(account.balance);
  const availableLimit = (account.limit_amount || 0) - totalBalance;

  return {
    currentBillAmount, // Valor da fatura "aberta" ou "fechada"
    nextBillAmount,    // Valor da "próxima" fatura (parcial)
    totalBalance,      // Dívida total no cartão
    availableLimit,    // Limite disponível
  };
}