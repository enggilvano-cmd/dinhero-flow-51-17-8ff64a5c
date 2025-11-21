import { create } from 'zustand';
import { Transaction } from '@/types'; 
import { createDateFromString } from '@/lib/dateUtils';

export interface AppTransaction extends Omit<Transaction, 'date'> {
  date: Date;
}

interface TransactionStoreState {
  transactions: AppTransaction[];
  setTransactions: (transactions: Transaction[]) => void;
  addTransactions: (newTransactions: (Transaction | AppTransaction)[]) => void;
  updateTransaction: (updatedTransaction: Transaction) => void;
  updateTransactions: (updatedTransactions: Transaction[]) => void;
  removeTransaction: (transactionId: string) => void;
  removeTransactions: (transactionIds: string[]) => void;
}

export const useTransactionStore = create<TransactionStoreState>((set) => ({
  transactions: [],
  
  setTransactions: (transactions) => set({ 
    transactions: transactions.map(t => ({
      ...t,
      date: createDateFromString(t.date)
    }))
  }),

  addTransactions: (newTransactions) => set((state) => ({
    transactions: [
      ...state.transactions,
      ...newTransactions.map(t => ({ 
        ...t,
        date: createDateFromString(t.date)
      }))
    ]
  })),

  updateTransaction: (updatedTransaction) => set((state) => ({
    transactions: state.transactions.map(t => 
      t.id === updatedTransaction.id ? {
        ...updatedTransaction, 
        date: createDateFromString(updatedTransaction.date)
      } : t
    )
  })),

  updateTransactions: (updatedTransactions) => set((state) => {
    const updatedMap = new Map(
      updatedTransactions.map(t => [
        t.id, 
        { 
          ...t, 
          date: createDateFromString(t.date)
        }
      ])
    );
    return {
      transactions: state.transactions.map(t => updatedMap.get(t.id) || t)
    };
  }),

  removeTransaction: (transactionId) => set((state) => ({
    transactions: state.transactions.filter(t => t.id !== transactionId)
  })),

  removeTransactions: (transactionIds) => {
    const idSet = new Set(transactionIds);
    set((state) => ({
      transactions: state.transactions.filter(t => !idSet.has(t.id))
    }));
  },
}));
