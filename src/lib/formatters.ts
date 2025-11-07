/**
 * NOTA DO CONTADOR:
 * Este é o "tradutor" entre o formato do usuário (ex: "R$ 10,50")
 * e o formato do banco de dados (ex: 1050).
 */

// IMPORTAÇÃO ADICIONADA: A nova função precisa do tipo 'Account'
import { Account } from '@/types'

/**
 * Formata um valor inteiro em centavos para uma string de moeda BRL.
 * @param amountInCents O valor em centavos (ex: 1050)
 * @returns A string formatada (ex: "R$ 10,50")
 */
export const formatCurrency = (
  amountInCents: number | null | undefined
): string => {
  if (amountInCents === null || amountInCents === undefined) {
    amountInCents = 0
  }

  // Converte centavos (inteiro) para a unidade principal (decimal)
  const amount = amountInCents / 100

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Converte uma string de moeda formatada (ou um número) para um inteiro em centavos.
 * @param currencyInput A string (ex: "R$ 10,50" ou "10.50" ou "10,50")
 * @returns O valor em centavos (ex: 1050)
 */
export const parseCurrencyToCents = (
  currencyInput: string | number
): number => {
  if (typeof currencyInput === 'number') {
    // Assume que o número já é a unidade principal (ex: 10.50)
    return Math.round(currencyInput * 100)
  }

  if (typeof currencyInput !== 'string' || !currencyInput) {
    return 0
  }

  // 1. Remove tudo que não for dígito, vírgula ou sinal de menos
  let normalized = currencyInput.replace(/[^\d,-]/g, '')

  // 2. Substitui a vírgula decimal brasileira por ponto
  normalized = normalized.replace(',', '.')

  // 3. Remove pontos de milhar (se houver, ex: "1.000,50" virou "1.000.50")
  // Este regex remove o último ponto (decimal) e depois remove os de milhar
  const parts = normalized.split('.')
  let finalString = normalized
  if (parts.length > 1) {
    const integerPart = parts.slice(0, -1).join('')
    const decimalPart = parts[parts.length - 1]
    finalString = `${integerPart}.${decimalPart}`
  }

  // 4. Converte para float
  const floatValue = parseFloat(finalString)

  if (isNaN(floatValue)) {
    return 0
  }

  // 5. Multiplica por 100 e arredonda para obter os centavos inteiros
  return Math.round(floatValue * 100)
}

/**
 * FUNÇÃO ADICIONADA (ESTAVA FALTANDO)
 * Calcula o saldo disponível (saldo + limite) de uma conta.
 * @param account O objeto da conta
 * @returns O saldo disponível em centavos (ex: 10050)
 */
export const getAvailableBalance = (
  account: Account | null | undefined
): number => {
  if (!account) {
    return 0
  }

  // O limite (cheque especial) é um valor positivo que se soma ao saldo.
  const limit = account.limit_amount || 0

  // O saldo (balance) já está em centavos.
  return account.balance + limit
}