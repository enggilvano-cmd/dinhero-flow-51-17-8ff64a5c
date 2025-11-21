import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Transaction } from '@/types';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryClient';
import { createDateFromString } from '@/lib/dateUtils';

interface AddTransactionParams {
  description: string;
  amount: number;
  date: Date;
  type: 'income' | 'expense' | 'transfer';
  category_id: string;
  account_id: string;
  status: 'pending' | 'completed';
  invoiceMonth?: string;
}

interface EditTransactionParams {
  id: string;
  updates: Partial<Transaction>;
  scope?: 'current' | 'all';
}

interface DeleteTransactionParams {
  id: string;
  scope?: 'current' | 'all';
}

export function useTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((trans) => ({
        ...trans,
        date: createDateFromString(trans.date),
      })) as Transaction[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async (transactionData: AddTransactionParams) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: transactionData.description,
            amount: transactionData.amount,
            date: transactionData.date.toISOString().split('T')[0],
            type: transactionData.type,
            category_id: transactionData.category_id,
            account_id: transactionData.account_id,
            status: transactionData.status,
            invoice_month: transactionData.invoiceMonth || null,
            invoice_month_overridden: !!transactionData.invoiceMonth,
          },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
    onError: (error) => {
      logger.error('Error adding transaction:', error);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, updates, scope = 'current' }: EditTransactionParams) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('atomic-edit-transaction', {
        body: {
          transaction_id: id,
          updates: {
            ...updates,
            date: updates.date ? new Date(updates.date).toISOString().split('T')[0] : undefined,
          },
          scope,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, scope = 'current' }: DeleteTransactionParams) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('atomic-delete-transaction', {
        body: { transaction_id: id, scope },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (transactionsData: Array<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('User not authenticated');

      const transactionsToInsert = await Promise.all(
        transactionsData.map(async (data) => {
          let category_id = data.category_id || null;
          if (!category_id && data.description) {
            const { data: existingCategory } = await supabase
              .from('categories')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', data.description)
              .maybeSingle();
            if (existingCategory) {
              category_id = existingCategory.id;
            }
          }
          return {
            description: data.description,
            amount: data.amount,
            category_id,
            type: data.type,
            account_id: data.account_id,
            date: typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().split('T')[0],
            status: data.status || 'completed',
            user_id: user.id,
          };
        })
      );

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;
      return newTransactions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });

  return {
    transactions: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addTransaction: addMutation.mutateAsync,
    editTransaction: editMutation.mutateAsync,
    deleteTransaction: deleteMutation.mutateAsync,
    importTransactions: importMutation.mutateAsync,
  };
}
