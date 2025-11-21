import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Account, Transaction } from '@/types';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryClient';
import { EditScope } from '@/components/InstallmentEditScopeDialog';
import { useAccounts } from './queries/useAccounts';
import { useTransactions } from './queries/useTransactions';

export function useTransactionHandlers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ✅ Buscar dados diretamente do React Query (fonte única de verdade)
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();

  const handleAddTransaction = useCallback(async (transactionData: any) => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('atomic-transaction', {
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
          }
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    } catch (error) {
      logger.error('Error adding transaction:', error);
      if (error instanceof Error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [user, queryClient, toast]);

  const handleAddInstallmentTransactions = useCallback(async (transactionsData: any[]) => {
    if (!user) return;
    try {
      const results = await Promise.all(
        transactionsData.map(data =>
          supabase.functions.invoke('atomic-transaction', {
            body: {
              transaction: {
                description: data.description,
                amount: data.amount,
                date: data.date.toISOString().split('T')[0],
                type: data.type,
                category_id: data.category_id,
                account_id: data.account_id,
                status: data.status,
                invoice_month: data.invoiceMonth || null,
                invoice_month_overridden: !!data.invoiceMonth,
              }
            }
          })
        )
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    } catch (error) {
      logger.error('Error adding installment transactions:', error);
      throw error;
    }
  }, [user, queryClient]);

  const handleEditTransaction = useCallback(async (
    updatedTransaction: any,
    editScope?: EditScope
  ) => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('atomic-edit-transaction', {
        body: {
          transaction_id: updatedTransaction.id,
          updates: {
            description: updatedTransaction.description,
            amount: updatedTransaction.amount,
            date: typeof updatedTransaction.date === 'string'
              ? updatedTransaction.date
              : updatedTransaction.date.toISOString().split('T')[0],
            type: updatedTransaction.type,
            category_id: updatedTransaction.category_id,
            account_id: updatedTransaction.account_id,
            status: updatedTransaction.status || 'completed',
            invoice_month: updatedTransaction.invoice_month || null,
          },
          scope: editScope || 'current',
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    } catch (error) {
      logger.error('Error updating transaction:', error);
      if (error instanceof Error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [user, queryClient, toast]);

  const handleDeleteTransaction = useCallback(async (
    transactionId: string,
    editScope?: EditScope
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('atomic-delete-transaction', {
        body: {
          transaction_id: transactionId,
          scope: editScope || 'current',
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

      toast({
        title: 'Sucesso',
        description: `${data.deleted} transação(ões) excluída(s)`,
      });
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      if (error instanceof Error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [user, queryClient, toast]);

  const handleTransfer = useCallback(async (
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: Date
  ) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const fromAccount = accounts.find((acc) => acc.id === fromAccountId);
      const toAccount = accounts.find((acc) => acc.id === toAccountId);
      if (!fromAccount || !toAccount) throw new Error('Contas não encontradas');

      const { error } = await supabase.functions.invoke('atomic-transfer', {
        body: {
          transfer: {
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount: amount,
            date: date.toISOString().split('T')[0],
            description: `Transferência para ${toAccount.name}`,
          }
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    } catch (error) {
      logger.error('Error processing transfer:', error);
      if (error instanceof Error) {
        toast({
          title: 'Erro na transferência',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [user, accounts, queryClient, toast]);

  const handleImportTransactions = useCallback(async (transactionsData: any[]) => {
    if (!user) return;
    try {
      const transactionsToInsert = await Promise.all(
        transactionsData.map(async (data) => {
          let category_id = null;
          if (data.category) {
            const { data: existingCategory } = await supabase
              .from('categories')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', data.category)
              .maybeSingle();
            if (existingCategory) {
              category_id = existingCategory.id;
            } else {
              const { data: newCategory } = await supabase
                .from('categories')
                .insert({
                  name: data.category,
                  user_id: user.id,
                  type: data.type === 'income' ? 'income' : 'expense',
                })
                .select('id')
                .single();
              if (newCategory) {
                category_id = newCategory.id;
              }
            }
          }
          return {
            description: data.description,
            amount: data.amount,
            category_id,
            type: data.type,
            account_id: data.account_id,
            date: data.date,
            status: data.status,
            installments: data.installments,
            current_installment: data.current_installment,
            user_id: user.id,
          };
        })
      );

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;

      const accountBalanceChanges = transactionsData.reduce(
        (acc, trans) => {
          const balanceChange =
            trans.type === 'income' ? trans.amount : -trans.amount;
          acc[trans.account_id] = (acc[trans.account_id] || 0) + balanceChange;
          return acc;
        },
        {} as Record<string, number>
      );

      for (const [accountId, balanceChange] of Object.entries(accountBalanceChanges)) {
        const account = accounts.find((acc) => acc.id === accountId);
        if (account && typeof balanceChange === 'number') {
          const newBalance = account.balance + balanceChange;
          await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', accountId)
            .eq('user_id', user.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      
      toast({
        title: 'Importação concluída',
        description: `${newTransactions.length} transações importadas com sucesso`,
      });
    } catch (error) {
      logger.error('Error importing transactions:', error);
      toast({
        title: 'Erro na importação',
        description: 'Erro inesperado durante a importação',
        variant: 'destructive',
      });
      throw error;
    }
  }, [user, accounts, queryClient, toast]);

  const handleCreditPayment = useCallback(async ({
    creditCardAccountId,
    debitAccountId,
    amount,
    paymentDate,
  }: {
    creditCardAccountId: string;
    debitAccountId: string;
    amount: number;
    paymentDate: string;
  }): Promise<{ creditAccount: Account; bankAccount: Account }> => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const { data: paymentCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Pagamento de Fatura')
        .single();

      const creditAccount = accounts.find((acc) => acc.id === creditCardAccountId);
      const bankAccount = accounts.find((acc) => acc.id === debitAccountId);

      if (!creditAccount || !bankAccount) {
        throw new Error('Conta de crédito ou conta bancária não encontrada.');
      }

      const { data: creditData, error: creditError } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: `Pagamento recebido de ${bankAccount.name}`,
            amount: Math.abs(amount),
            date: paymentDate,
            type: 'income',
            category_id: paymentCategory?.id || null,
            account_id: creditCardAccountId,
            status: 'completed',
          }
        }
      });

      if (creditError) {
        logger.error('Erro ao criar transação de pagamento no cartão:', creditError);
        throw new Error(`Pagamento no cartão falhou: ${creditError.error}`);
      }

      const { data: bankData, error: bankError } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: `Pagamento fatura ${creditAccount.name}`,
            amount: Math.abs(amount),
            date: paymentDate,
            type: 'expense',
            category_id: paymentCategory?.id || null,
            account_id: debitAccountId,
            status: 'completed',
          }
        }
      });

      if (bankError) {
        logger.error('Erro ao criar transação de débito no banco:', bankError);
        if (creditData?.transaction?.id) {
          await supabase.from('transactions').delete().eq('id', creditData.transaction.id);
        }
        throw new Error(`Débito no banco falhou: ${bankError.error}`);
      }

      if (creditData?.transaction?.id && bankData?.transaction?.id) {
        await supabase
          .from('transactions')
          .update({ linked_transaction_id: bankData.transaction.id })
          .eq('id', creditData.transaction.id);
      }

      logger.info('🔄 Refazendo fetch após pagamento...');
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

      const updatedCreditAccount = accounts.find(a => a.id === creditCardAccountId);
      const updatedBankAccount = accounts.find(a => a.id === debitAccountId);

      if (!updatedCreditAccount || !updatedBankAccount) {
        throw new Error('Contas não encontradas após atualização');
      }

      return {
        creditAccount: { ...updatedCreditAccount, balance: creditData.balance.new_balance },
        bankAccount: { ...updatedBankAccount, balance: bankData.balance.new_balance },
      };
    } catch (error) {
      logger.error('Error processing credit payment:', error);
      throw error;
    }
  }, [user, accounts, queryClient]);

  const handleReversePayment = useCallback(async (paymentsToReverse: Transaction[]) => {
    if (!user || !paymentsToReverse || paymentsToReverse.length === 0) {
      toast({ title: 'Nenhum pagamento para estornar', variant: 'destructive' });
      return;
    }

    toast({ title: 'Estornando pagamento...' });

    try {
      const transactionsToDelete_ids: string[] = [];
      const accountsToUpdate = new Map<string, number>();

      for (const payment of paymentsToReverse) {
        transactionsToDelete_ids.push(payment.id);

        const creditAccountId = payment.account_id;
        const creditAccBalanceChange = -payment.amount; 
        
        accountsToUpdate.set(
          creditAccountId,
          (accountsToUpdate.get(creditAccountId) || 0) + creditAccBalanceChange
        );

        const linkedExpense = transactions.find(
          (t: Transaction) => t.id === payment.linked_transaction_id || 
          (t.parent_transaction_id === payment.id && t.type === 'expense')
        );
          
        if (linkedExpense) {
          transactionsToDelete_ids.push(linkedExpense.id);
          
          const debitAccountId = linkedExpense.account_id;
          const debitAccBalanceChange = linkedExpense.amount;
          
          accountsToUpdate.set(
            debitAccountId,
            (accountsToUpdate.get(debitAccountId) || 0) + debitAccBalanceChange
          );
        } else {
            logger.warn(`Transação de débito vinculada ao pagamento ${payment.id} não encontrada.`);
        }
      }

      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .in('id', transactionsToDelete_ids)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      for (const [accountId, balanceChange] of accountsToUpdate.entries()) {
        const account = accounts.find((acc) => acc.id === accountId);
        if (account) {
          const newBalance = account.balance + balanceChange;
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', accountId)
            .eq('user_id', user.id);

          if (updateError) throw updateError;
        }
      }

      logger.info('🔄 Refazendo fetch após estorno...');
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

      toast({ title: 'Pagamento estornado com sucesso!' });
    } catch (error) {
      logger.error('Erro ao estornar pagamento:', error);
      toast({
        title: 'Erro ao estornar',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [user, accounts, transactions, queryClient, toast]);

  return {
    handleAddTransaction,
    handleAddInstallmentTransactions,
    handleEditTransaction,
    handleDeleteTransaction,
    handleTransfer,
    handleImportTransactions,
    handleCreditPayment,
    handleReversePayment,
  };
}
