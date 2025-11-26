import { offlineQueue, QueuedOperation } from './offlineQueue';
import { offlineDatabase } from './offlineDatabase';
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';
import type { Transaction, Account, Category } from '@/types';

const MAX_RETRIES = 3;
const SYNC_MONTHS = 3;

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
      
      // After syncing operations, pull fresh data from server
      await this.syncDataFromServer();
    } finally {
      this.isSyncing = false;
    }
  }

  async syncDataFromServer(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No user found for data sync');
        return;
      }

      logger.info('Syncing data from server...');

      // Calculate date range (last 3 months)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - SYNC_MONTHS);
      const dateFrom = cutoffDate.toISOString().split('T')[0];

      // Fetch and cache transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateFrom)
        .order('date', { ascending: false });

      if (transactions) {
        await offlineDatabase.saveTransactions(transactions as Transaction[]);
      }

      // Fetch and cache accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accounts) {
        const mappedAccounts = accounts.map(acc => ({
          ...acc,
          limit: acc.limit_amount,
        })) as Account[];
        await offlineDatabase.saveAccounts(mappedAccounts);
      }

      // Fetch and cache categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      if (categories) {
        await offlineDatabase.saveCategories(categories as Category[]);
      }

      // Update last sync timestamp
      await offlineDatabase.setLastSync('full-sync', Date.now());

      logger.info('Data sync from server completed');
    } catch (error) {
      logger.error('Failed to sync data from server:', error);
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
        await offlineDatabase.clearAll();
        break;

      default:
        logger.warn(`Unknown operation type: ${operation.type}`);
    }
  }
}

export const offlineSync = new OfflineSyncManager();
