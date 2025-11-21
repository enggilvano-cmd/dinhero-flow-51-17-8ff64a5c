import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Account } from '@/types';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryClient';

export function useAccountHandlers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEditAccount = useCallback(async (updatedAccount: Account) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('accounts')
        .update(updatedAccount)
        .eq('id', updatedAccount.id)
        .eq('user_id', user.id);
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts, refetchType: 'active' });
    } catch (error) {
      logger.error('Error updating account:', error);
      throw error;
    }
  }, [user, queryClient]);

  const handleDeleteAccount = useCallback(async (accountId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts, refetchType: 'active' });
      toast({
        title: 'Sucesso',
        description: 'Conta excluída com sucesso',
      });
    } catch (error) {
      logger.error('Error deleting account:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir conta',
        variant: 'destructive',
      });
      throw error;
    }
  }, [user, toast, queryClient]);

  const handleImportAccounts = useCallback(async (accountsData: Array<{
    name: string;
    type: 'checking' | 'savings' | 'credit' | 'investment';
    balance?: number;
    color: string;
    limit_amount?: number;
    due_date?: number;
    closing_date?: number;
  }>) => {
    if (!user) return;
    try {
      const accountsToAdd = accountsData.map(acc => ({
        name: acc.name,
        type: acc.type,
        balance: acc.balance || 0,
        color: acc.color,
        limit_amount: acc.limit_amount,
        due_date: acc.due_date,
        closing_date: acc.closing_date,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('accounts')
        .insert(accountsToAdd);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts, refetchType: 'active' });
      toast({
        title: 'Sucesso',
        description: `${accountsToAdd.length} contas importadas com sucesso!`,
      });
    } catch (error) {
      logger.error('Error importing accounts:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao importar contas.',
        variant: 'destructive'
      });
      throw error;
    }
  }, [user, toast, queryClient]);

  return {
    handleEditAccount,
    handleDeleteAccount,
    handleImportAccounts,
  };
}
