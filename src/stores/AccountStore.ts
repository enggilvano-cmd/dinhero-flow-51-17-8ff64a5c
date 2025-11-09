import { create } from 'zustand';
import { Account, Transaction } from '@/types';
import { supabase } from '@/integrations/supabase/client';
// 1. Importar o store de transações e o formatador de data
import { useTransactionStore } from './TransactionStore';
import { format } from 'date-fns';

type AddAccountPayload = Omit<Account, 'id' | 'user_id' | 'created_at'>;

// 2. Define os parâmetros para a função de pagamento
interface PayBillParams {
  creditCardAccountId: string;
  debitAccountId: string;
  amount: number;
  paymentDate: string; // Formato "YYYY-MM-DD"
}

// 4. Define os parâmetros para a função de transferência
interface TransferParams {
  fromAccountId: string;
  toAccountId: string;
  amountInCents: number;
  date: Date; // O Modal passa um objeto Date
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
  // 5. Adiciona a nova ação de transferência ao state
  transferBetweenAccounts: (params: TransferParams) => Promise<{
    fromAccount: Account;
    toAccount: Account;
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
        (account) => updatedMap.get(account.id) || account,
      );
      return { accounts: newAccounts };
    }),

  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== accountId),
    })),

  // --- LÓGICA DE PAGAMENTO (Existente) ---
  payCreditCardBill: async ({
    creditCardAccountId,
    debitAccountId,
    amount,
    paymentDate,
  }: PayBillParams) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    const { accounts } = get();
    const debitAccount = accounts.find((a) => a.id === debitAccountId);
    const creditCardAccount = accounts.find(
      (a) => a.id === creditCardAccountId,
    );

    if (!debitAccount || !creditCardAccount) {
      throw new Error("Conta de débito ou crédito não encontrada");
    }

    const debitTransaction = {
      type: "expense",
      amount,
      account_id: debitAccountId,
      description: `Pagamento Fatura ${creditCardAccount.name}`,
      date: paymentDate,
      user_id: user.id,
      category_id: null,
    };

    const creditTransaction = {
      type: "income", // Pagamento é uma 'receita' para o cartão
      amount,
      account_id: creditCardAccountId,
      description: `Pagamento Recebido de ${debitAccount.name}`,
      date: paymentDate,
      user_id: user.id,
      category_id: null,
    };

    const { data: insertedTransactions, error: transactionError } =
      await supabase
        .from("transactions")
        .insert([debitTransaction, creditTransaction])
        .select()
        .returns<Transaction[]>();

    if (
      transactionError ||
      !insertedTransactions ||
      insertedTransactions.length !== 2
    ) {
      console.error(
        "Erro ao salvar transações de pagamento:",
        transactionError,
      );
      throw new Error("Falha ao registrar transações de pagamento.");
    }

    useTransactionStore.getState().addTransactions(insertedTransactions);

    let updatedDebitAccount: Account | undefined;
    let updatedCreditAccount: Account | undefined;

    set((state) => {
      const newAccounts = state.accounts.map((acc) => {
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

    return { updatedCreditAccount, updatedDebitAccount };
  },

  // --- NOVA LÓGICA DE TRANSFERÊNCIA ---
  transferBetweenAccounts: async ({
    fromAccountId,
    toAccountId,
    amountInCents,
    date,
  }: TransferParams) => {
    // A. Obter dados essenciais
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    const { accounts } = get();
    const fromAccount = accounts.find((a) => a.id === fromAccountId);
    const toAccount = accounts.find((a) => a.id === toAccountId);

    if (!fromAccount || !toAccount) {
      throw new Error("Conta de origem ou destino não encontrada");
    }

    // Formata o Date para string "YYYY-MM-DD"
    const dateString = format(date, "yyyy-MM-dd");

    // B. Criar as DUAS transações (com 'to_account_id' para rastreio)
    const debitTransaction = {
      type: "expense",
      amount: amountInCents,
      account_id: fromAccountId,
      description: `Transferência para ${toAccount.name}`,
      date: dateString,
      user_id: user.id,
      category_id: null, // Transferências não usam categoria
      to_account_id: toAccountId, // Campo para identificar a transferência
    };

    const creditTransaction = {
      type: "income",
      amount: amountInCents,
      account_id: toAccountId,
      description: `Transferência de ${fromAccount.name}`,
      date: dateString,
      user_id: user.id,
      category_id: null,
      to_account_id: fromAccountId, // Campo para identificar a transferência
    };

    // C. Salvar AMBAS as transações no DB
    const { data: insertedTransactions, error: transactionError } =
      await supabase
        .from("transactions")
        .insert([debitTransaction, creditTransaction])
        .select()
        .returns<Transaction[]>();

    if (
      transactionError ||
      !insertedTransactions ||
      insertedTransactions.length !== 2
    ) {
      console.error(
        "Erro ao salvar transações de transferência:",
        transactionError,
      );
      throw new Error("Falha ao registrar transações de transferência.");
    }

    // D. Atualizar o estado local (Stores)
    useTransactionStore.getState().addTransactions(insertedTransactions);

    let updatedFromAccount: Account | undefined;
    let updatedToAccount: Account | undefined;

    // Atualiza o saldo localmente
    set((state) => {
      const newAccounts = state.accounts.map((acc) => {
        if (acc.id === fromAccountId) {
          updatedFromAccount = {
            ...acc,
            balance: acc.balance - amountInCents,
          };
          return updatedFromAccount;
        }
        if (acc.id === toAccountId) {
          updatedToAccount = { ...acc, balance: acc.balance + amountInCents };
          return updatedToAccount;
        }
        return acc;
      });
      return { accounts: newAccounts };
    });

    if (!updatedFromAccount || !updatedToAccount) {
      throw new Error("Falha ao atualizar contas no estado local.");
    }

    // E. Retornar as contas atualizadas para o modal
    return { fromAccount: updatedFromAccount, toAccount: updatedToAccount };
  },
}));