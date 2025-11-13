import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

// Versão dos arquivos de tradução - incremente quando atualizar traduções
const TRANSLATION_VERSION = '1.0.10';
const VERSION_KEY = 'i18n_version';

/**
 * Verifica se a versão das traduções mudou e força reload se necessário
 */
const checkTranslationVersion = (): void => {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion && storedVersion !== TRANSLATION_VERSION) {
    console.log(`🔄 Nova versão de tradução detectada: ${storedVersion} -> ${TRANSLATION_VERSION}`);
    console.log('🔄 Limpando cache e recarregando...');
    
    // Limpar cache do navegador
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Limpar localStorage de traduções
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('i18next_res_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Atualizar versão armazenada
    localStorage.setItem(VERSION_KEY, TRANSLATION_VERSION);
    
    // Forçar reload da página com hard refresh
    window.location.href = window.location.href;
  } else if (!storedVersion) {
    // Primeira vez - apenas armazenar a versão
    localStorage.setItem(VERSION_KEY, TRANSLATION_VERSION);
    console.log(`✅ Versão de tradução inicializada: ${TRANSLATION_VERSION}`);
  }
};

// Verificar versão antes de inicializar o i18n
checkTranslationVersion();

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
};

/**
 * Detecta o idioma preferido do navegador e mapeia para um dos idiomas suportados
 * @returns string - Código do idioma suportado (pt-BR, en-US, ou es-ES)
 */
export const detectBrowserLanguage = (): string => {
  const supportedLanguages = ['pt-BR', 'en-US', 'es-ES'];
  
  // Obter idiomas do navegador em ordem de preferência
  const browserLanguages = navigator.languages || [navigator.language];
  
  // Mapeamento de códigos de idioma para nossos códigos suportados
  const languageMap: Record<string, string> = {
    'pt': 'pt-BR',
    'pt-BR': 'pt-BR',
    'pt-PT': 'pt-BR',
    'en': 'en-US',
    'en-US': 'en-US',
    'en-GB': 'en-US',
    'en-AU': 'en-US',
    'en-CA': 'en-US',
    'es': 'es-ES',
    'es-ES': 'es-ES',
    'es-MX': 'es-ES',
    'es-AR': 'es-ES',
    'es-CO': 'es-ES',
  };
  
  // Tentar encontrar um idioma suportado
  for (const browserLang of browserLanguages) {
    // Tentar match exato
    if (supportedLanguages.includes(browserLang)) {
      console.log(`🌍 Idioma detectado (match exato): ${browserLang}`);
      return browserLang;
    }
    
    // Tentar match por código base (ex: 'en' -> 'en-US')
    const langCode = browserLang.split('-')[0];
    const mappedLang = languageMap[langCode];
    if (mappedLang && supportedLanguages.includes(mappedLang)) {
      console.log(`🌍 Idioma detectado (mapeado): ${browserLang} -> ${mappedLang}`);
      return mappedLang;
    }
    
    // Tentar match completo no mapa
    if (languageMap[browserLang]) {
      console.log(`🌍 Idioma detectado (mapa): ${browserLang} -> ${languageMap[browserLang]}`);
      return languageMap[browserLang];
    }
  }
  
  // Fallback para português (Brasil)
  console.log('🌍 Idioma não detectado, usando fallback: pt-BR');
  return 'pt-BR';
};

// Detectar idioma do navegador
const detectedLanguage = detectBrowserLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectedLanguage, // idioma detectado do navegador
    fallbackLng: 'pt-BR',
    defaultNS: 'translation',
    nsSeparator: ':',
    keySeparator: '.',
    initImmediate: false, // garantir init síncrono com recursos embutidos
    interpolation: {
      escapeValue: false, // React já faz escape
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
    returnEmptyString: false,
    debug: false,
  });

export default i18n;
