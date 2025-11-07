import { create } from 'zustand';
import { Account } from '@/types'; // Assumindo que seu tipo 'Account' está em @/types

// Define a interface para o estado e ações do store
interface AccountStoreState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
}

/**
 * Store global para gerenciar as contas do usuário.
 * * NOTA ARQUITETURAL IMPORTANTE:
 * Com a migração da lógica de saldo (balance) para os triggers do Supabase,
 * este store NÃO DEVE MAIS ser usado para gerenciar ou calcular saldos.
 * * O 'balance' em 'accounts' é apenas um snapshot pego do banco de dados.
 * * **Padrão Correto de Atualização:**
 * 1. O cliente executa uma mutação (ex: cria uma transação).
 * 2. A mutação (useMutation) é concluída com sucesso.
 * 3. No 'onSuccess' da mutação, o cliente NÃO atualiza o store localmente.
 * 4. Em vez disso, o cliente invalida as queries do 'react-query' relacionadas
 * (ex: 'accounts', 'transactions').
 * 5. O 'react-query' automaticamente busca os dados frescos do banco de dados,
 * que contêm o saldo correto calculado pelo trigger.
 * 6. O 'setAccounts' é chamado com os novos dados do 'react-query'.
 */
export const useAccountStore = create<AccountStoreState>((set) => ({
  accounts: [],
  
  /**
   * Define a lista inteira de contas (usado na carga inicial).
   */
  setAccounts: (accounts) => set({ accounts }),

  /**
   * Adiciona uma nova conta à lista.
   * (Usado após a criação de uma nova conta no banco)
   */
  addAccount: (account) => set((state) => ({
    accounts: [...state.accounts, account]
  })),

  /**
   * Remove uma conta da lista pelo ID.
   * (Usado após deletar uma conta no banco)
   */
  removeAccount: (accountId) => set((state) => ({
    accounts: state.accounts.filter(account => account.id !== accountId)
  })),
}));