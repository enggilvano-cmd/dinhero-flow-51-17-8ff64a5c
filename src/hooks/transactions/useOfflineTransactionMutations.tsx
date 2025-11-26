import { useCallback } from 'react';
import { useTransactionMutations } from './useTransactionMutations';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineQueue } from '@/lib/offlineQueue';
import { offlineDatabase } from '@/lib/offlineDatabase';
import { useToast } from '@/hooks/use-toast';
import { TransactionInput, TransactionUpdate } from '@/types';
import { EditScope } from '@/components/TransactionScopeDialog';
import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

export function useOfflineTransactionMutations() {
  const isOnline = useOnlineStatus();
  const onlineMutations = useTransactionMutations();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAddTransaction = useCallback(async (transactionData: TransactionInput) => {
    if (isOnline) {
      return onlineMutations.handleAddTransaction(transactionData);
    }

    // Offline: save locally and enqueue operation
    try {
      if (!user) throw new Error('User not authenticated');

      // Create optimistic transaction for local cache
      const optimisticTx = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        description: transactionData.description,
        amount: transactionData.type === 'expense' ? -Math.abs(transactionData.amount) : Math.abs(transactionData.amount),
        date: transactionData.date.toISOString().split('T')[0],
        type: transactionData.type,
        category_id: transactionData.category_id,
        account_id: transactionData.account_id,
        status: transactionData.status,
        invoice_month: transactionData.invoiceMonth || null,
        invoice_month_overridden: !!transactionData.invoiceMonth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to local cache immediately
      await offlineDatabase.saveTransactions([optimisticTx as any]);

      // Enqueue for server sync
      await offlineQueue.enqueue({
        type: 'transaction',
        data: {
          description: transactionData.description,
          amount: transactionData.amount,
          date: transactionData.date.toISOString().split('T')[0],
          type: transactionData.type,
          category_id: transactionData.category_id,
          account_id: transactionData.account_id,
          status: transactionData.status,
          invoice_month: transactionData.invoiceMonth || null,
          invoice_month_overridden: !!transactionData.invoiceMonth,
        }
      });

    } catch (error) {
      logger.error('Failed to queue transaction:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a transação offline',
        variant: 'destructive',
      });
    }
  }, [isOnline, onlineMutations, toast, user]);

  const handleEditTransaction = useCallback(async (
    updatedTransaction: TransactionUpdate,
    editScope?: EditScope
  ) => {
    if (isOnline) {
      return onlineMutations.handleEditTransaction(updatedTransaction, editScope);
    }

    // Offline: enqueue operation
    try {
      const updates: Partial<TransactionUpdate> = {};
      
      if (updatedTransaction.description !== undefined) {
        updates.description = updatedTransaction.description;
      }
      if (updatedTransaction.amount !== undefined) {
        updates.amount = updatedTransaction.amount;
      }
      if (updatedTransaction.date !== undefined) {
        updates.date = typeof updatedTransaction.date === 'string'
          ? updatedTransaction.date
          : updatedTransaction.date.toISOString().split('T')[0];
      }
      if (updatedTransaction.type !== undefined) {
        updates.type = updatedTransaction.type;
      }
      if (updatedTransaction.category_id !== undefined) {
        updates.category_id = updatedTransaction.category_id;
      }
      if (updatedTransaction.account_id !== undefined) {
        updates.account_id = updatedTransaction.account_id;
      }
      if (updatedTransaction.status !== undefined) {
        updates.status = updatedTransaction.status;
      }
      if (updatedTransaction.invoice_month !== undefined) {
        updates.invoice_month = updatedTransaction.invoice_month || null;
      }

      await offlineQueue.enqueue({
        type: 'edit',
        data: {
          transaction_id: updatedTransaction.id,
          updates,
          scope: editScope || 'current',
        }
      });

    } catch (error) {
      logger.error('Failed to queue edit:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a edição offline',
        variant: 'destructive',
      });
    }
  }, [isOnline, onlineMutations, toast, user]);

  const handleDeleteTransaction = useCallback(async (
    transactionId: string,
    editScope?: EditScope
  ) => {
    if (isOnline) {
      return onlineMutations.handleDeleteTransaction(transactionId, editScope);
    }

    // Offline: delete locally and enqueue operation
    try {
      // Delete from local cache immediately
      await offlineDatabase.deleteTransaction(transactionId);

      // Enqueue for server sync
      await offlineQueue.enqueue({
        type: 'delete',
        data: {
          p_transaction_id: transactionId,
          p_scope: editScope || 'current',
        }
      });

    } catch (error) {
      logger.error('Failed to queue delete:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a exclusão offline',
        variant: 'destructive',
      });
    }
  }, [isOnline, onlineMutations, toast, user]);

  return {
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    isOnline,
  };
}
