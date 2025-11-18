import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

interface TwoFactorVerifyProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ onVerified, onCancel }: TwoFactorVerifyProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
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

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) {
        throw new Error(t('twoFactor.verify.errors.notConfigured'));
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: code
      });

      if (verify.error) throw verify.error;

      toast({
        title: t('twoFactor.verify.success.title'),
        description: t('twoFactor.verify.success.description')
      });

      onVerified();
    } catch (error: any) {
      logger.error('Erro ao verificar 2FA:', error);
      toast({
        title: t('twoFactor.verify.errors.invalidCode'),
        description: t('twoFactor.verify.errors.incorrectCode'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('twoFactor.verify.title')}
          </CardTitle>
          <CardDescription>
            {t('twoFactor.verify.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('twoFactor.verify.verificationCode')}</label>
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              className="text-center text-lg tracking-widest"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleVerify} 
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? t('twoFactor.verify.verifying') : t('twoFactor.verify.verify')}
            </Button>
            <Button 
              onClick={onCancel} 
              variant="outline"
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
