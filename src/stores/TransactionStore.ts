import { create } from 'zustand';
import { Transaction } from '@/types'; 
import { createDateFromString } from '@/lib/dateUtils'; // Importar o utilitário de data robusto

// A interface AppTransaction garante que 'date' é um objeto Date
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
  
  /**
   * Define a lista inteira (usado na carga inicial).
   * Converte Transaction[] (com datas em string/null) para AppTransaction[]
   */
  setTransactions: (transactions) => set({ 
    transactions: transactions.map(t => ({
      ...t,
      date: createDateFromString(t.date) // Converte string/null para Date
    }))
  }),

  /**
   * Adiciona uma ou mais transações (que já foram salvas no DB)
   */
  addTransactions: (newTransactions) => set((state) => ({
    transactions: [
      ...state.transactions,
      ...newTransactions.map(t => ({ 
        ...t, // A data pode ser string, Date ou null
        // Se a data já for um objeto Date, createDateFromString a retornará como está.
        // A tipagem (Transaction | AppTransaction)[] já garante que t.date é compatível.
        date: createDateFromString(t.date)
      }))
    ]
  })),

  /**
   * Atualiza uma única transação na lista.
   */
  updateTransaction: (updatedTransaction) => set((state) => ({
    transactions: state.transactions.map(t => 
      t.id === updatedTransaction.id ? {
        ...updatedTransaction, 
        date: createDateFromString(updatedTransaction.date) // Converte
      } : t
    )
  })),

  /**
   * Atualiza várias transações de uma vez.
   */
  updateTransactions: (updatedTransactions) => set((state) => {
    const updatedMap = new Map(
      updatedTransactions.map(t => [
        t.id, 
        { 
          ...t, 
          date: createDateFromString(updatedTransaction.date) // Converte
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
   * Remove várias transações da lista.
   */
  removeTransactions: (transactionIds) => {
    const idSet = new Set(transactionIds);
    set((state) => ({
      transactions: state.transactions.filter(t => !idSet.has(t.id))
    }));
  },
}));