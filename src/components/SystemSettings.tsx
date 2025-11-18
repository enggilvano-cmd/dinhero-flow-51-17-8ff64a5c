import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

export default function SystemSettings() {
  const [trialDays, setTrialDays] = useState<string>('7');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'trial_period_days')
        .single();

      if (error) {
        logger.error('Error fetching settings:', error);
        toast({
          title: t('systemSettings.loadError'),
          description: t('systemSettings.loadErrorDescription'),
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setTrialDays(data.setting_value);
      }
    } catch (error) {
      logger.error('Error fetching settings:', error);
      toast({
        title: t('systemSettings.loadError'),
        description: t('systemSettings.unexpectedLoadError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async () => {
    if (!trialDays || parseInt(trialDays) < 1) {
      toast({
        title: t('systemSettings.invalidValue'),
        description: t('systemSettings.invalidValueDescription'),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: trialDays,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'trial_period_days');

      if (error) {
        logger.error('Error updating setting:', error);
        toast({
          title: t('common.error'),
          description: t('systemSettings.errors.saveSetting'),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t('common.success'),
        description: t('systemSettings.success.settingSaved', { days: trialDays }),
      });
    } catch (error) {
      logger.error('Error updating setting:', error);
      toast({
        title: t('common.error'),
        description: t('systemSettings.errors.unexpectedSave'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{t('systemSettings.title')}</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            {t('systemSettings.subtitle')}
          </p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          {t('systemSettings.restrictedArea')}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('systemSettings.trialPeriod')}
          </CardTitle>
          <CardDescription>
            {t('systemSettings.trialPeriodDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trial-days">{t('systemSettings.trialDays')}</Label>
            <Input
              id="trial-days"
              type="number"
              min="1"
              max="365"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              placeholder="7"
            />
            <p className="text-sm text-muted-foreground">
              {t('systemSettings.trialDaysDescription')}
            </p>
          </div>

          <Button 
            onClick={updateSetting} 
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? t('common.saving') : t('systemSettings.saveSettings')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}