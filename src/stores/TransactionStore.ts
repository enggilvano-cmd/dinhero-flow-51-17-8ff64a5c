import { create } from 'zustand';
import { Transaction } from '@/types'; // Assumindo que seu tipo 'Transaction' está em @/types
import { createDateFromString } from '@/lib/dateUtils'; // Importar o utilitário de data

// Ajusta a interface Transaction para garantir que 'date' seja um objeto Date
interface AppTransaction extends Omit<Transaction, 'date'> {
  date: Date;
}

interface TransactionStoreState {
  transactions: AppTransaction[];
  setTransactions: (transactions: AppTransaction[]) => void;
  addTransactions: (newTransactions: AppTransaction[]) => void;
  updateTransaction: (updatedTransaction: AppTransaction) => void;
  updateTransactions: (updatedTransactions: AppTransaction[]) => void;
  removeTransaction: (transactionId: string) => void;
  removeTransactions: (transactionIds: string[]) => void;
}

export const useTransactionStore = create<TransactionStoreState>((set) => ({
  transactions: [],
  
  /**
   * Define a lista inteira (usado na carga inicial).
   */
  setTransactions: (transactions) => set({ 
    // Garante que todas as datas sejam objetos Date
    transactions: transactions.map(t => ({
      ...t,
      date: typeof t.date === 'string' ? createDateFromString(t.date) : t.date
    }))
  }),

  /**
   * Adiciona uma ou mais transações (que já foram salvas no DB)
   */
  addTransactions: (newTransactions) => set((state) => ({
    transactions: [
      ...state.transactions,
      ...newTransactions.map(t => ({ // Garante a conversão de data
        ...t,
        date: typeof t.date === 'string' ? createDateFromString(t.date) : t.date
      }))
    ]
  })),

  /**
   * Atualiza uma única transação na lista.
   */
  updateTransaction: (updatedTransaction) => set((state) => ({
    transactions: state.transactions.map(t => 
      t.id === updatedTransaction.id ? {
        ...updatedTransaction, // Garante a conversão de data
        date: typeof updatedTransaction.date === 'string' 
          ? createDateFromString(updatedTransaction.date) 
          : updatedTransaction.date
      } : t
    )
  })),

  /**
   * Atualiza várias transações de uma vez (mais eficiente).
   */
  updateTransactions: (updatedTransactions) => set((state) => {
    const updatedMap = new Map(
      updatedTransactions.map(t => [
        t.id, 
        { // Garante a conversão de data
          ...t, 
          date: typeof t.date === 'string' ? createDateFromString(t.date) : t.date 
        }
      ])
    );
    return {
      transactions: state.transactions.map(t => updatedMap.get(t.id) || t)
    };
  }),

  /**
   * Remove uma transação da lista.
   */
  removeTransaction: (transactionId) => set((state) => ({
    transactions: state.transactions.filter(t => t.id !== transactionId)
  })),

  /**
   * Remove várias transações da lista (ex: exclusão de parcelas).
   */
  removeTransactions: (transactionIds) => {
    const idSet = new Set(transactionIds);
    set((state) => ({
      transactions: state.transactions.filter(t => !idSet.has(t.id))
    }));
  },
}));