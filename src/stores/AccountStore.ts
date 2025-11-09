import { create } from 'zustand';
import { Account } from '@/types';
// 1. Importar apenas o Supabase
import { supabase } from '@/integrations/supabase/client';
// (O import 'useAuth' foi removido, pois ele é um hook e não pode ser usado aqui)

// Define o tipo de dados que o formulário envia (sem id, user_id, etc.)
type AddAccountPayload = Omit<Account, 'id' | 'user_id' | 'created_at'>;

interface AccountStoreState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (payload: AddAccountPayload) => Promise<void>;
  updateAccounts: (updatedAccounts: Account | Account[]) => void;
  removeAccount: (accountId: string) => void;
}

/**
 * Store global para gerenciar as contas do usuário.
 */
export const useAccountStore = create<AccountStoreState>((set) => ({
  accounts: [],

  /**
   * Define a lista inteira de contas (usado na carga inicial).
   */
  setAccounts: (accounts) => set({ accounts }),

  /**
   * Adiciona uma nova conta ao banco de dados e, em seguida, ao estado local.
   */
  addAccount: async (payload) => {
    // 3. Obter o usuário logado DIRETAMENTE do Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Erro ao obter usuário:", authError);
      throw new Error("Usuário não autenticado");
    }

    // 4. Inserir no banco de dados
    const { data: newAccount, error: insertError } = await supabase
      .from("accounts")
      .insert({
        ...payload,
        user_id: user.id, // Adiciona o ID do usuário
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao adicionar conta no Supabase:", insertError);
      throw insertError;
    }

    if (newAccount) {
      // 5. Adicionar a conta retornada pelo DB (com ID) ao estado local
      set((state) => ({
        accounts: [...state.accounts, newAccount as Account],
      }));
    }
  },

  /**
   * Atualiza uma ou mais contas na lista.
   * Aceita um único objeto Account ou um array de Accounts.
   */
  updateAccounts: (updatedAccounts) =>
    set((state) => {
      // Garante que estamos trabalhando com um array
      const accountsToUpdate = Array.isArray(updatedAccounts)
        ? updatedAccounts
        : [updatedAccounts];

      // Cria um Map para consulta rápida dos IDs das contas atualizadas
      const updatedMap = new Map(accountsToUpdate.map((acc) => [acc.id, acc]));

      // Mapeia as contas existentes, substituindo as que foram atualizadas
      const newAccounts = state.accounts.map(
        (account) => updatedMap.get(account.id) || account
      );

      return { accounts: newAccounts };
    }),

  /**
   * Remove uma conta da lista pelo ID.
   */
  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== accountId),
    })),
}));