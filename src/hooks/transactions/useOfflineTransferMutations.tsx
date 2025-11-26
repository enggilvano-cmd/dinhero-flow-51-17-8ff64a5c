import { useCallback } from 'react';
import { useTransferMutations } from './useTransferMutations';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineQueue } from '@/lib/offlineQueue';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export function useOfflineTransferMutations() {
  const isOnline = useOnlineStatus();
  const onlineMutations = useTransferMutations();
  const { toast } = useToast();

  const handleTransfer = useCallback(async (
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: Date
  ) => {
    if (isOnline) {
      return onlineMutations.handleTransfer(fromAccountId, toAccountId, amount, date);
    }

    // Offline: enqueue transfer operation
    try {
      await offlineQueue.enqueue({
        type: 'transfer',
        data: {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount,
          date: date.toISOString().split('T')[0],
        }
      });

      toast({
        title: 'Transferência registrada',
        description: 'Será sincronizada quando você voltar online.',
        duration: 3000,
      });

      logger.info('Transfer queued for offline sync');
    } catch (error) {
      logger.error('Failed to queue transfer:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a transferência offline.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [isOnline, onlineMutations, toast]);

  return {
    handleTransfer,
  };
}
