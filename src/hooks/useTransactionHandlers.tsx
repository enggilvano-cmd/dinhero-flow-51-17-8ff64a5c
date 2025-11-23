import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  Account, 
  Transaction, 
  TransactionInput, 
  InstallmentTransactionInput, 
  TransactionUpdate, 
  ImportTransactionData 
} from '@/types';
import { logger } from '@/lib/logger';
import { queryKeys, refetchWithDelay } from '@/lib/queryClient';
import { EditScope } from '@/components/TransactionScopeDialog';
import { useAccounts } from './queries/useAccounts';

// Type guard para erros com mensagem
interface ErrorWithMessage {
  message: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export function useTransactionHandlers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ✅ Buscar dados diretamente do React Query (fonte única de verdade)
  const { accounts } = useAccounts();

  const handleAddTransaction = useCallback(async (transactionData: TransactionInput) => {
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

      if (error) {
        // Check if it's a credit limit error
        const errorMessage = getErrorMessage(error);
        if (errorMessage.includes('Credit limit exceeded')) {
          // Extract the error message from the edge function response
          const match = errorMessage.match(/Available: ([\d.-]+).*Limit: ([\d.]+).*Used: ([\d.]+).*Requested: ([\d.]+)/);
          
          let friendlyMessage = 'Limite do cartão de crédito excedido. ';
          if (match) {
            const available = (parseFloat(match[1]) / 100).toFixed(2);
            const limit = (parseFloat(match[2]) / 100).toFixed(2);
            const used = (parseFloat(match[3]) / 100).toFixed(2);
            const requested = (parseFloat(match[4]) / 100).toFixed(2);
            
            friendlyMessage += `Disponível: R$ ${available} | Limite: R$ ${limit} | Usado: R$ ${used} | Solicitado: R$ ${requested}`;
          } else {
            friendlyMessage += 'Reduza o valor da transação, aumente o limite do cartão ou faça um pagamento.';
          }
          
          toast({
            title: 'Limite de crédito excedido',
            description: friendlyMessage,
            variant: 'destructive',
          });
          return; // Don't throw, just show toast
        }
        throw error;
      }

      // Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);
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

  const handleAddInstallmentTransactions = useCallback(async (transactionsData: InstallmentTransactionInput[]) => {
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
      if (errors.length > 0) {
        const firstError = errors[0].error;
        const errorMessage = getErrorMessage(firstError);
        
        // Check if it's a credit limit error
        if (errorMessage.includes('Credit limit exceeded')) {
          const match = errorMessage.match(/Available: ([\d.-]+).*Limit: ([\d.]+).*Used: ([\d.]+).*Requested: ([\d.]+)/);
          
          let friendlyMessage = 'Limite do cartão de crédito excedido ao criar parcelas. ';
          if (match) {
            const available = (parseFloat(match[1]) / 100).toFixed(2);
            const limit = (parseFloat(match[2]) / 100).toFixed(2);
            const used = (parseFloat(match[3]) / 100).toFixed(2);
            const requested = (parseFloat(match[4]) / 100).toFixed(2);
            
            friendlyMessage += `Disponível: R$ ${available} | Limite: R$ ${limit} | Usado: R$ ${used} | Solicitado por parcela: R$ ${requested}`;
          } else {
            friendlyMessage += 'Reduza o número de parcelas, o valor ou aumente o limite do cartão.';
          }
          
          toast({
            title: 'Limite de crédito excedido',
            description: friendlyMessage,
            variant: 'destructive',
          });
          return; // Don't throw, just show toast
        }
        throw firstError;
      }

      const createdIds = results
        .map((r) => {
          const transactionData = r.data as Record<string, unknown> | null;
          return transactionData?.transaction as { id?: string } | undefined;
        })
        .filter((t): t is { id: string } => t !== undefined && typeof t.id === 'string')
        .map(t => t.id);

      if (createdIds.length !== totalInstallments) {
        logger.error('Mismatch between installments created and expected', {
          expected: totalInstallments,
          created: createdIds.length,
        });
        throw new Error('Erro ao registrar metadados das parcelas');
      }

      const parentId = createdIds[0];

      // Atualizar cada transação com seu número de parcela específico
      const updatePromises = createdIds.map((id, index) => 
        supabase
          .from('transactions')
          .update({
            installments: totalInstallments,
            current_installment: index + 1,
            parent_transaction_id: parentId,
          })
          .eq('id', id)
      );

      const updateResults = await Promise.all(updatePromises);
      const updateErrors = updateResults.filter(r => r.error);
      
      if (updateErrors.length > 0) {
        logger.error('Error updating installment metadata:', updateErrors[0].error);
        throw updateErrors[0].error;
      }

      // Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);
    } catch (error) {
      logger.error('Error adding installment transactions:', error);
      throw error;
    }
  }, [user, queryClient]);

  const handleEditTransaction = useCallback(async (
    updatedTransaction: TransactionUpdate,
    editScope?: EditScope
  ) => {
    if (!user) return;
    try {
      // Extrair apenas os campos que foram modificados
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

      const { error } = await supabase.functions.invoke('atomic-edit-transaction', {
        body: {
          transaction_id: updatedTransaction.id,
          updates,
          scope: editScope || 'current',
        }
      });

      if (error) throw error;

      // Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);
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
        const errorMessage = getErrorMessage(error);
        throw new Error(errorMessage);
      }

      // Check if the response indicates failure
      if (data && !data.success) {
        throw new Error(data.error || 'Transação não encontrada ou já foi excluída');
      }

      // Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);

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
            status: 'completed' as const,
          }
        }
      });

      if (error) throw error;

      // Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);
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
    transactionsData: ImportTransactionData[],
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

      // 2. ✅ OTIMIZAÇÃO: Batch lookup de categorias (resolve N+1 queries)
      // Coletar nomes únicos de categorias necessárias
      const uniqueCategoryNames = [...new Set(
        transactionsData
          .filter(data => data.category)
          .map(data => data.category!)
      )];

      // Buscar todas as categorias existentes em uma única query
      const { data: existingCategories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', uniqueCategoryNames);

      // Criar mapa de categorias existentes
      const categoryMap = new Map<string, string>(
        existingCategories?.map(cat => [cat.name, cat.id]) || []
      );

      // Identificar categorias que precisam ser criadas
      const categoriesToCreate = uniqueCategoryNames.filter(
        name => !categoryMap.has(name)
      );

      // Criar todas as novas categorias em batch
      if (categoriesToCreate.length > 0) {
        const { data: newCategories } = await supabase
          .from('categories')
          .insert(
            categoriesToCreate.map(name => {
              // Determinar tipo baseado nas transações que usam essa categoria
              const sampleTransaction = transactionsData.find(
                data => data.category === name
              );
              const categoryType: 'income' | 'expense' | 'both' = 
                sampleTransaction?.type === 'income' ? 'income' : 'expense';
              
              return {
                name,
                user_id: user.id,
                type: categoryType,
              };
            })
          )
          .select('id, name');

        // Adicionar novas categorias ao mapa
        newCategories?.forEach(cat => {
          categoryMap.set(cat.name, cat.id);
        });
      }

      // 3. Importar transações usando o mapa de categorias (sem queries adicionais)
      const results = await Promise.all(
        transactionsData.map(async (data) => {
          const category_id = data.category ? categoryMap.get(data.category) || null : null;

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
      if (errors.length > 0) {
        const firstError = errors[0].error;
        const errorMessage = getErrorMessage(firstError);
        
        // Check if it's a credit limit error
        if (errorMessage.includes('Credit limit exceeded')) {
          const match = errorMessage.match(/Available: ([\d.-]+).*Limit: ([\d.]+).*Used: ([\d.]+).*Requested: ([\d.]+)/);
          
          let friendlyMessage = 'Limite do cartão de crédito excedido durante importação. ';
          if (match) {
            const available = (parseFloat(match[1]) / 100).toFixed(2);
            const limit = (parseFloat(match[2]) / 100).toFixed(2);
            const used = (parseFloat(match[3]) / 100).toFixed(2);
            
            friendlyMessage += `Disponível: R$ ${available} | Limite: R$ ${limit} | Usado: R$ ${used}. Ajuste os valores ou aumente o limite do cartão.`;
          } else {
            friendlyMessage += 'Verifique os valores das transações e o limite do cartão.';
          }
          
          toast({
            title: 'Limite de crédito excedido',
            description: friendlyMessage,
            variant: 'destructive',
          });
          return; // Don't throw, just show toast
        }
        throw firstError;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);
      
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
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);

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
      
      // Refetch após 10ms para atualização imediata
      refetchWithDelay(queryClient, [queryKeys.transactionsBase, queryKeys.accounts]);

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
