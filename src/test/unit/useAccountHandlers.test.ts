import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccountHandlers } from '@/hooks/useAccountHandlers';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useAccountHandlers', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('handleEditAccount', () => {
    it('should return handlers object', () => {
      const { result } = renderHook(() => useAccountHandlers(), { wrapper });

      expect(result.current).toHaveProperty('handleEditAccount');
      expect(result.current).toHaveProperty('handleDeleteAccount');
      expect(result.current).toHaveProperty('handleImportAccounts');
      expect(typeof result.current.handleEditAccount).toBe('function');
    });

    it('should handle edit account success', async () => {
      const { result } = renderHook(() => useAccountHandlers(), { wrapper });

      const mockAccount = {
        id: 'account-id',
        name: 'Updated Account',
        type: 'checking' as const,
        balance: 100000,
        color: '#3b82f6',
        user_id: 'test-user-id',
      };

      await expect(
        result.current.handleEditAccount(mockAccount)
      ).resolves.not.toThrow();
    });
  });

  describe('handleDeleteAccount', () => {
    it('should prevent deletion of account with transactions', async () => {
      const mockSupabase = await import('@/integrations/supabase/client');
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'transaction-id' }],
          error: null,
        }),
      }));

      (mockSupabase.supabase.from as any) = mockFrom;

      const { result } = renderHook(() => useAccountHandlers(), { wrapper });

      await result.current.handleDeleteAccount('account-with-transactions');

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('transactions');
      });
    });
  });

  describe('handleImportAccounts', () => {
    it('should validate imported accounts using Zod schema', async () => {
      const { result } = renderHook(() => useAccountHandlers(), { wrapper });

      const invalidAccounts = [
        {
          name: '',
          type: 'invalid-type' as any,
          balance: -100,
        },
      ];

      await expect(
        result.current.handleImportAccounts(invalidAccounts as any, [])
      ).rejects.toThrow();
    });

    it('should import valid accounts successfully', async () => {
      const { result } = renderHook(() => useAccountHandlers(), { wrapper });

      const validAccounts = [
        {
          name: 'Imported Account',
          type: 'checking' as const,
          balance: 50000,
          color: '#22c55e',
        },
      ];

      await expect(
        result.current.handleImportAccounts(validAccounts, [])
      ).resolves.not.toThrow();
    });
  });
});
