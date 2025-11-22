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

export function useTransactionHandlers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ✅ Buscar dados diretamente do React Query (fonte única de verdade)
  const { accounts } = useAccounts();

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

      // Invalidar e forçar refetch imediato
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
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
      const totalInstallments = transactionsData.length;

      const results = await Promise.all(
        transactionsData.map((data, index) => {
          const dateStr = data.date.toISOString().split('T')[0];
          logger.debug(`Criando parcela ${index + 1}/${totalInstallments}:`, {
            description: data.description,
            originalDate: data.date.toISOString(),
            dateStr,
            currentInstallment: data.currentInstallment
          });
          
          return supabase.functions.invoke('atomic-transaction', {
            body: {
              transaction: {
                description: data.description,
                amount: data.amount,
                date: dateStr,
                type: data.type,
                category_id: data.category_id,
                account_id: data.account_id,
                status: data.status,
                invoice_month: data.invoiceMonth || null,
                invoice_month_overridden: !!data.invoiceMonth,
              },
            },
          });
        })
      );

      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;

      const createdIds = results
        .map((r) => (r.data as any)?.transaction?.id as string | undefined)
        .filter(Boolean) as string[];

      if (createdIds.length !== totalInstallments) {
        logger.error('Mismatch between installments created and expected', {
          expected: totalInstallments,
          created: createdIds.length,
        });
        throw new Error('Erro ao registrar metadados das parcelas');
      }

      const parentId = createdIds[0];

      const { error: metaError } = await supabase
        .from('transactions')
        .update({
          installments: totalInstallments,
          parent_transaction_id: parentId,
        })
        .in('id', createdIds);

      if (metaError) {
        logger.error('Error updating installment metadata:', metaError);
        throw metaError;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
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
      // Extrair apenas os campos que foram modificados
      const updates: any = {};
      
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

      const { error } = await supabase.functions.invoke('atomic-edit-transaction', {
        body: {
          transaction_id: updatedTransaction.id,
          updates,
          scope: editScope || 'current',
        }
      });

      if (error) throw error;

      // Aguardar um pouco para garantir que o banco processou
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch adicional para garantir
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts });
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

      if (error) {
        // Check if error has a message property from the edge function response
        const errorMessage = (error as any)?.message || 'Erro ao excluir transação';
        throw new Error(errorMessage);
      }

      // Check if the response indicates failure
      if (data && !data.success) {
        throw new Error(data.error || 'Transação não encontrada ou já foi excluída');
      }

      // Aguardar um pouco para garantir que o banco processou
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch adicional para garantir
      await queryClient.refetchQueries({ queryKey: queryKeys.accounts });

      toast({
        title: 'Sucesso',
        description: `${data?.deleted || 1} transação(ões) excluída(s)`,
      });
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro ao excluir transação';
      
      toast({
        title: 'Erro ao excluir',
        description: errorMessage,
        variant: 'destructive',
      });
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
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

  const handleImportTransactions = useCallback(async (
    transactionsData: any[],
    transactionsToReplace: string[] = []
  ) => {
    if (!user) return;
    try {
      // 1. Deletar transações que serão substituídas usando atomic-delete
      if (transactionsToReplace.length > 0) {
        await Promise.all(
          transactionsToReplace.map(txId =>
            supabase.functions.invoke('atomic-delete-transaction', {
              body: {
                transaction_id: txId,
                scope: 'current',
              }
            })
          )
        );
      }

      // 2. Importar novas transações
      // ✅ CORREÇÃO: Usar atomic-transaction para cada transação importada
      const results = await Promise.all(
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

          // ✅ Usar função atômica para garantir integridade
          return supabase.functions.invoke('atomic-transaction', {
            body: {
              transaction: {
                description: data.description,
                amount: data.amount,
                date: data.date,
                type: data.type,
                category_id: category_id,
                account_id: data.account_id,
                status: data.status || 'completed',
              }
            }
          });
        })
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      toast({
        title: 'Importação concluída',
        description: `${results.length} transações importadas${transactionsToReplace.length > 0 ? ` (${transactionsToReplace.length} substituídas)` : ''} com sucesso`,
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
  }, [user, queryClient, toast]);

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
      const creditAccount = accounts.find((acc) => acc.id === creditCardAccountId);
      const bankAccount = accounts.find((acc) => acc.id === debitAccountId);

      if (!creditAccount || !bankAccount) {
        throw new Error('Conta de crédito ou conta bancária não encontrada.');
      }

      // ✅ CORREÇÃO: Usar atomic-pay-bill
      const { data, error } = await supabase.functions.invoke('atomic-pay-bill', {
        body: {
          credit_account_id: creditCardAccountId,
          debit_account_id: debitAccountId,
          amount: Math.abs(amount),
          payment_date: paymentDate,
        }
      });

      if (error) {
        logger.error('Erro ao processar pagamento de fatura:', error);
        throw new Error(error.message || 'Falha ao processar pagamento');
      }

      logger.info('🔄 Refazendo fetch após pagamento...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      return {
        creditAccount: { ...creditAccount, balance: data.credit_balance?.[0]?.new_balance || creditAccount.balance },
        bankAccount: { ...bankAccount, balance: data.debit_balance?.[0]?.new_balance || bankAccount.balance },
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
      // ✅ CORREÇÃO: Usar atomic-delete-transaction para cada pagamento
      const results = await Promise.all(
        paymentsToReverse.map(payment => 
          supabase.functions.invoke('atomic-delete-transaction', {
            body: {
              transaction_id: payment.id,
              scope: 'current',
            }
          })
        )
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      logger.info('🔄 Refazendo fetch após estorno...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      toast({ title: 'Pagamento estornado com sucesso!' });
    } catch (error) {
      logger.error('Erro ao estornar pagamento:', error);
      toast({
        title: 'Erro ao estornar',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [user, queryClient, toast]);

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
