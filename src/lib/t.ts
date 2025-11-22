/**
 * Função de tradução simplificada - retorna a própria chave
 * Usada temporariamente para manter compatibilidade
 */
export function t(key: string, params?: Record<string, any>): string {
  // Simplesmente retorna a chave sem tradução
  let text = key;
  
  // Replace parameters like {{count}}, {{name}}, etc.
  if (params) {
    Object.keys(params).forEach(paramKey => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      text = text.replace(regex, String(params[paramKey]));
    });
  }
  
  return text;
}
