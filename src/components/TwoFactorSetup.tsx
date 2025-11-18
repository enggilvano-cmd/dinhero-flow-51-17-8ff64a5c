import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Shield, QrCode, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

interface TwoFactorSetupProps {
  onComplete: () => void;
}

export function TwoFactorSetup({ onComplete }: TwoFactorSetupProps) {
  const { t } = useTranslation();
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'enroll' | 'verify'>('enroll');

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: t('twoFactor.authenticator')
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('verify');
      }
    } catch (error: any) {
      logger.error('Erro ao iniciar 2FA:', error);
      toast({
        title: t('twoFactor.setup.errors.setupFailed'),
        description: error.message || t('twoFactor.setup.errors.setupFailedDescription'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast({
        title: t('twoFactor.verify.errors.invalidCode'),
        description: t('twoFactor.verify.errors.invalidCodeDescription'),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp[0];
      if (!totpFactor) throw new Error(t('twoFactor.setup.errors.totpNotFound'));

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verifyCode
      });

      if (error) throw error;

      toast({
        title: t('twoFactor.setup.success.title'),
        description: t('twoFactor.setup.success.description')
      });

      onComplete();
    } catch (error: any) {
      logger.error('Erro ao verificar código:', error);
      toast({
        title: t('twoFactor.verify.errors.invalidCode'),
        description: t('twoFactor.verify.errors.verifyFailed'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'enroll') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('twoFactor.setup.title')}
          </CardTitle>
          <CardDescription>
            {t('twoFactor.setup.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('twoFactor.setup.appRequired')}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('twoFactor.setup.description')}
            </p>

            <Button 
              onClick={handleEnroll} 
              disabled={loading}
              className="w-full"
            >
              {loading ? t('twoFactor.setup.configuring') : t('twoFactor.setup.startConfiguration')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {t('twoFactor.setup.scanQrCode')}
        </CardTitle>
        <CardDescription>
          {t('twoFactor.setup.useAuthApp')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-muted rounded-lg">
            {qrCode ? (
              <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-background rounded">
                <p className="text-sm text-muted-foreground">{t('twoFactor.setup.generatingQrCode')}</p>
              </div>
            )}
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-medium">{t('twoFactor.setup.cantScan')}</p>
              <p className="text-xs break-all">{t('twoFactor.setup.manualCode')} <code className="bg-muted px-1 py-0.5 rounded">{secret}</code></p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('twoFactor.verify.verificationCode')}</label>
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-lg tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              {t('twoFactor.setup.enterCode')}
            </p>
          </div>

          <Button 
            onClick={handleVerify} 
            disabled={loading || verifyCode.length !== 6}
            className="w-full"
          >
            {loading ? t('twoFactor.verify.verifying') : t('twoFactor.setup.verifyAndActivate')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
