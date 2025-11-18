import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Settings, 
  Download, 
  Upload,
  Trash2,
  Bell,
  Database,
  FileText,
  Shield,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { AppSettings, exportData, importData } from "@/lib/supabase-storage";
import { recalculateInvoiceMonthsForUser } from "@/lib/fixes/recalculateInvoiceMonths";
import { useTranslation } from 'react-i18next';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClearAllData: () => void;
}

export function SettingsPage({ settings, onUpdateSettings, onClearAllData }: SettingsPageProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isImporting, setIsImporting] = useState(false);
  const [clearDataConfirmation, setClearDataConfirmation] = useState("");
  const [isFixing, setIsFixing] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Sync local settings when props change
  useEffect(() => {
    logger.debug('Settings props updated:', settings);
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = () => {
    try {
      // Validate settings before saving
      if (!localSettings.currency || !localSettings.language || !localSettings.theme) {
      toast({
        title: t('settings.invalidSettings'),
        description: t('settings.invalidSettingsDescription'),
        variant: "destructive"
      });
        return;
      }

      onUpdateSettings(localSettings);
      toast({
        title: t('settings.settingsSaved'),
        description: t('settings.settingsSavedDescription'),
      });
    } catch (error) {
      logger.error('Settings save error:', error);
      toast({
        title: t('common.error'),
        description: t('settings.errorSaving'),
        variant: "destructive"
      });
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportData();
      
      // Validate data before export
      if (!data || Object.keys(data).length === 0) {
        toast({
          title: t('settings.noDataToExport'),
          description: t('settings.noDataToExportDescription'),
          variant: "destructive"
        });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const dateStr = timestamp[0];
      const timeStr = timestamp[1].split('.')[0];
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json;charset=utf-8' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `planiflow-backup-${dateStr}-${timeStr}.json`;
      
      // Ensure the link is added to the DOM for Firefox compatibility
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast({
        title: t('settings.backupCreated'),
        description: t('settings.backupCreatedDescription', { filename: `planiflow-backup-${dateStr}-${timeStr}.json` }),
      });
    } catch (error) {
      logger.error('Export error:', error);
      toast({
        title: t('settings.backupError'),
        description: t('settings.backupErrorDescription'),
        variant: "destructive"
      });
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      toast({
        title: t('settings.invalidFile'),
        description: t('settings.invalidFileDescription'),
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('settings.fileTooLarge'),
        description: t('settings.fileTooLargeDescription'),
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        if (!jsonString || jsonString.trim() === '') {
          throw new Error(t('settings.emptyFile'));
        }

        const data = JSON.parse(jsonString);
        
        // Validate data structure
        if (!data || typeof data !== 'object') {
          throw new Error(t('settings.invalidDataStructure'));
        }

        // Optional: Validate required fields
        if (data.accounts && !Array.isArray(data.accounts)) {
          throw new Error(t('settings.invalidAccountsFormat'));
        }
        if (data.transactions && !Array.isArray(data.transactions)) {
          throw new Error(t('settings.invalidTransactionsFormat'));
        }

        const result = await importData(data);
        
        if (result.success) {
          toast({
            title: t('settings.dataImported'),
            description: result.message,
          });
          // Reload the page to reflect changes
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast({
            title: t('settings.importError'),
            description: result.message,
            variant: "destructive"
          });
        }
      } catch (error) {
        logger.error('Import error:', error);
        toast({
          title: t('settings.importError'),
          description: error instanceof Error ? error.message : t('settings.invalidOrCorruptedFile'),
          variant: "destructive"
        });
      } finally {
        setIsImporting(false);
        // Clear the input to allow re-import of the same file
        if (event.target) {
          event.target.value = '';
        }
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      toast({
        title: t('settings.readError'),
        description: t('settings.readErrorDescription'),
        variant: "destructive"
      });
    };
    
    reader.readAsText(file);
  };

  const handleRecalculateInvoiceMonths = async () => {
    if (!window.confirm(
      t('settings.recalculateConfirm')
    )) {
      return;
    }
    setIsFixing(true);
    try {
      const res = await recalculateInvoiceMonthsForUser();
      toast({
        title: t('settings.fixComplete'),
        description: t('settings.fixCompleteDescription', { 
          scanned: res.scanned, 
          eligible: res.eligible, 
          updated: res.updated 
        }),
      });
    } catch (error) {
      logger.error('Fix error:', error);
      toast({
        title: t('settings.fixError'),
        description: t('settings.fixErrorDescription'),
        variant: "destructive"
      });
    } finally {
      setIsFixing(false);
    }
  };

  const handleClearData = () => {
    if (window.confirm(
      t('settings.clearDataConfirm')
    )) {
      onClearAllData();
      toast({
        title: t('settings.dataCleared'),
        description: t('settings.dataClearedDescription'),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8 fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground leading-tight">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* General Settings */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('settings.general')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">{t('settings.currency')}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t('settings.currencyDescription')}
              </p>
              <Select 
                value={localSettings.currency} 
                onValueChange={(value) => setLocalSettings(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">🇧🇷 Real Brasileiro (R$)</SelectItem>
                  <SelectItem value="USD">🇺🇸 Dólar Americano ($)</SelectItem>
                  <SelectItem value="EUR">🇪🇺 Euro (€)</SelectItem>
                  <SelectItem value="GBP">🇬🇧 Libra Esterlina (£)</SelectItem>
                  <SelectItem value="JPY">🇯🇵 Iene Japonês (¥)</SelectItem>
                  <SelectItem value="ARS">🇦🇷 Peso Argentino ($)</SelectItem>
                  <SelectItem value="MXN">🇲🇽 Peso Mexicano ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{t('settings.language')}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t('settings.languageDescription')}
              </p>
              <Select 
                value={localSettings.language} 
                onValueChange={(value) => setLocalSettings(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                  <SelectItem value="es-ES">🇪🇸 Español (España)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">{t('settings.theme')}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t('settings.themeDescription')}
              </p>
              <Select 
                value={localSettings.theme} 
                onValueChange={(value: any) => setLocalSettings(prev => ({ ...prev, theme: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                  <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveSettings} className="w-full">
              {t('settings.saveSettings')}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Notificações do Sistema</Label>
                <p className="text-sm text-muted-foreground">
                  Receber lembretes e alertas importantes
                </p>
              </div>
              <Switch
                checked={localSettings.notifications}
                onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, notifications: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Backup Automático</Label>
                <p className="text-sm text-muted-foreground">
                  Backup automático dos dados localmente
                </p>
              </div>
              <Switch
                checked={localSettings.autoBackup}
                onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, autoBackup: checked }))}
              />
            </div>

          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Gerenciamento de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <h4 className="font-medium">Backup e Restauração</h4>
              <div className="grid grid-cols-1 gap-3">
                <Button onClick={handleExportData} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Dados (Backup)
                </Button>
                
                <div className="relative">
                  <Button 
                    variant="outline" 
                    className="gap-2 w-full" 
                    disabled={isImporting}
                    asChild
                  >
                    <label className={`cursor-pointer ${isImporting ? 'opacity-50' : ''}`}>
                      <Upload className="h-4 w-4" />
                      {isImporting ? "Importando..." : "Importar Dados"}
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportData}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isImporting}
                        aria-label="Selecionar arquivo de backup para importar"
                      />
                    </label>
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Selecione um arquivo JSON de backup válido (máx. 10MB)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Correções de Faturas</h4>
              <p className="text-sm text-muted-foreground">
                Recalcula o mês de fatura (invoice_month) das parcelas de cartões com base em fechamento e vencimento.
              </p>
              <Button onClick={handleRecalculateInvoiceMonths} className="gap-2 w-full" disabled={isFixing} variant="outline">
                <RefreshCw className={`h-4 w-4 ${isFixing ? 'animate-spin' : ''}`} />
                {isFixing ? 'Recalculando...' : 'Recalcular invoice_month'}
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium text-destructive">Zona de Perigo</h4>
              <p className="text-sm text-muted-foreground">
                Para apagar todos os dados, digite "APAGAR TUDO" no campo abaixo e clique no botão.
              </p>
              <Input
                type="text"
                value={clearDataConfirmation}
                onChange={(e) => setClearDataConfirmation(e.target.value)}
                placeholder='Digite "APAGAR TUDO"'
                className="border-destructive"
              />
              <Button 
                onClick={handleClearData} 
                variant="destructive" 
                className="gap-2 w-full"
                disabled={clearDataConfirmation !== "APAGAR TUDO"}
              >
                <Trash2 className="h-4 w-4" />
                Apagar Todos os Dados Permanentemente
              </Button>
              <p className="text-sm text-muted-foreground">
                Esta ação irá remover permanentemente todas as suas contas, transações e configurações.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sobre o Aplicativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-medium">PlaniFlow</h4>
              <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm">
                Aplicativo completo para gestão financeira pessoal, desenvolvido para 
                ajudar você a controlar suas finanças de forma simples e eficiente.
              </p>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Funcionalidades:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Gestão de contas bancárias e cartões</li>
                  <li>• Controle de receitas e despesas</li>
                  <li>• Transferências entre contas</li>
                  <li>• Relatórios e análises detalhadas</li>
                  <li>• Backup e restauração de dados</li>
                  <li>• Interface responsiva para todos os dispositivos</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Privacidade</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Todos os seus dados são armazenados no Supabase com segurança e criptografia. 
                Você pode acessar seus dados de qualquer dispositivo com sua conta.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}