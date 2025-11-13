import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, getSettings, updateSettings as saveSettings } from '@/lib/supabase-storage';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  formatCurrency: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>({
    currency: 'BRL',
    theme: 'system',
    notifications: true,
    autoBackup: false,
    language: 'pt-BR',
    userId: ''
  });

  // Apply theme immediately on mount and settings change
  const applyTheme = (theme: AppSettings['theme']) => {
    const root = window.document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  };

  // Apply system theme on mount (before authentication)
  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const root = window.document.documentElement;
    root.classList.add(systemTheme);
  }, []);

  // Load full settings when user is authenticated
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || loading) return;
      
      try {
        // Always load settings from Supabase (source of truth)
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);
        applyTheme(loadedSettings.theme);
        
        // Aplicar idioma ao i18n
        if (loadedSettings.language && i18n.language !== loadedSettings.language) {
          i18n.changeLanguage(loadedSettings.language);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Use default settings on error
        applyTheme('system');
      }
    };
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // Apply theme when settings change and listen for system changes
  useEffect(() => {
    applyTheme(settings.theme);

    // Listen for system theme changes when theme is set to 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [settings.theme]);

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    applyTheme(newSettings.theme);
    
    // Atualizar idioma do i18n apenas se mudou
    if (newSettings.language && i18n.language !== newSettings.language) {
      await i18n.changeLanguage(newSettings.language);
    }
    
    // Save to Supabase if user is authenticated
    if (user) {
      await saveSettings(newSettings);
    }
  };

  const formatCurrency = (amount: number): string => {
    const currencySymbols: Record<string, string> = {
      'BRL': 'R$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'ARS': '$',
      'MXN': '$'
    };

    const locales: Record<string, string> = {
      'BRL': 'pt-BR',
      'USD': 'en-US', 
      'EUR': 'de-DE',
      'GBP': 'en-GB',
      'JPY': 'ja-JP',
      'ARS': 'es-AR',
      'MXN': 'es-MX'
    };

    try {
      const locale = locales[settings.currency] || settings.language || 'pt-BR';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback if currency not supported
      const symbol = currencySymbols[settings.currency] || settings.currency;
      return `${symbol} ${amount.toFixed(2).replace('.', ',')}`;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}