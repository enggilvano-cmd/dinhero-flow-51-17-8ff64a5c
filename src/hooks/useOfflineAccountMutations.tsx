import { useCallback } from 'react';
import { useAccountHandlers } from './useAccountHandlers';
import { useOnlineStatus } from './useOnlineStatus';
import { offlineQueue } from '@/lib/offlineQueue';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Account, ImportAccountData } from '@/types';

export function useOfflineAccountMutations() {
  const isOnline = useOnlineStatus();
  const onlineMutations = useAccountHandlers();
  const { toast } = useToast();

  const handleEditAccount = useCallback(async (updatedAccount: Account) => {
    if (isOnline) {
      return onlineMutations.handleEditAccount(updatedAccount);
    }

    // Offline: enqueue edit account operation
    try {
      await offlineQueue.enqueue({
        type: 'edit_account',
        data: {
          account_id: updatedAccount.id,
          updates: updatedAccount,
        }
      });

      toast({
        title: 'Edição registrada',
        description: 'Será sincronizada quando você voltar online.',
        duration: 3000,
      });

      logger.info('Account edit queued for offline sync');
    } catch (error) {
      logger.error('Failed to queue account edit:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a edição offline.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [isOnline, onlineMutations, toast]);

  const handleDeleteAccount = useCallback(async (accountId: string) => {
    if (isOnline) {
      return onlineMutations.handleDeleteAccount(accountId);
    }

    // Offline: enqueue delete account operation
    try {
      await offlineQueue.enqueue({
        type: 'delete_account',
        data: {
          account_id: accountId,
        }
      });

      toast({
        title: 'Exclusão registrada',
        description: 'Será sincronizada quando você voltar online.',
        duration: 3000,
      });

      logger.info('Account deletion queued for offline sync');
    } catch (error) {
      logger.error('Failed to queue account deletion:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a exclusão offline.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [isOnline, onlineMutations, toast]);

  const handleImportAccounts = useCallback(async (
    accountsData: ImportAccountData[],
    accountsToReplace: string[] = []
  ) => {
    if (isOnline) {
      return onlineMutations.handleImportAccounts(accountsData, accountsToReplace);
    }

    // Offline: enqueue import accounts operation
    try {
      await offlineQueue.enqueue({
        type: 'import_accounts',
        data: {
          accounts: accountsData,
          replace_ids: accountsToReplace,
        }
      });

      toast({
        title: 'Importação registrada',
        description: 'Será sincronizada quando você voltar online.',
        duration: 3000,
      });

      logger.info('Accounts import queued for offline sync');
    } catch (error) {
      logger.error('Failed to queue accounts import:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a importação offline.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [isOnline, onlineMutations, toast]);

  return {
    handleEditAccount,
    handleDeleteAccount,
    handleImportAccounts,
  };
}
