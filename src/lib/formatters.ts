import { Account } from "@/types";

/**
 * Formata um valor numérico para uma string de moeda BRL.
 * @param value O valor (já em reais, não em centavos).
 * @returns A string formatada, ex: "R$ 1.234,56".
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula o saldo disponível de uma conta, considerando o saldo principal e o limite.
 * @param account O objeto da conta.
 * @returns O saldo disponível em centavos.
 */
export function getAvailableBalance(account: Account | undefined): number {
  if (!account) return 0;
  return account.balance + (account.limit_amount || 0);
}