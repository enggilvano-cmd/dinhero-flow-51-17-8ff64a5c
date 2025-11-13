import { useTranslation } from 'react-i18next';
import i18nInstance from './index';

// Hook seguro para traduções: se t() retornar a chave, tenta buscar diretamente
// do bundle atual e do fallback (pt-BR)
export const useT = () => {
  const { t: baseT, i18n } = useTranslation();

  const t = (key: string, options?: any): string => {
    const result = baseT(key as any, options);
    if (typeof result === 'string' && result === key) {
      // tentar recuperar diretamente do bundle atual
      const lang = i18n.language || 'pt-BR';
      const fromLang = i18n.getResource(lang, 'translation', key);
      if (typeof fromLang === 'string') return fromLang;

      // tentar do fallback
      const fromFallback = i18n.getResource('pt-BR', 'translation', key);
      if (typeof fromFallback === 'string') return fromFallback;
    }
    return result as string;
  };

  return { t, i18n: i18nInstance } as const;
};
