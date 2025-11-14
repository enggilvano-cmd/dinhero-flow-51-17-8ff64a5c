import { useState, useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, Activity, Trash2 } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'subscriber' | 'trial';
  is_active: boolean;
  trial_expires_at?: string;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

export function UserManagement() {
  const { t, i18n } = useT();
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'users' | 'audit'>('users');

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
      fetchAuditLogs();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data || []).map(user => ({
        ...user,
        full_name: user.full_name ?? undefined,
        avatar_url: user.avatar_url ?? undefined,
        whatsapp: user.whatsapp ?? undefined,
        trial_expires_at: user.trial_expires_at ?? undefined,
        subscription_expires_at: user.subscription_expires_at ?? undefined,
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: t('common.error'),
        description: t('userManagement.errors.loadUsers'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }
      setAuditLogs((data || []).map(log => ({
        ...log,
        user_id: log.user_id || '',
        resource_id: log.resource_id ?? undefined,
        profiles: undefined,
      })));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: t('common.error'),
        description: t('userManagement.errors.loadAuditLogs'),
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user' | 'subscriber' | 'trial') => {
    try {
      console.log('Updating user role:', { userId, newRole });
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error updating role:', error);
        throw error;
      }

      console.log('User role updated successfully');

      // Log the activity
      try {
        await supabase.rpc('log_user_activity', {
          p_user_id: profile?.user_id || '',
          p_action: 'user_role_updated',
          p_resource_type: 'profile',
          p_resource_id: userId,
          p_new_values: { role: newRole }
        });
        console.log('Activity logged successfully');
      } catch (logError) {
        console.error('Error logging activity:', logError);
      }

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: t('common.success'),
        description: t('userManagement.success.roleUpdated'),
      });
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: t('common.error'),
        description: t('userManagement.errors.updateRole', { message: error?.message || t('userManagement.errors.unknown') }),
        variant: 'destructive',
      });
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_user_activity', {
        p_user_id: profile?.user_id || '',
        p_action: isActive ? 'user_activated' : 'user_deactivated',
        p_resource_type: 'profile',
        p_resource_id: userId
      });

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, is_active: isActive } : user
      ));

      toast({
        title: t('common.success'),
        description: t(isActive ? 'userManagement.success.userActivated' : 'userManagement.success.userDeactivated'),
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: t('common.error'),
        description: t('userManagement.errors.updateStatus'),
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      console.log('Deleting user:', userId);
      
      // Call edge function to delete user (will also delete from auth.users)
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `https://sdberrkfwoozezletfuq.supabase.co/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Error from edge function:', result);
        throw new Error(result.error || 'Failed to delete user');
      }

      console.log('User deleted successfully:', result);

      setUsers(prev => prev.filter(user => user.user_id !== userId));

      toast({
        title: t('common.success'),
        description: t('userManagement.success.userDeleted'),
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('userManagement.errors.deleteUser'),
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'user': return 'default';
      case 'subscriber': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('userManagement.roles.admin');
      case 'user':
        return t('userManagement.roles.user');
      case 'trial':
        return t('userManagement.roles.trial');
      case 'subscriber':
        return t('userManagement.roles.subscriber');
      default:
        return role;
    }
  };

  const getActionLabel = (action: string) => {
    const actionKey = `userManagement.auditLog.actions.${action}`;
    const translated = t(actionKey);
    // Se a tradução retornar a chave, usar fallback com formatação
    return translated !== actionKey ? translated : action.replace(/_/g, ' ');
  };

  const getResourceTypeLabel = (resourceType: string) => {
    const resourceKey = `userManagement.auditLog.resourceTypes.${resourceType}`;
    const translated = t(resourceKey);
    // Se a tradução retornar a chave, usar o valor original
    return translated !== resourceKey ? translated : resourceType;
  };

  const setSubscriptionDays = async (userId: string, days: number) => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_expires_at: expiresAt.toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.rpc('log_user_activity', {
        p_user_id: profile?.user_id || '',
        p_action: 'subscription_updated',
        p_resource_type: 'profile',
        p_resource_id: userId,
      });

      toast({
        title: t('common.success'),
        description: t('userManagement.success.subscriptionSet', { days }),
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin()) {
    return (
      <Card className="financial-card">
        <CardContent className="pt-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">{t('userManagement.restrictedAccess')}</h3>
            <p className="text-muted-foreground">
              {t('userManagement.restrictedAccessDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header Section */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{t('userManagement.title')}</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('userManagement.subtitle')}
        </p>
      </div>

      {/* Users Tab */}
      {selectedTab === 'users' && (
        <Card className="financial-card">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('userManagement.usersCard.title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('userManagement.usersCard.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm pl-3 sm:pl-4">{t('userManagement.table.user')}</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">{t('userManagement.table.role')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('userManagement.table.status')}</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">{t('userManagement.table.created')}</TableHead>
                        <TableHead className="text-xs sm:text-sm pr-3 sm:pr-4">{t('userManagement.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell className="py-3 sm:py-4 pl-3 sm:pl-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback className="text-xs sm:text-sm">
                                  {user.full_name?.charAt(0) || user.email.charAt(0)}
                                </AvatarFallback>
                              </Avatar>  
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium truncate">
                                  {user.full_name || t('userManagement.noName')}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.email}
                                </p>
                                {/* Show role badge on mobile (hidden on desktop where it has its own column) */}
                                <div className="mt-1 sm:hidden">
                                  <Badge 
                                    variant={getRoleBadgeVariant(user.role)}
                                    className="text-xs"
                                  >
                                    {getRoleLabel(user.role)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-3 sm:py-4">
                            <div className="flex flex-col gap-2">
                              <Select
                                value={user.role}
                                onValueChange={(value: 'admin' | 'user' | 'subscriber') => 
                                  updateUserRole(user.user_id, value)
                                }
                                disabled={user.user_id === profile?.user_id}
                              >
                                <SelectTrigger className="w-full sm:w-40 text-xs sm:text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">{t('userManagement.roles.admin')}</SelectItem>
                                  <SelectItem value="trial">{t('userManagement.roles.trial')}</SelectItem>
                                  <SelectItem value="user">{t('userManagement.roles.user')}</SelectItem>
                                  <SelectItem value="subscriber">{t('userManagement.roles.subscriber')}</SelectItem>
                                </SelectContent>
                              </Select>
                              {user.role === 'subscriber' && (
                                <div className="flex gap-2 items-center flex-wrap">
                                  <input
                                    type="number"
                                    placeholder={t('userManagement.daysPlaceholder')}
                                    className="w-16 px-2 py-1 text-xs border rounded"
                                    id={`days-${user.user_id}`}
                                  />
                                  <Button
                                    size="sm"
                                    className="text-xs h-6 px-2"
                                    onClick={() => {
                                      const input = document.getElementById(`days-${user.user_id}`) as HTMLInputElement;
                                      const days = parseInt(input.value);
                                      if (days > 0) {
                                        setSubscriptionDays(user.user_id, days);
                                      }
                                    }}
                                  >
                                    {t('common.ok')}
                                  </Button>
                                  {user.subscription_expires_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {t('userManagement.expiresAt')}: {new Date(user.subscription_expires_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 sm:py-4">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Switch
                                checked={user.is_active}
                                onCheckedChange={(checked) => 
                                  toggleUserStatus(user.user_id, checked)
                                }
                                disabled={user.user_id === profile?.user_id}
                                className="scale-90 sm:scale-100"
                              />
                              <Badge 
                                variant={user.is_active ? 'default' : 'secondary'}
                                className="text-xs hidden lg:inline-flex"
                              >
                                {user.is_active ? t('userManagement.status.active') : t('userManagement.status.inactive')}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-3 sm:py-4 text-xs sm:text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="py-3 sm:py-4 pr-3 sm:pr-4">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={user.user_id === profile?.user_id}
                                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-sm sm:text-base">
                                    {t('userManagement.confirmDelete.title')}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs sm:text-sm">
                                    {t('userManagement.confirmDelete.description', { email: user.email })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                  <AlertDialogCancel className="text-xs sm:text-sm m-0">
                                    {t('common.cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(user.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm m-0"
                                  >
                                    {t('common.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Log Tab */}
      {selectedTab === 'audit' && (
        <Card className="financial-card">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('userManagement.auditLog.title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('userManagement.auditLog.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm pl-3 sm:pl-4">{t('userManagement.auditLog.columns.user')}</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">{t('userManagement.auditLog.columns.action')}</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">{t('userManagement.auditLog.columns.resource')}</TableHead>
                      <TableHead className="text-xs sm:text-sm pr-3 sm:pr-4">{t('userManagement.auditLog.columns.dateTime')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="py-3 sm:py-4 pl-3 sm:pl-4">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {log.profiles?.full_name || log.profiles?.email || t('userManagement.auditLog.system')}
                            </p>
                            {/* Show action on mobile */}
                            <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                              {getActionLabel(log.action)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-3 sm:py-4">
                          <Badge variant="outline" className="text-xs">
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-3 sm:py-4 text-xs sm:text-sm text-muted-foreground">
                          {getResourceTypeLabel(log.resource_type)}
                        </TableCell>
                        <TableCell className="py-3 sm:py-4 pr-3 sm:pr-4">
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            <span className="hidden sm:inline">
                              {new Date(log.created_at).toLocaleString(i18n.language)}
                            </span>
                            <span className="sm:hidden">
                              {new Date(log.created_at).toLocaleDateString(i18n.language, { 
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Buttons - Moved to bottom */}
      <div className="flex justify-center gap-2 pt-4">
        <Button
          variant={selectedTab === 'users' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('users')}
          className="flex-1 sm:flex-none items-center gap-2 text-sm"
        >
          <Users className="h-4 w-4" />
          <span className="whitespace-nowrap">{t('userManagement.tabs.users')}</span>
        </Button>
        <Button
          variant={selectedTab === 'audit' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('audit')}
          className="flex-1 sm:flex-none items-center gap-2 text-sm"
        >
          <Activity className="h-4 w-4" />
          <span className="whitespace-nowrap">{t('userManagement.tabs.audit')}</span>
        </Button>
      </div>
    </div>
  );
}