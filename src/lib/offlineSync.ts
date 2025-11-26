import { offlineQueue, QueuedOperation } from './offlineQueue';
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

const MAX_RETRIES = 3;

class OfflineSyncManager {
  private isSyncing = false;

  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      logger.info('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    logger.info('Starting offline sync...');

    try {
      const operations = await offlineQueue.getAll();
      
      if (operations.length === 0) {
        logger.info('No operations to sync');
        return;
      }

      logger.info(`Syncing ${operations.length} queued operations`);

      // Sort by timestamp to maintain order
      operations.sort((a, b) => a.timestamp - b.timestamp);

      for (const operation of operations) {
        try {
          await this.syncOperation(operation);
          await offlineQueue.dequeue(operation.id);
        } catch (error) {
          logger.error(`Failed to sync operation ${operation.id}:`, error);
          
          if (operation.retries >= MAX_RETRIES) {
            logger.warn(`Max retries reached for operation ${operation.id}, removing from queue`);
            await offlineQueue.dequeue(operation.id);
          } else {
            await offlineQueue.updateRetries(operation.id, operation.retries + 1);
          }
        }
      }

      logger.info('Offline sync completed');
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncOperation(operation: QueuedOperation): Promise<void> {
    logger.info(`Syncing operation: ${operation.type}`, operation.data);

    switch (operation.type) {
      case 'transaction':
        await supabase.functions.invoke('atomic-transaction', {
          body: { transaction: operation.data }
        });
        break;

      case 'edit':
        await supabase.functions.invoke('atomic-edit-transaction', {
          body: operation.data
        });
        break;

      case 'delete':
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated for offline delete sync');
        }
        await supabase.rpc('atomic_delete_transaction', {
          p_user_id: user.id,
          ...(operation.data || {}),
        });
        break;

      case 'transfer':
        await supabase.functions.invoke('atomic-transfer', {
          body: operation.data
        });
        break;

      case 'logout':
        await supabase.auth.signOut();
        break;

      default:
        logger.warn(`Unknown operation type: ${operation.type}`);
    }
  }
}

export const offlineSync = new OfflineSyncManager();
