import { create } from 'zustand'
import { supabase } from '@/integrations/supabase/client'
import {
  Account,
  Category,
  Transaction,
  CreateTransaction,
  CreateTransfer,
} from '@/integrations/supabase/types'
//
// CORREÇÃO: A sintaxe de alias foi movida para dentro das chaves {}.
//
import { toast as sonnerToast } from 'sonner'

// Tipos para o estado
export interface AccountStoreState {
  accounts: Account[]
  categories: Category[]
  loading: boolean
  error: string | null
  loadAccounts: () => Promise<void>
  loadCategories: () => Promise<void>
  createTransaction: (
    tx: CreateTransaction,
    onSuccess?: () => void
  ) => Promise<void>
  createTransfer: (
    transfer: CreateTransfer,
    onSuccess?: () => void
  ) => Promise<void>
}

// NOTA DO PROGRAMADOR:
// Refatorado para o hook 'create' padrão do Zustand.
// O 'useSyncExternalStore' manual era desnecessário e propenso a erros.
// Agora, basta usar 'useAccountStore' nos componentes.

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  accounts: [],
  categories: [],
  loading: false,
  error: null,

  /**
   * Carrega contas do banco de dados.
   * Os saldos (balance, initial_balance) já virão como BIGINT (centavos).
   * O frontend TypeScript os tratará como 'number'.
   */
  loadAccounts: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name')

      if (error) throw error
      set({ accounts: data || [] })
    } catch (error: any) {
      console.error('Erro ao carregar contas:', error.message)
      set({ error: error.message })
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Carrega categorias do banco de dados.
   */
  loadCategories: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      set({ categories: data || [] })
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error.message)
      set({ error: error.message })
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Cria uma nova transação.
   * NOTA CONTÁBIL: Esta função espera 'amount' em CENTAVOS (ex: 1050)
   * e 'date' como string 'YYYY-MM-DD'.
   */
  createTransaction: async (tx, onSuccess) => {
    try {
      const { error } = await supabase.from('transactions').insert(tx)
      if (error) throw error

      sonnerToast.toast('Transação salva com sucesso!')
      onSuccess?.()
      // Recarrega as contas para atualizar os saldos
      get().loadAccounts()
    } catch (error: any) {
      console.error('Erro ao criar transação:', error.message)
      sonnerToast.toast('Erro ao salvar transação.', {
        description: error.message,
      })
    }
  },

  /**
   * Cria uma transferência (que chama uma RPC no Supabase).
   * NOTA CONTÁBIL: Esta função espera 'p_amount' em CENTAVOS (ex: 1050)
   * e 'p_date' como string 'YYYY-MM-DD'.
   */
  createTransfer: async (transfer, onSuccess) => {
    try {
      const { error } = await supabase.rpc('create_transfer_transaction', {
        p_from_account_id: transfer.fromAccountId,
        p_to_account_id: transfer.toAccountId,
        p_amount: transfer.amount, // Deve estar em centavos
        p_date: transfer.date, // Deve ser 'YYYY-MM-DD'
      })

      if (error) throw error

      sonnerToast.toast('Transferência realizada com sucesso!')
      onSuccess?.()
      // Recarrega as contas para atualizar os saldos
      get().loadAccounts()
    } catch (error: any) {
      console.error('Erro ao criar transferência:', error.message)
      sonnerToast.toast('Erro ao realizar transferência.', {
        description: error.message,
      })
    }
  },
}))