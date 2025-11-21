import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized React Query client configuration
 * Provides intelligent caching, automatic retries, and error handling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations only once
      retry: 1,
    },
  },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  transactions: (filters?: Record<string, any>) => 
    ['transactions', filters] as const,
  transaction: (id: string) => ['transactions', id] as const,
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  profile: ['profile'] as const,
  settings: ['settings'] as const,
  notifications: ['notifications'] as const,
  chartOfAccounts: ['chartOfAccounts'] as const,
  periodClosures: ['periodClosures'] as const,
  creditBills: (accountId?: string) => 
    ['creditBills', accountId] as const,
} as const;
