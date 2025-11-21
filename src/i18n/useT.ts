import { useTranslation } from 'react-i18next';

/**
 * Custom hook for type-safe translations
 * Wraps react-i18next's useTranslation hook
 */
export function useT() {
  const { t, i18n } = useTranslation();
  
  return {
    t,
    i18n,
    language: i18n.language,
    changeLanguage: (lng: string) => i18n.changeLanguage(lng),
  };
}

export default useT;
