/**
 * Função temporária de tradução - DEPRECATED
 * Mantida temporariamente para compatibilidade durante a migração
 * TODO: Remover após migração completa
 */
export function t(key: string, _params?: Record<string, any>): string {
  // Retorna texto padrão genérico durante a migração
  return key;
}

/**
 * Hook temporário de tradução
 */
export function useT() {
  return { t };
}
