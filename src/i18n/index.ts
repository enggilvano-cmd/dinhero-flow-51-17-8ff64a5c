import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import esES from './locales/es-ES.json';

// Detectar idioma do navegador
export const detectBrowserLanguage = (): string => {
  if (typeof window === 'undefined') return 'pt-BR';
  
  const browserLang = navigator.language || (navigator as any).userLanguage;
  
  // Normalizar formato (ex: 'en-US', 'pt-BR', 'es-ES')
  const normalized = browserLang.replace('_', '-');
  
  // Mapear variações para idiomas suportados
  if (normalized.startsWith('pt')) return 'pt-BR';
  if (normalized.startsWith('es')) return 'es-ES';
  if (normalized.startsWith('en')) return 'en-US';
  
  return 'pt-BR'; // fallback
};

const savedLanguage = localStorage.getItem('i18nextLng');
const defaultLanguage = savedLanguage || detectBrowserLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'pt-BR': { translation: ptBR },
      'es-ES': { translation: esES },
    },
    lng: defaultLanguage,
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
