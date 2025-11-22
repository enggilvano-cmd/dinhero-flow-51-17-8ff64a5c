import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Account } from '@/types';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryClient';

export function useAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, type, balance, limit_amount, due_date, closing_date, color, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((acc) => ({
        ...acc,
        limit: acc.limit_amount,
      })) as Account[];
    },
    enabled: !!user,
    // CRITICAL: staleTime 0 para refetch imediato após mutações
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    // Keep previous data while fetching
    placeholderData: (previousData) => previousData,
    // CRITICAL: Always refetch on mount and window focus to get latest balances
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedAccount: Partial<Account> & { id: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('accounts')
        .update(updatedAccount)
        .eq('id', updatedAccount.id)
        .eq('user_id', user.id);

      if (error) throw error;
      return updatedAccount;
    },
    onSuccess: async (updatedAccount) => {
      // Optimistic update: update cache immediately
      queryClient.setQueryData<Account[]>(queryKeys.accounts, (old) => {
        if (!old) return old;
        return old.map(acc => acc.id === updatedAccount.id ? { ...acc, ...updatedAccount } : acc);
      });
      // Then invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts });
      // Also invalidate transactions if balance changed
      if (updatedAccount.balance !== undefined) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase });
        await queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase });
      }
    },
    onError: (error) => {
      logger.error('Error updating account:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);

      if (error) throw error;
      return accountId;
    },
    onSuccess: async (deletedAccountId) => {
      // Optimistic update: remove from cache immediately
      queryClient.setQueryData<Account[]>(queryKeys.accounts, (old) => {
        if (!old) return old;
        return old.filter(acc => acc.id !== deletedAccountId);
      });
      // Then invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts });
      // Also invalidate transactions
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase });
      await queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase });
    },
    onError: (error) => {
      logger.error('Error deleting account:', error);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (accountsData: Array<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('User not authenticated');

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
      return accountsToAdd;
    },
    onSuccess: async () => {
      // Invalidate and refetch accounts after bulk import
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts });
    },
  });

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateAccount: updateMutation.mutateAsync,
    deleteAccount: deleteMutation.mutateAsync,
    importAccounts: importMutation.mutateAsync,
  };
}
