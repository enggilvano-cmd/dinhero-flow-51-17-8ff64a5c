import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { User, Shield, Key, Activity, ShieldCheck, ShieldOff } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  created_at: string;
}

export function UserProfile() {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [recentActivities, setRecentActivities] = useState<AuditLog[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showDisableMfaDialog, setShowDisableMfaDialog] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: profile?.email || '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || '',
      });
      fetchRecentActivities();
      checkMfaStatus();
    }
  }, [profile]);

  const fetchRecentActivities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const hasMfa = data?.totp && data.totp.length > 0;
      setMfaEnabled(hasMfa);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleDisableMfa = async () => {
    setLoading(true);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) {
        throw new Error(t('profile.mfaNotFound'));
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;

      setMfaEnabled(false);
      setShowDisableMfaDialog(false);
      
      toast({
        title: t('profile.mfaDisabled'),
        description: t('profile.mfaDisabledDescription'),
      });
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast({
        title: t('common.error'),
        description: t('profile.mfaDisableError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const emailChanged = formData.email !== profile.email;

      // If email changed, request Auth email update with redirect for confirmation
      if (emailChanged) {
        const { error: authError } = await supabase.auth.updateUser(
          { email: formData.email },
          { emailRedirectTo: `${window.location.origin}/auth` }
        );
        if (authError) throw authError;

      toast({
        title: t('profile.verificationRequired'),
        description: t('profile.verificationRequiredDescription'),
      });
      }

      // Update profile data (do NOT change profiles.email until confirmation)
      const updates: any = {
        full_name: formData.fullName,
      };
      if (!emailChanged) {
        updates.email = formData.email;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', profile.user_id);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_user_activity', {
        p_user_id: profile.user_id,
        p_action: 'profile_updated',
        p_resource_type: 'profile',
        p_resource_id: profile.user_id
      });

      toast({
        title: t('common.success'),
        description: emailChanged
          ? t('profile.nameUpdatedEmailPending')
          : t('profile.profileUpdated'),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description: t('profile.profileUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!user?.email) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) throw error;

      toast({
        title: t('profile.emailSent'),
        description: t('profile.emailSentDescription'),
      });
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast({
        title: t('common.error'),
        description: t('profile.resetEmailError'),
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'user': return 'default';
      case 'limited': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return t('profile.roleAdmin');
      case 'user': return t('profile.roleLifetime');
      case 'trial': return t('profile.roleTrial');
      case 'limited': return t('profile.roleLimited');
      default: return role;
    }
  };

  if (!profile) {
    return (
      <Card className="financial-card">
        <CardContent className="pt-6">
          <div className="text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">{t('profile.loadingProfile')}</h3>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold leading-tight">{t('profile.title')}</h2>
        <p className="text-sm text-muted-foreground leading-tight">
          {t('profile.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="financial-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('profile.personalInfo')}
              </CardTitle>
              <CardDescription>
                {t('profile.personalInfoDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{profile.full_name || t('profile.noName')}</h3>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <Badge 
                    variant={getRoleBadgeVariant(profile.role)}
                    className="mt-1"
                  >
                    {getRoleLabel(profile.role)}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('profile.fullName')}</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      fullName: e.target.value
                    }))}
                    placeholder={t('profile.fullNamePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email: e.target.value
                    }))}
                    placeholder={t('profile.emailPlaceholder')}
                  />
                </div>

                <Button 
                  onClick={updateProfile}
                  disabled={loading}
                  className="w-fit"
                >
                  {loading ? t('common.saving') : t('profile.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t('profile.security')}
              </CardTitle>
              <CardDescription>
                {t('profile.securityDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Alterar Senha</h4>
                  <p className="text-sm text-muted-foreground">
                    Enviar email para redefinir senha
                  </p>
                </div>
                <Button variant="outline" onClick={changePassword}>
                  Redefinir Senha
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Autenticação de Dois Fatores</h4>
                    {mfaEnabled ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldOff className="h-3 w-3" />
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {mfaEnabled 
                      ? 'Sua conta está protegida com 2FA'
                      : 'Adicione uma camada extra de segurança'
                    }
                  </p>
                </div>
                {mfaEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDisableMfaDialog(true)}
                  >
                    {t('profile.disable')}
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={() => setShowMfaSetup(true)}
                  >
                    {t('profile.enable2FA')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="financial-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('profile.accountStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('common.status')}</span>
                <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                  {profile.is_active ? t('profile.active') : t('profile.inactive')}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('profile.role')}</span>
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('profile.memberSince')}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('profile.recentActivity')}
              </CardTitle>
              <CardDescription>
                {t('profile.recentActivityDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">
                          {activity.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.resource_type}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('profile.noRecentActivity')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">{t('profile.dangerZone')}</CardTitle>
              <CardDescription>
                {t('profile.dangerZoneDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={signOut}
              >
                {t('profile.signOut')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para configurar 2FA */}
      <AlertDialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
        <AlertDialogContent className="max-w-2xl">
          <TwoFactorSetup 
            onComplete={() => {
              setShowMfaSetup(false);
              checkMfaStatus();
            }}
          />
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para desativar 2FA */}
      <AlertDialog open={showDisableMfaDialog} onOpenChange={setShowDisableMfaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Autenticação em Dois Fatores?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso tornará sua conta menos segura. Você não precisará mais de um código do app autenticador para fazer login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMfa}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Desativando...' : 'Desativar 2FA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}