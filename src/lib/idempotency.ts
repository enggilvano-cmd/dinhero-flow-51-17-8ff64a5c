import { logger } from './logger';

/**
 * Idempotency key manager for critical operations
 * Prevents duplicate operations from being executed
 */
class IdempotencyManager {
  private pendingOperations = new Map<string, Promise<any>>();
  private completedOperations = new Map<string, { result: any; timestamp: number }>();
  
  // Cache completed operations for 5 minutes
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * Generate a unique idempotency key based on operation type and parameters
   */
  generateKey(operation: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    
    return `${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Execute an operation with idempotency protection
   * If the same operation is already in progress, return the existing promise
   * If the operation was recently completed, return the cached result
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if operation is already in progress
    const pending = this.pendingOperations.get(key);
    if (pending) {
      logger.info('Idempotency: Returning pending operation', { key });
      return pending as Promise<T>;
    }

    // Check if operation was recently completed
    const completed = this.completedOperations.get(key);
    if (completed) {
      const age = Date.now() - completed.timestamp;
      if (age < this.CACHE_TTL) {
        logger.info('Idempotency: Returning cached result', { key, age });
        return completed.result as T;
      } else {
        // Expired, remove from cache
        this.completedOperations.delete(key);
      }
    }

    // Execute the operation
    const promise = operation()
      .then((result) => {
        // Cache the result
        this.completedOperations.set(key, {
          result,
          timestamp: Date.now(),
        });
        
        // Remove from pending
        this.pendingOperations.delete(key);
        
        logger.info('Idempotency: Operation completed', { key });
        return result;
      })
      .catch((error) => {
        // Remove from pending on error
        this.pendingOperations.delete(key);
        logger.error('Idempotency: Operation failed', { key, error });
        throw error;
      });

    // Store as pending
    this.pendingOperations.set(key, promise);
    
    return promise;
  }

  /**
   * Clear expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.completedOperations.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_TTL) {
        expired.push(key);
      }
    });

    expired.forEach(key => this.completedOperations.delete(key));
    
    if (expired.length > 0) {
      logger.info('Idempotency: Cleaned up expired entries', { count: expired.length });
    }
  }

  /**
   * Manually invalidate a cached result
   */
  invalidate(key: string): void {
    this.completedOperations.delete(key);
    logger.info('Idempotency: Invalidated cache', { key });
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.pendingOperations.clear();
    this.completedOperations.clear();
    logger.info('Idempotency: Cleared all caches');
  }
}

export const idempotencyManager = new IdempotencyManager();

// Run cleanup every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    idempotencyManager.cleanup();
  }, 60 * 1000);
}

/**
 * Helper hook for generating idempotency keys in components
 */
export function useIdempotencyKey(operation: string, params: Record<string, any>): string {
  return idempotencyManager.generateKey(operation, params);
}
