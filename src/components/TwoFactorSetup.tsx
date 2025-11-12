import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Shield, QrCode, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TwoFactorSetupProps {
  onComplete: () => void;
}

export function TwoFactorSetup({ onComplete }: TwoFactorSetupProps) {
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
        friendlyName: 'Autenticador'
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('verify');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar 2FA:', error);
      toast({
        title: 'Erro ao configurar 2FA',
        description: error.message || 'Não foi possível iniciar a configuração.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast({
        title: 'Código inválido',
        description: 'Digite um código de 6 dígitos.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp[0];
      if (!totpFactor) throw new Error('Fator TOTP não encontrado');

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verifyCode
      });

      if (error) throw error;

      toast({
        title: 'Autenticação em dois fatores ativada!',
        description: 'Sua conta agora está protegida com 2FA.'
      });

      onComplete();
    } catch (error: any) {
      console.error('Erro ao verificar código:', error);
      toast({
        title: 'Código inválido',
        description: 'Verifique o código e tente novamente.',
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
            Configurar Autenticação em Dois Fatores
          </CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você precisará de um app autenticador como Google Authenticator, Authy ou Microsoft Authenticator.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A autenticação em dois fatores (2FA) adiciona uma camada extra de segurança, exigindo um código do seu app autenticador além da sua senha.
            </p>

            <Button 
              onClick={handleEnroll} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Configurando...' : 'Iniciar Configuração'}
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
          Escaneie o QR Code
        </CardTitle>
        <CardDescription>
          Use seu app autenticador para escanear o código
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-muted rounded-lg">
            {qrCode ? (
              <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-background rounded">
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-medium">Não consegue escanear?</p>
              <p className="text-xs break-all">Digite este código manualmente: <code className="bg-muted px-1 py-0.5 rounded">{secret}</code></p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Código de Verificação</label>
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-lg tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              Digite o código de 6 dígitos do seu app autenticador
            </p>
          </div>

          <Button 
            onClick={handleVerify} 
            disabled={loading || verifyCode.length !== 6}
            className="w-full"
          >
            {loading ? 'Verificando...' : 'Verificar e Ativar 2FA'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
