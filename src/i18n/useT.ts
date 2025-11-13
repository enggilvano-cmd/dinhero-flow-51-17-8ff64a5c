import { useTranslation } from 'react-i18next';
import i18nInstance from './index';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

// Hook seguro para traduções: se t() retornar a chave, tenta buscar diretamente
// do bundle atual, do bundle importado estaticamente e do fallback (pt-BR)
export const useT = () => {
  // Usamos useTranslation apenas para reagir às mudanças de idioma/renders
  const { i18n } = useTranslation();

  const deepGet = (obj: any, path: string) =>
    path.split('.').reduce((o: any, p: string) => (o && typeof o === 'object' ? o[p] : undefined), obj);

  const normalizeLang = (l: string | undefined) => {
    if (!l) return 'pt-BR';
    const base = l.split('-')[0];
    if (l.startsWith('pt') || base === 'pt') return 'pt-BR';
    if (l.startsWith('en') || base === 'en') return 'en-US';
    if (l.startsWith('es') || base === 'es') return 'es-ES';
    return 'pt-BR';
  };

  const staticBundles: Record<string, any> = {
    'pt-BR': ptBR,
    'en-US': enUS,
    'es-ES': esES,
  };

  const t = (key: string, options?: any): string => {
    // Preferimos sempre a instância única do i18n para resolver as chaves
    const lang = normalizeLang(i18n.language || i18nInstance.language || 'pt-BR');
    const fixedT = i18nInstance.getFixedT(lang, 'translation');

    let result = fixedT(key as any, options);

    if (typeof result === 'string' && result === key) {
      // 1) Tenta bundle do idioma atual (deep) via i18nInstance
      try {
        const bundle = i18nInstance.getResourceBundle(lang, 'translation');
        const fromBundle = deepGet(bundle, key);
        if (typeof fromBundle === 'string') return fromBundle;
      } catch {}

      // 2) Fallback direto via getResource
      const fromLang = i18nInstance.getResource(lang, 'translation', key);
      if (typeof fromLang === 'string') return fromLang as string;

      // 3) Tenta bundles estáticos importados (garante que nunca dependa do cache do i18n)
      const staticFromLang = deepGet(staticBundles[lang], key);
      if (typeof staticFromLang === 'string') return staticFromLang;

      // 4) Fallback pt-BR (deep) via i18nInstance
      try {
        const fbBundle = i18nInstance.getResourceBundle('pt-BR', 'translation');
        const fromFbBundle = deepGet(fbBundle, key);
        if (typeof fromFbBundle === 'string') return fromFbBundle;
      } catch {}

      // 5) Fallback pt-BR direto
      const fromFallback = i18nInstance.getResource('pt-BR', 'translation', key);
      if (typeof fromFallback === 'string') return fromFallback as string;

      // 6) Fallback final com bundle estático pt-BR
      const staticFromFallback = deepGet(staticBundles['pt-BR'], key);
      if (typeof staticFromFallback === 'string') return staticFromFallback;
    }

    return result as string;
  };

  return { t, i18n: i18nInstance } as const;
};
