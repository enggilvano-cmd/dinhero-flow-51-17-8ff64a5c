import { useTranslation } from 'react-i18next';
import i18nInstance from './index';

// Hook seguro para traduções: se t() retornar a chave, tenta buscar diretamente
// do bundle atual e do fallback (pt-BR)
export const useT = () => {
  // Usamos useTranslation apenas para reagir às mudanças de idioma/renders
  const { i18n } = useTranslation();

  const deepGet = (obj: any, path: string) =>
    path.split('.').reduce((o: any, p: string) => (o && typeof o === 'object' ? o[p] : undefined), obj);

  const t = (key: string, options?: any): string => {
    // Preferimos sempre a instância única do i18n para resolver as chaves
    const lang = i18n.language || i18nInstance.language || 'pt-BR';
    const fixedT = i18nInstance.getFixedT(lang, 'translation');

    let result = fixedT(key as any, options);

    if (typeof result === 'string' && result === key) {
      // 1) Tenta bundle do idioma atual (deep)
      try {
        const bundle = i18nInstance.getResourceBundle(lang, 'translation');
        const fromBundle = deepGet(bundle, key);
        if (typeof fromBundle === 'string') return fromBundle;
      } catch {}

      // 2) Fallback direto via getResource
      const fromLang = i18nInstance.getResource(lang, 'translation', key);
      if (typeof fromLang === 'string') return fromLang as string;

      // 3) Fallback pt-BR (deep)
      try {
        const fbBundle = i18nInstance.getResourceBundle('pt-BR', 'translation');
        const fromFbBundle = deepGet(fbBundle, key);
        if (typeof fromFbBundle === 'string') return fromFbBundle;
      } catch {}

      // 4) Fallback pt-BR direto
      const fromFallback = i18nInstance.getResource('pt-BR', 'translation', key);
      if (typeof fromFallback === 'string') return fromFallback as string;
    }

    return result as string;
  };

  return { t, i18n: i18nInstance } as const;
};
