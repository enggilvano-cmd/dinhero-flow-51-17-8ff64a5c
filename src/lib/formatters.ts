import { Account } from "@/types";

/**
 * Formata um valor numérico (em centavos) para uma string de moeda.
 * @param valueInCents O valor em centavos.
 * @param currency Código da moeda (padrão: 'BRL').
 * @param locale Locale para formatação (padrão: 'pt-BR').
 * @returns A string formatada, ex: "R$ 1.234,56".
 */
export function formatCurrency(
  valueInCents: number, 
  currency: string = 'BRL', 
  locale: string = 'pt-BR'
): string {
  const value = valueInCents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Calcula o saldo disponível de uma conta, considerando o saldo principal e o limite.
 * Para cartões de crédito: limite - dívida atual (balance é negativo quando há dívida)
 * Para outras contas: saldo + limite (overdraft)
 * @param account O objeto da conta.
 * @returns O saldo disponível em centavos.
 */
export function getAvailableBalance(account: Account | undefined): number {
  if (!account) return 0;
  
  if (account.type === 'credit') {
    // Cartão de crédito: saldo negativo = dívida
    // Disponível = limite - dívida
    const debt = Math.abs(Math.min(account.balance, 0));
    return (account.limit_amount || 0) - debt;
  }
  
  // Outras contas: saldo + limite (overdraft)
  return account.balance + (account.limit_amount || 0);
}

/**
 * Retorna a dívida de um cartão de crédito (sempre positivo).
 * @param account O objeto da conta.
 * @returns A dívida em centavos (positivo).
 */
export function getCreditCardDebt(account: Account | undefined): number {
  if (!account || account.type !== 'credit') return 0;
  // Se balance é negativo, retorna o valor absoluto (dívida)
  // Se balance é positivo, retorna 0 (tem crédito a favor)
  return Math.abs(Math.min(account.balance, 0));
}

/**
 * Verifica se o cartão tem crédito a favor do cliente.
 * @param account O objeto da conta.
 * @returns true se há crédito a favor (balance positivo).
 */
export function hasCreditInFavor(account: Account | undefined): boolean {
  if (!account || account.type !== 'credit') return false;
  return account.balance > 0;
}