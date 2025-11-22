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
import { logger } from '@/lib/logger';
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
      logger.error('Error fetching activities:', error);
    }
  };

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const hasMfa = data?.totp && data.totp.length > 0;
      setMfaEnabled(hasMfa);
    } catch (error) {
      logger.error('Error checking MFA status:', error);
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
      logger.error('Error disabling MFA:', error);
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
      logger.error('Error updating profile:', error);
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
      logger.error('Error sending reset email:', error);
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
      case 'user': return t('profile.roleUser');
      case 'lifetime': return t('profile.roleLifetime');
      case 'trial': return t('profile.roleTrial');
      case 'limited': return t('profile.roleLimited');
      default: return role;
    }
  };

  const getActivityLabel = (action: string) => {
    const formattedAction = action.replace(/_/g, ' ');
    const defaultValue = formattedAction.charAt(0).toUpperCase() + formattedAction.slice(1);
    return t(`profile.activity.${action}`, { defaultValue: defaultValue });
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
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{t('profile.title')}</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('profile.subtitle')}
        </p>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Main Content Area - Full width on mobile, 2/3 on desktop */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {/* Personal Info Card */}
          <Card className="financial-card">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profile.personalInfo')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('profile.personalInfoDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-lg sm:text-xl">
                    {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-base sm:text-lg">{profile.full_name || t('profile.noName')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-all">{profile.email}</p>
                  <Badge 
                    variant={getRoleBadgeVariant(profile.role)}
                    className="mt-1.5 text-xs"
                  >
                    {getRoleLabel(profile.role)}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">{t('profile.fullName')}</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      fullName: e.target.value
                    }))}
                    placeholder={t('profile.fullNamePlaceholder')}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email: e.target.value
                    }))}
                    placeholder={t('profile.emailPlaceholder')}
                    className="text-sm"
                  />
                </div>

                <Button 
                  onClick={updateProfile}
                  disabled={loading}
                  className="w-full sm:w-fit"
                >
                  {loading ? t('common.saving') : t('profile.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="financial-card">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Key className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profile.security')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('profile.securityDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Change Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">{t('profile.changePassword')}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('profile.changePasswordDescription')}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={changePassword}
                  className="w-full sm:w-auto text-sm shrink-0"
                >
                  {t('profile.resetPassword')}
                </Button>
              </div>

              {/* 2FA Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium text-sm sm:text-base">{t('profile.twoFactorAuth')}</h4>
                    {mfaEnabled ? (
                      <Badge variant="default" className="gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        {t('profile.enabled')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <ShieldOff className="h-3 w-3" />
                        {t('profile.disabled')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {mfaEnabled 
                      ? t('profile.mfaProtected')
                      : t('profile.mfaAddLayer')
                    }
                  </p>
                </div>
                {mfaEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDisableMfaDialog(true)}
                    className="w-full sm:w-auto text-sm shrink-0"
                  >
                    {t('profile.disable')}
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={() => setShowMfaSetup(true)}
                    className="w-full sm:w-auto text-sm shrink-0"
                  >
                    {t('profile.enable2FA')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Full width on mobile, 1/3 on desktop */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-1">
          {/* Account Status Card */}
          <Card className="financial-card">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profile.accountStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs sm:text-sm font-medium">{t('transactions.status')}</span>
                <Badge variant={profile.is_active ? 'default' : 'secondary'} className="text-xs">
                  {profile.is_active ? t('profile.active') : t('profile.inactive')}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs sm:text-sm font-medium">{t('profile.role')}</span>
                <Badge variant={getRoleBadgeVariant(profile.role)} className="text-xs">
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs sm:text-sm font-medium">{t('profile.memberSince')}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card className="financial-card">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profile.recentActivity')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('profile.recentActivityDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivities.length > 0 ? (
                  <div className="space-y-1">
                    {recentActivities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {getActivityLabel(activity.action)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.resource_type}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {new Date(activity.created_at).toLocaleDateString('pt-BR', { 
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                    {t('profile.noRecentActivity')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="financial-card border-destructive/50">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-destructive">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('profile.dangerZone')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('profile.dangerZoneDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                className="w-full text-sm"
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
            <AlertDialogTitle>{t('profile.disableMfaTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.disableMfaDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMfa}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? t('profile.disablingMfa') : t('profile.disableMfa')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}