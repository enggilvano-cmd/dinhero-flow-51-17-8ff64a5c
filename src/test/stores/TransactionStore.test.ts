import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionStore } from '@/stores/TransactionStore';
import type { Transaction } from '@/types';

describe('TransactionStore', () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: [] });
  });

  describe('setTransactions', () => {
    it('should set transactions list and convert dates', () => {
      const mockTransactions: Transaction[] = [
        {
          id: '1',
          description: 'Salário',
          amount: 5000,
          date: '2024-01-15',
          type: 'income',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any
      ];

      useTransactionStore.getState().setTransactions(mockTransactions);
      
      const transactions = useTransactionStore.getState().transactions;
      expect(transactions).toHaveLength(1);
      expect(transactions[0].date).toBeInstanceOf(Date);
    });
  });

  describe('addTransactions', () => {
    it('should add new transactions', () => {
      const newTransactions: Transaction[] = [
        {
          id: '2',
          description: 'Compra Supermercado',
          amount: -150,
          date: '2024-01-16',
          type: 'expense',
          account_id: 'acc1',
          category_id: 'cat1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any
      ];

      useTransactionStore.getState().addTransactions(newTransactions);
      
      expect(useTransactionStore.getState().transactions).toHaveLength(1);
      expect(useTransactionStore.getState().transactions[0].amount).toBe(-150);
    });
  });

  describe('updateTransaction', () => {
    it('should update a transaction', () => {
      const transaction: Transaction = {
        id: '1',
        description: 'Descrição Original',
        amount: 100,
        date: '2024-01-15',
        type: 'expense',
        account_id: 'acc1',
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        user_id: 'user1'
      } as any;

      useTransactionStore.getState().setTransactions([transaction]);
      
      const updated = { ...transaction, description: 'Descrição Atualizada', amount: 200 };
      useTransactionStore.getState().updateTransaction(updated);
      
      const result = useTransactionStore.getState().transactions[0];
      expect(result.description).toBe('Descrição Atualizada');
      expect(result.amount).toBe(200);
    });
  });

  describe('updateTransactions', () => {
    it('should update multiple transactions', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          description: 'Trans 1',
          amount: 100,
          date: '2024-01-15',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any,
        {
          id: '2',
          description: 'Trans 2',
          amount: 200,
          date: '2024-01-16',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any
      ];

      useTransactionStore.getState().setTransactions(transactions);
      
      const updates = [
        { ...transactions[0], amount: 150 },
        { ...transactions[1], amount: 250 }
      ];
      
      useTransactionStore.getState().updateTransactions(updates);
      
      const result = useTransactionStore.getState().transactions;
      expect(result[0].amount).toBe(150);
      expect(result[1].amount).toBe(250);
    });
  });

  describe('removeTransaction', () => {
    it('should remove a transaction by id', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          description: 'Trans 1',
          amount: 100,
          date: '2024-01-15',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any,
        {
          id: '2',
          description: 'Trans 2',
          amount: 200,
          date: '2024-01-16',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any
      ];

      useTransactionStore.getState().setTransactions(transactions);
      useTransactionStore.getState().removeTransaction('1');
      
      expect(useTransactionStore.getState().transactions).toHaveLength(1);
      expect(useTransactionStore.getState().transactions[0].id).toBe('2');
    });
  });

  describe('removeTransactions', () => {
    it('should remove multiple transactions at once', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          description: 'Trans 1',
          amount: 100,
          date: '2024-01-15',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any,
        {
          id: '2',
          description: 'Trans 2',
          amount: 200,
          date: '2024-01-16',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any,
        {
          id: '3',
          description: 'Trans 3',
          amount: 300,
          date: '2024-01-17',
          type: 'expense',
          account_id: 'acc1',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'user1'
        } as any
      ];

      useTransactionStore.getState().setTransactions(transactions);
      useTransactionStore.getState().removeTransactions(['1', '3']);
      
      const result = useTransactionStore.getState().transactions;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });

  describe('installment transactions', () => {
    it('should handle installment transactions', () => {
      const installment: Transaction = {
        id: '1',
        description: 'Compra Parcelada',
        amount: 300,
        date: '2024-01-15',
        type: 'expense',
        account_id: 'acc1',
        status: 'completed',
        installments: 3,
        current_installment: 1,
        parent_transaction_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        user_id: 'user1'
      } as any;

      useTransactionStore.getState().addTransactions([installment]);
      
      const result = useTransactionStore.getState().transactions[0];
      expect(result.installments).toBe(3);
      expect(result.current_installment).toBe(1);
    });
  });

  describe('recurring transactions', () => {
    it('should handle recurring transactions', () => {
      const recurring: Transaction = {
        id: '1',
        description: 'Assinatura Netflix',
        amount: -39.90,
        date: '2024-01-15',
        type: 'expense',
        account_id: 'acc1',
        status: 'completed',
        is_recurring: true,
        recurrence_type: 'monthly',
        recurrence_end_date: '2024-12-31',
        created_at: new Date(),
        updated_at: new Date(),
        user_id: 'user1'
      } as any;

      useTransactionStore.getState().addTransactions([recurring]);
      
      const result = useTransactionStore.getState().transactions[0];
      expect(result.is_recurring).toBe(true);
      expect(result.recurrence_type).toBe('monthly');
    });
  });
});
