import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Account, ImportAccountData } from '@/types';
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
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    } catch (error) {
      logger.error('Error updating account:', error);
      throw error;
    }
  }, [user, queryClient]);

  const handleDeleteAccount = useCallback(async (accountId: string) => {
    if (!user) return;
    try {
      // CRITICAL: Verificar se há transações vinculadas antes de deletar
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .limit(1);

      if (checkError) throw checkError;

      // Se há transações, bloquear exclusão
      if (transactions && transactions.length > 0) {
        toast({
          title: 'Não é possível excluir',
          description: 'Esta conta possui transações vinculadas. Exclua as transações primeiro ou transfira-as para outra conta.',
          variant: 'destructive',
        });
        return;
      }

      // Verificar se é conta destino em transferências
      const { data: transfers, error: transferCheckError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('to_account_id', accountId)
        .limit(1);

      if (transferCheckError) throw transferCheckError;

      if (transfers && transfers.length > 0) {
        toast({
          title: 'Não é possível excluir',
          description: 'Esta conta é destino de transferências. Exclua as transferências primeiro.',
          variant: 'destructive',
        });
        return;
      }

      // Se passou nas verificações, pode deletar
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      toast({
        title: 'Sucesso',
        description: 'Conta excluída com sucesso',
      });
    } catch (error) {
      logger.error('Error deleting account:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir conta',
        variant: 'destructive',
      });
      throw error;
    }
  }, [user, toast, queryClient]);

  const handleImportAccounts = useCallback(async (
    accountsData: ImportAccountData[],
    accountsToReplace: string[] = []
  ) => {
    if (!user) return;
    try {
      // 1. Deletar contas que serão substituídas
      if (accountsToReplace.length > 0) {
        const { error: deleteError } = await supabase
          .from('accounts')
          .delete()
          .in('id', accountsToReplace)
          .eq('user_id', user.id);
        
        if (deleteError) throw deleteError;
      }

      // 2. Inserir novas contas
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
      
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      toast({
        title: 'Sucesso',
        description: `${accountsToAdd.length} contas importadas${accountsToReplace.length > 0 ? ` (${accountsToReplace.length} substituídas)` : ''} com sucesso!`,
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
