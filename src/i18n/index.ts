import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt-BR', // idioma padrão
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false, // React já faz escape
    },
  });

export default i18n;
