import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte uma string de moeda (ex: "1.234,56") para centavos de forma segura, evitando erros de ponto flutuante.
 * Esta versão é mais robusta e lida com prefixos (R$), espaços e múltiplos separadores.
 * @returns {number} O valor em centavos como um inteiro, ou NaN se a entrada for inválida.
 */
export function currencyStringToCents(value: string | number): number {
  if (typeof value === 'number') {
    // Arredonda para garantir que estamos trabalhando com 2 casas decimais
    return Math.round(value * 100);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return NaN;
  }

  // 1. Limpa a string, mantendo apenas dígitos, sinal de menos, e o último separador decimal.
  // Remove prefixos (R$), espaços e todos os separadores de milhar (pontos).
  // Substitui a última vírgula por um ponto para o parseFloat.
  const cleanedValue = value.trim().replace(/R\$\s*/, '');

  // Verifica se há vírgula como separador decimal
  const lastCommaIndex = cleanedValue.lastIndexOf(',');
  const lastDotIndex = cleanedValue.lastIndexOf('.');

  let sanitizedValue = cleanedValue.replace(/\./g, ''); // Remove todos os pontos
  if (lastCommaIndex > lastDotIndex) {
    sanitizedValue = sanitizedValue.replace(',', '.'); // Substitui a vírgula decimal por ponto
  }

  // 2. Converte para número e valida.
  const numericValue = parseFloat(sanitizedValue.replace(/[^0-9.-]/g, ''));
  if (isNaN(numericValue)) {
    return NaN;
  }

  // 3. Converte para centavos e arredonda para evitar erros de ponto flutuante.
  return Math.round(numericValue * 100);
}
