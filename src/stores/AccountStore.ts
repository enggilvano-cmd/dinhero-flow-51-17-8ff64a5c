import { create } from 'zustand';
import { Account, Transaction } from '@/types';
import { supabase } from '@/integrations/supabase/client';
// 1. Importar o store de transações
import { useTransactionStore } from './TransactionStore';

type AddAccountPayload = Omit<Account, 'id' | 'user_id' | 'created_at'>;

// 2. Define os parâmetros para a função de pagamento
interface PayBillParams {
  creditCardAccountId: string;
  debitAccountId: string;
  amount: number;
  paymentDate: string; // Formato "YYYY-MM-DD"
}

interface AccountStoreState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (payload: AddAccountPayload) => Promise<void>;
  updateAccounts: (updatedAccounts: Account | Account[]) => void;
  removeAccount: (accountId: string) => void;
  // 3. Adiciona a nova ação de pagamento ao state
  payCreditCardBill: (params: PayBillParams) => Promise<{
    updatedCreditAccount: Account;
    updatedDebitAccount: Account;
  }>;
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  accounts: [],

  setAccounts: (accounts) => set({ accounts }),

  addAccount: async (payload) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Erro ao obter usuário:", authError);
      throw new Error("Usuário não autenticado");
    }

    const { data: newAccount, error: insertError } = await supabase
      .from("accounts")
      .insert({
        ...payload,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao adicionar conta no Supabase:", insertError);
      throw insertError;
    }

    if (newAccount) {
      set((state) => ({
        accounts: [...state.accounts, newAccount as Account],
      }));
    }
  },

  updateAccounts: (updatedAccounts) =>
    set((state) => {
      const accountsToUpdate = Array.isArray(updatedAccounts)
        ? updatedAccounts
        : [updatedAccounts];
      const updatedMap = new Map(accountsToUpdate.map((acc) => [acc.id, acc]));
      const newAccounts = state.accounts.map(
        (account) => updatedMap.get(account.id) || account
      );
      return { accounts: newAccounts };
    }),

  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== accountId),
    })),

  // --- ADICIONANDO A LÓGICA DE PAGAMENTO ---
  payCreditCardBill: async ({
    creditCardAccountId,
    debitAccountId,
    amount,
    paymentDate,
  }: PayBillParams) => {
    // A. Obter dados essenciais
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    const { accounts } = get();
    const debitAccount = accounts.find(a => a.id === debitAccountId);
    const creditCardAccount = accounts.find(a => a.id === creditCardAccountId);

    if (!debitAccount || !creditCardAccount) {
      throw new Error("Conta de débito ou crédito não encontrada");
    }

    // B. Criar as DUAS transações (Débito e Crédito)
    const debitTransaction = {
      type: 'expense',
      amount,
      account_id: debitAccountId,
      description: `Pagamento Fatura ${creditCardAccount.name}`,
      date: paymentDate,
      user_id: user.id,
      category_id: null,
    };

    const creditTransaction = {
      type: 'income', // Pagamento é uma 'receita' para o cartão
      amount,
      account_id: creditCardAccountId,
      description: `Pagamento Recebido de ${debitAccount.name}`,
      date: paymentDate,
      user_id: user.id,
      category_id: null,
    };

    // C. Salvar AMBAS as transações no DB
    const { data: insertedTransactions, error: transactionError } = await supabase
      .from('transactions')
      .insert([debitTransaction, creditTransaction])
      .select()
      .returns<Transaction[]>();

    if (transactionError || !insertedTransactions || insertedTransactions.length !== 2) {
      console.error("Erro ao salvar transações de pagamento:", transactionError);
      throw new Error("Falha ao registrar transações de pagamento.");
    }

    // D. Atualizar o estado local (Stores)
    useTransactionStore.getState().addTransactions(insertedTransactions);

    let updatedDebitAccount: Account | undefined;
    let updatedCreditAccount: Account | undefined;

    // Atualiza o saldo localmente (o cálculo em dateUtils fará o resto)
    set((state) => {
      const newAccounts = state.accounts.map(acc => {
        if (acc.id === debitAccountId) {
          updatedDebitAccount = { ...acc, balance: acc.balance - amount };
          return updatedDebitAccount;
        }
        if (acc.id === creditCardAccountId) {
          updatedCreditAccount = { ...acc, balance: acc.balance + amount };
          return updatedCreditAccount;
        }
        return acc;
      });
      return { accounts: newAccounts };
    });

    if (!updatedCreditAccount || !updatedDebitAccount) {
       throw new Error("Falha ao atualizar contas no estado local.");
    }
    
    // E. Retornar as contas atualizadas para o modal
    return { updatedCreditAccount, updatedDebitAccount };
  },
}));