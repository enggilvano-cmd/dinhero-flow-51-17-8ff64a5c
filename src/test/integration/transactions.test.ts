import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { useTransactionStore } from '@/stores/TransactionStore';
import { renderHook, act } from '@testing-library/react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('Transaction Integration Tests', () => {
  const mockUser = { id: 'test-user-123' };
  const mockAccount = {
    id: 'account-123',
    name: 'Test Account',
    type: 'checking',
    balance: 1000,
  };
  const mockCategory = {
    id: 'category-123',
    name: 'Test Category',
    type: 'expense',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });
  });

  describe('Transaction Creation Flow', () => {
    it('should create a transaction and update store', async () => {
      const mockTransaction = {
        id: 'transaction-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        category_id: mockCategory.id,
        type: 'expense',
        amount: 5000, // $50.00
        description: 'Test expense',
        date: '2024-01-15',
        status: 'completed',
      };

      // Mock Supabase insert
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [mockTransaction],
            error: null,
          }),
        }),
      } as any);

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.addTransactions([mockTransaction as any]);
      });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].id).toBe('transaction-123');
      expect(result.current.transactions[0].amount).toBe(5000);
    });

    it('should handle validation errors during creation', async () => {
      const invalidTransaction = {
        user_id: mockUser.id,
        account_id: '',
        amount: -100, // Invalid negative amount
        description: '',
        date: 'invalid-date',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Validation error', code: '23502' },
          }),
        }),
      } as any);

      const { result } = renderHook(() => useTransactionStore());

      // Should not throw, should handle gracefully
      await act(async () => {
        try {
          result.current.addTransactions([invalidTransaction as any]);
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('should prevent duplicate transactions with idempotency', async () => {
      const mockTransaction = {
        id: 'transaction-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        type: 'expense',
        amount: 5000,
        description: 'Test expense',
        date: '2024-01-15',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockImplementation(() => {
          callCount++;
          return {
            select: vi.fn().mockResolvedValue({
              data: [mockTransaction],
              error: null,
            }),
          };
        }),
      } as any);

      const { result } = renderHook(() => useTransactionStore());

      // Add same transaction twice rapidly
      await act(async () => {
        result.current.addTransactions([mockTransaction as any]);
        result.current.addTransactions([mockTransaction as any]);
      });

      // Should still only have one transaction
      expect(result.current.transactions).toHaveLength(1);
    });
  });

  describe('Transaction Update Flow', () => {
    it('should update transaction and reflect changes in store', async () => {
      const originalTransaction = {
        id: 'transaction-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        amount: 5000,
        description: 'Original',
        date: '2024-01-15',
      };

      const updatedTransaction = {
        ...originalTransaction,
        amount: 7500,
        description: 'Updated',
      };

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.setTransactions([originalTransaction as any]);
      });

      expect(result.current.transactions[0].amount).toBe(5000);

      await act(async () => {
        result.current.updateTransaction(updatedTransaction as any);
      });

      expect(result.current.transactions[0].amount).toBe(7500);
      expect(result.current.transactions[0].description).toBe('Updated');
    });

    it('should handle concurrent updates correctly', async () => {
      const transaction = {
        id: 'transaction-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        amount: 5000,
        description: 'Test',
        date: '2024-01-15',
      };

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.setTransactions([transaction as any]);
      });

      // Simulate two rapid updates
      await act(async () => {
        result.current.updateTransaction({ ...transaction, amount: 6000 } as any);
        result.current.updateTransaction({ ...transaction, amount: 7000 } as any);
      });

      // Last update should win
      expect(result.current.transactions[0].amount).toBe(7000);
    });
  });

  describe('Transaction Deletion Flow', () => {
    it('should remove transaction from store', async () => {
      const transaction = {
        id: 'transaction-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        amount: 5000,
        description: 'Test',
        date: '2024-01-15',
      };

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.setTransactions([transaction as any]);
      });

      expect(result.current.transactions).toHaveLength(1);

      await act(async () => {
        result.current.removeTransaction('transaction-123');
      });

      expect(result.current.transactions).toHaveLength(0);
    });

    it('should handle batch deletions', async () => {
      const transactions = [
        { id: 'transaction-1', amount: 1000 },
        { id: 'transaction-2', amount: 2000 },
        { id: 'transaction-3', amount: 3000 },
      ];

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.setTransactions(transactions as any);
      });

      expect(result.current.transactions).toHaveLength(3);

      await act(async () => {
        result.current.removeTransactions(['transaction-1', 'transaction-3']);
      });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].id).toBe('transaction-2');
    });
  });

  describe('Transfer Operations', () => {
    it('should create linked transactions for transfers', async () => {
      const fromAccount = { ...mockAccount, id: 'account-from' };
      const toAccount = { ...mockAccount, id: 'account-to' };

      const transferExpense = {
        id: 'transaction-expense',
        user_id: mockUser.id,
        account_id: fromAccount.id,
        to_account_id: toAccount.id,
        type: 'transfer',
        amount: 10000,
        description: 'Transfer',
        date: '2024-01-15',
        linked_transaction_id: 'transaction-income',
      };

      const transferIncome = {
        id: 'transaction-income',
        user_id: mockUser.id,
        account_id: toAccount.id,
        type: 'transfer',
        amount: 10000,
        description: 'Transfer',
        date: '2024-01-15',
        linked_transaction_id: 'transaction-expense',
      };

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.addTransactions([transferExpense as any, transferIncome as any]);
      });

      expect(result.current.transactions).toHaveLength(2);
      expect(result.current.transactions[0].linked_transaction_id).toBe('transaction-income');
      expect(result.current.transactions[1].linked_transaction_id).toBe('transaction-expense');
    });
  });

  describe('Installment Transactions', () => {
    it('should create multiple installment transactions', async () => {
      const parentTransaction = {
        id: 'parent-123',
        user_id: mockUser.id,
        account_id: mockAccount.id,
        amount: 12000,
        description: 'Purchase in 3x',
        date: '2024-01-15',
        installments: 3,
        current_installment: null,
        parent_transaction_id: null,
      };

      const installments = Array.from({ length: 3 }, (_, i) => ({
        id: `installment-${i + 1}`,
        user_id: mockUser.id,
        account_id: mockAccount.id,
        amount: 4000,
        description: `Purchase in 3x (${i + 1}/3)`,
        date: new Date(2024, i, 15).toISOString(),
        installments: 3,
        current_installment: i + 1,
        parent_transaction_id: parentTransaction.id,
      }));

      const { result } = renderHook(() => useTransactionStore());

      await act(async () => {
        result.current.addTransactions([parentTransaction as any, ...installments as any]);
      });

      expect(result.current.transactions).toHaveLength(4);
      
      const childInstallments = result.current.transactions.filter(
        t => t.parent_transaction_id === 'parent-123'
      );
      expect(childInstallments).toHaveLength(3);
      expect(childInstallments.every(t => t.amount === 4000)).toBe(true);
    });
  });
});
