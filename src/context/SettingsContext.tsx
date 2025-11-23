import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  currency: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoBackup: boolean;
  language: string;
  userId: string;
}

async function getSettings(): Promise<AppSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .select('currency, theme, notifications, auto_backup, language, created_at, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error) {
    logger.error('Error loading settings:', error);
    throw error;
  }

  return {
    currency: data.currency,
    theme: data.theme as 'light' | 'dark' | 'system',
    notifications: data.notifications,
    autoBackup: data.auto_backup,
    language: data.language,
    userId: user.id
  };
}

async function saveSettingsToDb(settings: AppSettings): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('user_settings')
    .update({
      currency: settings.currency,
      theme: settings.theme,
      notifications: settings.notifications,
      auto_backup: settings.autoBackup,
      language: settings.language,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  if (error) {
    logger.error('Error updating settings:', error);
    throw error;
  }
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  formatCurrency: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // Durante o desenvolvimento, pode haver hot reload que causa esse erro temporariamente
    logger.warn('useSettings called outside SettingsProvider, returning defaults');
    return {
      settings: {
        currency: 'BRL',
        theme: 'system' as const,
        notifications: true,
        autoBackup: false,
        language: 'pt-BR',
        userId: ''
      },
      updateSettings: () => Promise.resolve(),
      formatCurrency: (amount: number) => `R$ ${amount.toFixed(2).replace('.', ',')}`
    };
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const auth = useAuth();
  
  // Se o auth ainda não está pronto, use valores seguros
  const user = auth?.user;
  const loading = auth?.loading ?? true;
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Try to load from localStorage first for immediate theme application
    try {
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        logger.debug('Loaded settings from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      logger.error('Error loading settings from localStorage:', error);
    }
    
    return {
      currency: 'BRL',
      theme: 'system',
      notifications: true,
      autoBackup: false,
      language: 'pt-BR',
      userId: ''
    };
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
    
    logger.debug('Applied theme:', theme);
  };

  // Apply theme from initial state (localStorage or default)
  useEffect(() => {
    applyTheme(settings.theme);
  }, []);

  // Load full settings when user is authenticated
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || loading) {
        logger.debug('Skipping settings load - user or auth loading', { user: !!user, loading });
        return;
      }
      
      try {
        logger.debug('Loading settings from database for user:', user.id);
        // Always load settings from Supabase (source of truth)
        const loadedSettings = await getSettings();
        
        logger.debug('Settings loaded successfully:', loadedSettings);
        setSettings(loadedSettings);
        
        // Save to localStorage for next page load
        localStorage.setItem('userSettings', JSON.stringify(loadedSettings));
        
        applyTheme(loadedSettings.theme);
      } catch (error) {
        logger.error('Error loading settings:', error);
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
    logger.debug('Updating settings:', newSettings);
    setSettings(newSettings);
    
    // Save to localStorage immediately
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
    
    applyTheme(newSettings.theme);
    
    // Save to Supabase if user is authenticated
    if (user) {
      try {
        await saveSettingsToDb(newSettings);
        logger.debug('Settings saved to database successfully');
      } catch (error) {
        logger.error('Error saving settings to database:', error);
      }
    } else {
      logger.warn('Cannot save settings - user not authenticated');
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