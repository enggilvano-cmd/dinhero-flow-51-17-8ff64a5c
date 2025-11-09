import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/components/Dashboard";
import { AccountsPage } from "@/components/AccountsPage";
import { CreditBillsPage } from "@/components/CreditBillsPage";
import { TransactionsPage } from "@/components/TransactionsPage";
import { CategoriesPage } from "@/components/CategoriesPage";
import AnalyticsPage from "@/components/AnalyticsPage";
import SystemSettings from "@/components/SystemSettings";
import { SettingsPage } from "@/components/SettingsPage";
import { UserManagement } from "@/components/UserManagement";
import { UserProfile } from "@/components/UserProfile";
import { AddAccountModal } from "@/components/AddAccountModal";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { EditAccountModal } from "@/components/EditAccountModal";
import { EditTransactionModal } from "@/components/EditTransactionModal";
import {
  InstallmentEditScopeDialog,
  EditScope,
} from "@/components/InstallmentEditScopeDialog";
import { TransferModal } from "@/components/TransferModal";
import { CreditPaymentModal } from "@/components/CreditPaymentModal";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MigrationWarning } from "@/components/MigrationWarning";
import { createDateFromString } from "@/lib/dateUtils";
import { useAccountStore } from "@/stores/AccountStore";
import { useTransactionStore, AppTransaction } from "@/stores/TransactionStore"; // Importa AppTransaction
import { Account, Transaction } from "@/types";

const PlaniFlowApp = () => {
  const { settings, updateSettings } = useSettings();
  const { user, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState("dashboard");

  // Lendo o estado global dos stores
  const accounts = useAccountStore((state) => state.accounts);
  const setGlobalAccounts = useAccountStore((state) => state.setAccounts);
  const updateGlobalAccounts = useAccountStore(
    (state) => state.updateAccounts
  );
  const removeGlobalAccount = useAccountStore((state) => state.removeAccount);

  const transactions = useTransactionStore((state) => state.transactions);
  const setGlobalTransactions = useTransactionStore(
    (state) => state.setTransactions
  );
  const addGlobalTransactions = useTransactionStore(
    (state) => state.addTransactions
  );
  const updateGlobalTransaction = useTransactionStore(
    (state) => state.updateTransaction
  );
  const updateGlobalTransactions = useTransactionStore(
    (state) => state.updateTransactions
  );
  const removeGlobalTransaction = useTransactionStore(
    (state) => state.removeTransaction
  );
  const removeGlobalTransactions = useTransactionStore(
    (state) => state.removeTransactions
  );

  const [categories, setCategories] = useState<any[]>([]);

  // Modal states
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addTransactionModalOpen, setAddTransactionModalOpen] = useState(false);
  const [editAccountModalOpen, setEditAccountModalOpen] = useState(false);
  const [editTransactionModalOpen, setEditTransactionModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [creditPaymentModalOpen, setCreditPaymentModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [payingCreditAccount, setPayingCreditAccount] = useState<any | null>(
    null
  );
  const [loadingData, setLoadingData] = useState(true);
  
  const [currentInvoiceValue, setCurrentInvoiceValue] = useState(0);
  const [nextInvoiceValue, setNextInvoiceValue] = useState(0);
  const [payingTotalDebt, setPayingTotalDebt] = useState(0);
  
  const [transactionFilterType, setTransactionFilterType] = useState<
    "income" | "expense" | "transfer" | "all"
  >("all");
  const [transactionFilterStatus, setTransactionFilterStatus] = useState<
    "all" | "pending" | "completed"
  >("all");
  const [transactionDateFilter, setTransactionDateFilter] = useState<
    "all" | "current_month" | "custom" | "month_picker"
  >("all");
  const [transactionFilterAccountType, setTransactionFilterAccountType] =
    useState<"all" | "checking" | "savings" | "credit">("all");
  const [accountFilterType, setAccountFilterType] = useState<
    "all" | "checking" | "savings" | "credit" | "investment"
  >("all");

  const [transactionSelectedMonth, setTransactionSelectedMonth] = useState<
    Date | undefined
  >(undefined);
  const [transactionCustomStartDate, setTransactionCustomStartDate] = useState<
    Date | undefined
  >(undefined);
  const [transactionCustomEndDate, setTransactionCustomEndDate] = useState<
    Date | undefined
  >(undefined);

  const resetTransactionFilters = () => {
    setTransactionSelectedMonth(undefined);
    setTransactionCustomStartDate(undefined);
    setTransactionCustomEndDate(undefined);
  };

  // Load data from Supabase
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoadingData(true);
        // Load accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (accountsError) throw accountsError;
        const formattedAccounts = (accountsData || []).map((acc) => ({
          ...acc,
          limit: acc.limit_amount,
        }));
        setGlobalAccounts(formattedAccounts as Account[]);

        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id);

        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);

        // Load transactions
        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (transactionsError) throw transactionsError;
        const formattedTransactions = (transactionsData || []).map(
          (trans) => ({
            ...trans,
            // Mantém os nomes de colunas do DB
            // A conversão para camelCase é feita na store ou no componente
            date: createDateFromString(trans.date),
          })
        );
        setGlobalTransactions(formattedTransactions as Transaction[]);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user, setGlobalAccounts, setGlobalTransactions]);

  const handleEditAccount = async (updatedAccount: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("accounts")
        .update(updatedAccount)
        .eq("id", updatedAccount.id)
        .eq("user_id", user.id);
      if (error) throw error;
      updateGlobalAccounts(updatedAccount);
      setEditingAccount(null);
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  const handleAddTransaction = async (transactionData: any) => {
    if (!user) return;
    try {
      const mappedData = {
        description: transactionData.description,
        // CORREÇÃO: O 'amount' já vem com o sinal correto do modal.
        // Não é mais necessário aplicar a lógica de sinal aqui.
        amount: transactionData.amount, 
        date: transactionData.date.toISOString().split("T")[0],
        type: transactionData.type,
        account_id: transactionData.account_id,
        category_id: transactionData.category_id,
        status: transactionData.status,
        user_id: user.id,
        installments: transactionData.installments,
        current_installment: transactionData.currentInstallment,
        parent_transaction_id: transactionData.parentTransactionId, // <-- GARANTIR QUE ESTE CAMPO SEJA MAPEADO
      };

      const { data, error } = await supabase
        .from("transactions")
        .insert([mappedData])
        .select()
        .single();
      if (error) throw error;

      addGlobalTransactions([data as Transaction]);

      // Atualizar saldo da conta (apenas se 'completed')
      if (transactionData.status === 'completed') {
        // CORREÇÃO: O 'amount' já tem o sinal correto (+ para income, - para expense).
        // Apenas somamos este valor ao saldo existente.
        const balanceChange = transactionData.amount;
        const account = accounts.find(
          (acc) => acc.id === transactionData.account_id
        );
        if (account) {
          const newBalance = account.balance + balanceChange;
          // ... (validação de limite) ...
          await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", transactionData.account_id)
            .eq("user_id", user.id);
          updateGlobalAccounts({ ...account, balance: newBalance });
        }
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleAddInstallmentTransactions = async (transactionsData: any[]) => {
    if (!user) return;
    try {
      const transactionsToInsert = transactionsData.map((data) => ({
        description: data.description,
        amount: data.amount,
        date: data.date.toISOString().split("T")[0],
        type: data.type,
        account_id: data.account_id,
        category_id: data.category_id,
        status: data.status,
        installments: data.installments,
        current_installment: data.currentInstallment,
        parent_transaction_id: data.parentTransactionId,
        user_id: user.id,
      }));

      const { data: newTransactions, error } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)
        .select();
      if (error) throw error;

      addGlobalTransactions(newTransactions as Transaction[]);

      // Atualizar saldo (apenas para transações 'completed')
      const totalAmount = transactionsData.reduce((sum, trans) => {
        if (trans.status === "completed") {
          return sum + (trans.type === "income" ? trans.amount : -trans.amount);
        }
        return sum;
      }, 0);
      
      if (totalAmount !== 0) {
        const accountId = transactionsData[0].account_id;
        const account = accounts.find((acc) => acc.id === accountId);
        if (account) {
          const newBalance = account.balance + totalAmount;
          await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", accountId)
            .eq("user_id", user.id);
          updateGlobalAccounts({ ...account, balance: newBalance });
        }
      }
    } catch (error) {
      console.error("Error adding installment transactions:", error);
      throw error;
    }
  };

  const handleImportTransactions = async (transactionsData: any[]) => {
    if (!user) return;
    try {
      const transactionsToInsert = await Promise.all(
        transactionsData.map(async (data) => {
          let category_id = null;
          if (data.category) {
            const { data: existingCategory } = await supabase
              .from("categories")
              .select("id")
              .eq("user_id", user.id)
              .eq("name", data.category)
              .maybeSingle();
            if (existingCategory) {
              category_id = existingCategory.id;
            } else {
              const { data: newCategory } = await supabase
                .from("categories")
                .insert({
                  name: data.category,
                  user_id: user.id,
                  type: data.type === "income" ? "income" : "expense",
                })
                .select("id")
                .single();
              if (newCategory) {
                category_id = newCategory.id;
              }
            }
          }
          return {
            description: data.description,
            amount: data.amount,
            category_id,
            type: data.type,
            account_id: data.account_id,
            date: data.date,
            status: data.status,
            installments: data.installments,
            current_installment: data.current_installment,
            user_id: user.id,
          };
        })
      );

      const { data: newTransactions, error } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;

      addGlobalTransactions(newTransactions as Transaction[]);

      const accountBalanceChanges = transactionsData.reduce(
        (acc, trans) => {
          const balanceChange =
            trans.type === "income" ? trans.amount : -trans.amount;
          acc[trans.account_id] = (acc[trans.account_id] || 0) + balanceChange;
          return acc;
        },
        {} as Record<string, number>
      );

      const updatedAccountsList = [];
      for (const [accountId, balanceChange] of Object.entries(
        accountBalanceChanges
      )) {
        const account = accounts.find((acc) => acc.id === accountId);
        if (account && balanceChange) {
          const newBalance = account.balance + balanceChange;
          await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", accountId)
            .eq("user_id", user.id);
          updatedAccountsList.push({ ...account, balance: newBalance });
        }
      }

      updateGlobalAccounts(updatedAccountsList);
      toast({
        title: "Importação concluída",
        description: `${newTransactions.length} transações importadas com sucesso`,
      });
    } catch (error) {
      console.error("Error importing transactions:", error);
      toast({
        title: "Erro na importação",
        description: "Erro inesperado durante a importação",
        variant: "destructive",
      });
    }
  };

  const handleTransfer = async (
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: Date
  ) => {
    if (!user) throw new Error("Usuário não autenticado");

    try {
      const fromAccount = accounts.find((acc) => acc.id === fromAccountId);
      const toAccount = accounts.find((acc) => acc.id === toAccountId);
      if (!fromAccount || !toAccount) throw new Error("Contas não encontradas");

      const newFromBalance = fromAccount.balance - amount;
      const newToBalance = toAccount.balance + amount;

      if (
        fromAccount.type === "checking" &&
        newFromBalance < 0 &&
        fromAccount.limit_amount
      ) {
        if (Math.abs(newFromBalance) > fromAccount.limit_amount) {
          throw new Error(
            `Transferência excede o limite da conta ${
              fromAccount.name
            } de ${fromAccount.limit_amount.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}`
          );
        }
      }

      // --- CORREÇÃO: REMOVER parent_transaction_id DE TRANSFERÊNCIAS ---
      // E ADICIONAR linked_transaction_id
      
      // 1. Transação de Saída (Expense)
      const outgoingTransaction = {
        description: `Transferência para ${toAccount.name}`,
        amount: Math.abs(amount), // Garante positivo
        date: date.toISOString().split("T")[0],
        type: "expense" as const,
        category_id: null,
        account_id: fromAccountId,
        to_account_id: toAccountId,
        status: "completed" as const,
        user_id: user.id,
      };

      const { data: newOutgoingTransaction, error: outgoingError } = await supabase
        .from("transactions")
        .insert(outgoingTransaction)
        .select()
        .single();
        
      if (outgoingError) throw outgoingError;

      // 2. Transação de Entrada (Income)
      const incomingTransaction = {
        description: `Transferência de ${fromAccount.name}`,
        amount: Math.abs(amount), // Garante positivo
        date: date.toISOString().split("T")[0],
        type: "income" as const,
        category_id: null,
        account_id: toAccountId,
        to_account_id: fromAccountId,
        status: "completed" as const,
        user_id: user.id,
        linked_transaction_id: newOutgoingTransaction.id, // <-- VINCULA A TRANSAÇÃO
      };
      
      const { data: newIncomingTransaction, error: incomingError } = await supabase
        .from("transactions")
        .insert(incomingTransaction)
        .select()
        .single();

      if (incomingError) {
        // Reverte a primeira transação
        await supabase.from("transactions").delete().eq("id", newOutgoingTransaction.id);
        throw incomingError;
      }

      addGlobalTransactions([newOutgoingTransaction as Transaction, newIncomingTransaction as Transaction]);

      await Promise.all([
        supabase
          .from("accounts")
          .update({ balance: newFromBalance })
          .eq("id", fromAccountId)
          .eq("user_id", user.id),
        supabase
          .from("accounts")
          .update({ balance: newToBalance })
          .eq("id", toAccountId)
          .eq("user_id", user.id),
      ]);

      updateGlobalAccounts([
        { ...fromAccount, balance: newFromBalance },
        { ...toAccount, balance: newToBalance },
      ]);
    } catch (error) {
      console.error("Error processing transfer:", error);
      if (error instanceof Error) {
        toast({
          title: "Erro na transferência",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleEditTransaction = async (
    updatedTransaction: any,
    editScope?: EditScope
  ) => {
    if (!user) return;
    try {
      const oldTransaction = transactions.find(
        (t) => t.id === updatedTransaction.id
      );
      if (!oldTransaction) return;

      if (
        !editScope ||
        editScope === "current" ||
        !oldTransaction.parent_transaction_id // Não editar em lote se não for parcela
      ) {
        const cleanTransaction = {
          description: updatedTransaction.description,
          amount: updatedTransaction.amount,
          date:
            typeof updatedTransaction.date === "string"
              ? updatedTransaction.date
              : updatedTransaction.date.toISOString().split("T")[0],
          type: updatedTransaction.type,
          category_id: updatedTransaction.category_id,
          account_id: updatedTransaction.account_id,
          status: updatedTransaction.status || "completed",
        };

        const { error } = await supabase
          .from("transactions")
          .update(cleanTransaction)
          .eq("id", updatedTransaction.id)
          .eq("user_id", user.id);

        if (error) throw error;

        // Recalcular saldo da(s) conta(s) afetada(s)
        const accountsToRecalculate = new Set<string>([oldTransaction.account_id, updatedTransaction.account_id]);
        const updatedAccountsList = [];

        for (const accountId of accountsToRecalculate) {
          const account = accounts.find(acc => acc.id === accountId);
          if (account) {
            // Recalcula o saldo do zero
            const { data: refreshedTransactions, error: refreshError } = await supabase
              .from('transactions')
              .select('type, amount, status')
              .eq('user_id', user.id)
              .eq('account_id', accountId)
              .eq('status', 'completed');
            
            if (refreshError) throw refreshError;

            const newBalance = (refreshedTransactions || []).reduce((sum, t) => {
              return sum + (t.type === 'income' ? t.amount : -t.amount);
            }, 0);

            await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', accountId)
              .eq('user_id', user.id);
            
            updatedAccountsList.push({ ...account, balance: newBalance });
          }
        }
        
        updateGlobalAccounts(updatedAccountsList);
        updateGlobalTransaction(updatedTransaction);
        setEditingTransaction(null);
        return;
      }

      // Lógica para Edição em Lote (Parcelas)
      await handleInstallmentScopeEdit(
        updatedTransaction,
        editScope,
        oldTransaction
      );
    } catch (error) {
      console.error("Error updating transaction:", error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleInstallmentScopeEdit = async (
    updatedTransaction: any,
    editScope: EditScope,
    oldTransaction: any
  ) => {
    if (!user || !oldTransaction.parent_transaction_id) return;
    try {
      const cleanTransactionData = {
        description: updatedTransaction.description,
        amount: updatedTransaction.amount,
        type: updatedTransaction.type,
        category_id: updatedTransaction.category_id,
        account_id: updatedTransaction.account_id,
        status: updatedTransaction.status,
      };

      const baseDescription = oldTransaction.description.replace(
        / \(\d+\/\d+\)$/,
        ""
      );

      let queryBuilder = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("parent_transaction_id", oldTransaction.parent_transaction_id);

      if (editScope === "current-and-previous") {
        queryBuilder = queryBuilder.lte(
          "current_installment",
          oldTransaction.current_installment
        );
      } else if (editScope === "current-and-remaining") {
        queryBuilder = queryBuilder.gte(
          "current_installment",
          oldTransaction.current_installment
        );
      }

      const { data: targetTransactions, error: selectError } =
        await queryBuilder;

      if (selectError) throw selectError;
      if (!targetTransactions || targetTransactions.length === 0) return;

      const updates = targetTransactions.map((transaction) => {
        const updatedData = {
          ...cleanTransactionData,
          description: `${cleanTransactionData.description} (${transaction.current_installment}/${transaction.installments})`,
        };
        return supabase
          .from("transactions")
          .update(updatedData)
          .eq("id", transaction.id)
          .eq("user_id", user.id);
      });

      await Promise.all(updates);

      // Recarregar TUDO é a forma mais segura
      const { data: refreshedTransactions, error: refreshError } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

      if (refreshError) throw refreshError;
      
      const formattedTransactions = (refreshedTransactions || []).map((t) => ({
        ...t,
        date: createDateFromString(t.date),
      }));
      setGlobalTransactions(formattedTransactions as Transaction[]);

      // Recalcula o balanço da(s) conta(s) afetada(s)
      const accountIds = new Set<string>([oldTransaction.account_id, updatedTransaction.account_id]);
      const updatedAccountsList = [];
      
      for (const accountId of accountIds) {
        const account = accounts.find(acc => acc.id === accountId);
        if(account) {
          const newBalance = (refreshedTransactions || [])
            .filter(t => t.account_id === accountId && t.status === 'completed')
            .reduce((sum, t) => {
              return sum + (t.type === 'income' ? t.amount : -t.amount);
            }, 0);
            
          await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", accountId)
            .eq("user_id", user.id);
          
          updatedAccountsList.push({ ...account, balance: newBalance });
        }
      }
      updateGlobalAccounts(updatedAccountsList);

    } catch(error) {
      console.error("Error in batch edit:", error);
    } finally {
      setEditingTransaction(null);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", user.id);
      if (error) throw error;
      
      removeGlobalAccount(accountId);
      
      // Remove transações associadas do store
      const transactionsToRemove = transactions
        .filter(t => t.account_id === accountId)
        .map(t => t.id);
      removeGlobalTransactions(transactionsToRemove);

    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;

    try {
      const transactionToDelete = transactions.find(
        (trans) => trans.id === transactionId
      );
      if (!transactionToDelete) return;

      let transactionsToDelete = [transactionToDelete];
      let accountsToUpdate = new Map<string, number>(); // <accountId, balanceChange>

      const mainBalanceChange =
        transactionToDelete.type === "income"
          ? -transactionToDelete.amount
          : transactionToDelete.amount;
      accountsToUpdate.set(transactionToDelete.account_id, mainBalanceChange);

      if (transactionToDelete.parent_transaction_id) {
        const { data: linkedTransactions, error: findError } = await supabase
          .from("transactions")
          .select("*")
          .eq("parent_transaction_id", transactionToDelete.parent_transaction_id)
          .neq("id", transactionToDelete.id);

        if (findError) console.error("Erro ao buscar transação vinculada:", findError);

        if (linkedTransactions && linkedTransactions.length > 0) {
          for (const linkedTransaction of linkedTransactions) {
            transactionsToDelete.push(linkedTransaction);
            const linkedBalanceChange =
              linkedTransaction.type === "income"
                ? -linkedTransaction.amount
                : linkedTransaction.amount;
            
            const currentChange = accountsToUpdate.get(linkedTransaction.account_id) || 0;
            accountsToUpdate.set(linkedTransaction.account_id, currentChange + linkedBalanceChange);
          }
        }
      }

      const idsToDelete = transactionsToDelete.map(t => t.id);
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .in("id", idsToDelete)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      let updatedAccountsList = [];
      for (const [accountId, balanceChange] of accountsToUpdate.entries()) {
        const account = accounts.find((acc) => acc.id === accountId);
        if (account) {
          const newBalance = account.balance + balanceChange;
          await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", accountId)
            .eq("user_id", user.id);
          updatedAccountsList.push({ ...account, balance: newBalance });
        }
      }

      updateGlobalAccounts(updatedAccountsList);
      removeGlobalTransactions(idsToDelete);

    } catch (error) {
      console.error("Error deleting transaction(s):", error);
      toast({ title: "Erro ao estornar", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleUpdateSettings = (newSettings: typeof settings) => {
    console.log("Updating settings:", newSettings);
    updateSettings(newSettings);
  };

  const handleClearAllData = async () => {
    if (!user) return;
    try {
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.from("accounts").delete().eq("user_id", user.id);
      await supabase.from("categories").delete().eq("user_id", user.id);

      setGlobalAccounts([]);
      setGlobalTransactions([]);
      setCategories([]);

      toast({
        title: "Dados limpos",
        description: "Todos os dados foram removidos com sucesso",
      });
    } catch (error) {
      console.error("Error clearing data:", error);
      toast({
        title: "Erro",
        description: "Erro ao limpar dados",
        variant: "destructive",
      });
    }
  };

  const openEditAccount = (account: any) => {
    setEditingAccount(account);
    setEditAccountModalOpen(true);
  };

  // --- FUNÇÃO DE PAGAMENTO DE CRÉDITO (VERSÃO CORRIGIDA ÚNICA) ---
  const handleCreditPayment = async ({
    creditCardAccountId,
    debitAccountId,
    amount,
    paymentDate,
  }: {
    creditCardAccountId: string;
    debitAccountId: string;
    amount: number;
    paymentDate: string; // Recebe como string "YYYY-MM-DD"
  }): Promise<{ creditAccount: Account; bankAccount: Account }> => {
    if (!user) throw new Error("Usuário não autenticado");

    try {
      const { data: paymentCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Pagamento de Fatura")
        .single();

      const creditAccount = accounts.find((acc) => acc.id === creditCardAccountId);
      const bankAccount = accounts.find((acc) => acc.id === debitAccountId);

      if (!creditAccount || !bankAccount) {
        throw new Error("Conta de crédito ou conta bancária não encontrada.");
      }

      // 1. Transação de DÉBITO (saída do banco)
      const bankTransaction = {
        description: `Pagamento fatura ${
          creditAccount?.name || "cartão de crédito"
        }`,
        amount: Math.abs(amount), // Assegura que é positivo (lógica de saldo trata o resto)
        date: paymentDate,
        type: "expense" as const,
        category_id: paymentCategory?.id || null,
        account_id: debitAccountId,
        to_account_id: creditCardAccountId, // Indica que é uma transferência para o cartão
        status: "completed" as const,
        user_id: user.id,
      };
      
      const { data: newBankTransaction, error: bankError } = await supabase
        .from("transactions")
        .insert(bankTransaction)
        .select()
        .single();

      if (bankError) {
        console.error("Erro do Supabase (bankTransaction):", bankError);
        throw new Error(`A transação (banco) falhou: ${bankError.message}`);
      }

      // 2. Transação de CRÉDITO (entrada no cartão)
      const creditTransaction = {
        description: `Pagamento recebido de ${bankAccount.name}`, // Descrição mais clara
        amount: Math.abs(amount), // Assegura que é positivo
        date: paymentDate,
        type: "income" as const,
        category_id: paymentCategory?.id || null,
        account_id: creditCardAccountId,
        to_account_id: debitAccountId, // Indica que veio do banco
        status: "completed" as const,
        user_id: user.id,
        linked_transaction_id: newBankTransaction.id, // <-- CORREÇÃO: Usa linked_id
      };

      const { data: newCreditTransaction, error: creditError } = await supabase
        .from("transactions")
        .insert(creditTransaction)
        .select()
        .single();

      if (creditError) {
         // Se esta falhar, precisamos reverter a primeira
        console.error("Erro do Supabase (creditTransaction):", creditError);
        await supabase.from("transactions").delete().eq("id", newBankTransaction.id);
        throw new Error(`A transação (cartão) falhou: ${creditError.message}`);
      }
      
      // Adiciona ambas as transações ao store
      addGlobalTransactions([newBankTransaction as Transaction, newCreditTransaction as Transaction]);

      // Update account balances
      // Saldo do cartão AUMENTA (dívida diminui)
      const newCreditBalance = creditAccount.balance + Math.abs(amount);
      // Saldo do banco DIMINUI
      const newBankBalance = bankAccount.balance - Math.abs(amount);

      await Promise.all([
        supabase
          .from("accounts")
          .update({ balance: newCreditBalance })
          .eq("id", creditCardAccountId)
          .eq("user_id", user.id),
        supabase
          .from("accounts")
          .update({ balance: newBankBalance })
          .eq("id", debitAccountId)
          .eq("user_id", user.id),
      ]);

      const updatedCreditAccount = {
        ...creditAccount,
        balance: newCreditBalance,
      };
      const updatedBankAccount = { ...bankAccount, balance: newBankBalance };

      updateGlobalAccounts([updatedCreditAccount, updatedBankAccount]);

      return {
        creditAccount: updatedCreditAccount,
        bankAccount: updatedBankAccount,
      };
    } catch (error) {
      console.error("Error processing credit payment:", error);
      throw error;
    }
  };
  // --- FIM DA FUNÇÃO DE PAGAMENTO ---

  // --- NOVA FUNÇÃO DE ESTORNO ---
  const handleReversePayment = async (paymentsToReverse: AppTransaction[]) => {
    if (!user || !paymentsToReverse || paymentsToReverse.length === 0) {
      toast({ title: "Nenhum pagamento para estornar", variant: "destructive" });
      return;
    }

    toast({ title: "Estornando pagamento..." });

    try {
      // Pega o estado mais atual dos stores
      const allTransactions = useTransactionStore.getState().transactions;
      const allAccounts = useAccountStore.getState().accounts;

      const transactionsToDelete_ids: string[] = [];
      const accountsToUpdate = new Map<string, number>(); // Map<accountId, balanceChange>

      for (const payment of paymentsToReverse) {
        transactionsToDelete_ids.push(payment.id);

        // 1. Reverte o saldo do Cartão de Crédito (aumenta a dívida / remove o 'income')
        const creditAccountId = payment.account_id;
        // Subtrai o valor do pagamento (ex: balance += -500)
        const creditAccBalanceChange = -payment.amount; 
        
        accountsToUpdate.set(
          creditAccountId,
          (accountsToUpdate.get(creditAccountId) || 0) + creditAccBalanceChange
        );

        // 2. Encontra e reverte o saldo da Conta Bancária (devolve o dinheiro)
        // Procura pela transação de 'expense' vinculada
        const linkedExpense = allTransactions.find(
          (t) => t.id === payment.linked_transaction_id || // Novo método de vínculo
          (t.parent_transaction_id === payment.id && t.type === 'expense') // Método antigo (fallback)
        );
          
        if (linkedExpense) {
          transactionsToDelete_ids.push(linkedExpense.id);
          
          const debitAccountId = linkedExpense.account_id;
          // Adiciona o valor de volta (ex: balance += -(-500))
          const debitAccBalanceChange = -linkedExpense.amount; 
          
          accountsToUpdate.set(
            debitAccountId,
            (accountsToUpdate.get(debitAccountId) || 0) + debitAccBalanceChange
          );
        } else {
            console.warn(`Transação de débito vinculada ao pagamento ${payment.id} não encontrada no store.`);
        }
      }

      // 3. Deleta todas as transações (income e expense) do DB
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .in("id", transactionsToDelete_ids)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // 4. Atualiza os saldos das contas no DB
      const updatedAccountsList: Account[] = [];

      for (const [accountId, balanceChange] of accountsToUpdate.entries()) {
        const account = allAccounts.find((acc) => acc.id === accountId);
        if (account) {
          const newBalance = account.balance + balanceChange;
          const { error: updateError } = await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", accountId)
            .eq("user_id", user.id);

          if (updateError) throw updateError;
          updatedAccountsList.push({ ...account, balance: newBalance });
        }
      }

      // 5. Atualiza o estado global (stores)
      removeGlobalTransactions(transactionsToDelete_ids);
      updateGlobalAccounts(updatedAccountsList);

      toast({ title: "Pagamento estornado com sucesso!" });
    } catch (error) {
      console.error("Erro ao estornar pagamento:", error);
      toast({
        title: "Erro ao estornar",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };
  // --- FIM DA NOVA FUNÇÃO ---

  const openEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransactionModalOpen(true);
  };

  const openCreditPayment = (
    account: Account,
    currentBill: number, // Recebe o valor da fatura atual
    nextBill: number, // Recebe o valor da próxima fatura
    totalBalance: number // Recebe o totalBalance
  ) => {
    setPayingCreditAccount(account);
    setCurrentInvoiceValue(currentBill); // Armazena no estado
    setNextInvoiceValue(nextBill); // Armazena no estado
    setPayingTotalDebt(totalBalance); // Armazena a dívida total
    setCreditPaymentModalOpen(true);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "accounts":
        return (
          <AccountsPage
            onAddAccount={() => setAddAccountModalOpen(true)}
            onEditAccount={openEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onPayCreditCard={(account) => openCreditPayment(account, 0, 0, account.balance < 0 ? Math.abs(account.balance) : 0)} 
            onTransfer={() => setTransferModalOpen(true)}
            initialFilterType={accountFilterType}
          />
        );
      case "credit-bills":
        return <CreditBillsPage 
                  onPayCreditCard={openCreditPayment} 
                  onReversePayment={handleReversePayment} // <-- ADICIONADO
               />;
      case "transactions":
        return (
          <TransactionsPage
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onEditTransaction={openEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={handleImportTransactions}
            initialFilterType={transactionFilterType}
            initialFilterStatus={transactionFilterStatus}
            initialDateFilter={transactionDateFilter}
            initialFilterAccountType={transactionFilterAccountType}
            initialSelectedMonth={transactionSelectedMonth}
            initialCustomStartDate={transactionCustomStartDate}
            initialCustomEndDate={transactionCustomEndDate}
          />
        );
      case "categories":
        return <CategoriesPage />;
      case "analytics":
        return (
          <AnalyticsPage transactions={transactions} accounts={accounts} />
        );
      case "users":
        return isAdmin() ? (
          <UserManagement />
        ) : (
          <Dashboard
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onTransfer={() => setTransferModalOpen(true)}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onNavigateToAccounts={(filterType) => {
              if (filterType) {
                setAccountFilterType(filterType as any);
              } else {
                setAccountFilterType("all");
              }
              setCurrentPage("accounts");
            }}
            onNavigateToTransactions={(
              filterType,
              filterStatus,
              dateFilter,
              filterAccountType,
              selectedMonth,
              customStartDate,
              customEndDate
            ) => {
              if (filterType) {
                setTransactionFilterType(filterType);
              }
              if (filterStatus) {
                setTransactionFilterStatus(filterStatus);
              }
              if (dateFilter) {
                setTransactionDateFilter(dateFilter);
              }
              if (filterAccountType) {
                setTransactionFilterAccountType(filterAccountType);
              }
              setTransactionSelectedMonth(selectedMonth);
              setTransactionCustomStartDate(customStartDate);
              setTransactionCustomEndDate(customEndDate);
              setCurrentPage("transactions");
            }}
          />
        );
      case "system-settings":
        return isAdmin() ? (
          <SystemSettings />
        ) : (
          <Dashboard
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onTransfer={() => setTransferModalOpen(true)}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onNavigateToAccounts={(filterType) => {
              if (filterType) {
                setAccountFilterType(filterType as any);
              } else {
                setAccountFilterType("all");
              }
              setCurrentPage("accounts");
            }}
            onNavigateToTransactions={(
              filterType,
              filterStatus,
              dateFilter,
              filterAccountType,
              selectedMonth,
              customStartDate,
              customEndDate
            ) => {
              if (filterType) {
                setTransactionFilterType(filterType);
              }
              if (filterStatus) {
                setTransactionFilterStatus(filterStatus);
              }
              if (dateFilter) {
                setTransactionDateFilter(dateFilter);
              }
              if (filterAccountType) {
                setTransactionFilterAccountType(filterAccountType);
              }
              setTransactionSelectedMonth(selectedMonth);
              setTransactionCustomStartDate(customStartDate);
              setTransactionCustomEndDate(customEndDate);
              setCurrentPage("transactions");
            }}
          />
        );
      case "profile":
        return <UserProfile />;
      case "settings":
        return (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClearAllData={handleClearAllData}
          />
        );
      default:
        return (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            categories={categories}
            onTransfer={() => setTransferModalOpen(true)}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onNavigateToAccounts={(filterType) => {
              if (filterType) {
                setAccountFilterType(filterType as any);
              } else {
                setAccountFilterType("all");
              }
              setCurrentPage("accounts");
            }}
            onNavigateToTransactions={(
              filterType,
              filterStatus,
              dateFilter,
              filterAccountType,
              selectedMonth,
              customStartDate,
              customEndDate
            ) => {
              if (filterType) {
                setTransactionFilterType(filterType);
              }
              if (filterStatus) {
                setTransactionFilterStatus(filterStatus);
              }
              if (dateFilter) {
                setTransactionDateFilter(dateFilter);
              }
              if (filterAccountType) {
                setTransactionFilterAccountType(filterAccountType);
              }
              setTransactionSelectedMonth(selectedMonth);
              setTransactionCustomStartDate(customStartDate);
              setTransactionCustomEndDate(customEndDate);
              setCurrentPage("transactions");
            }}
          />
        );
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // ProtectedRoute will handle redirect
  }

  return (
    <>
      <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
        <MigrationWarning
          onMigrationComplete={() => {
            // Reload data after migration
            window.location.reload();
          }}
        />
        {renderCurrentPage()}
      </Layout>

      {/* Modals */}
      <AddAccountModal
        open={addAccountModalOpen}
        onOpenChange={setAddAccountModalOpen}
      />

      <AddTransactionModal
        open={addTransactionModalOpen}
        onOpenChange={setAddTransactionModalOpen}
        onAddTransaction={handleAddTransaction}
        onAddInstallmentTransactions={handleAddInstallmentTransactions}
        accounts={accounts}
      />

      <EditAccountModal
        open={editAccountModalOpen}
        onOpenChange={setEditAccountModalOpen}
        onEditAccount={handleEditAccount}
        account={editingAccount}
      />

      <EditTransactionModal
        open={editTransactionModalOpen}
        onOpenChange={setEditTransactionModalOpen}
        onEditTransaction={handleEditTransaction}
        transaction={editingTransaction}
        accounts={accounts}
      />

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onTransfer={handleTransfer}
      />

      {/* Passando os valores da fatura para o modal */}
      <CreditPaymentModal
        open={creditPaymentModalOpen}
        onOpenChange={setCreditPaymentModalOpen}
        onPayment={handleCreditPayment} 
        creditAccount={payingCreditAccount}
        invoiceValueInCents={currentInvoiceValue}
        nextInvoiceValueInCents={nextInvoiceValue}
        totalDebtInCents={payingTotalDebt} 
      />
    </>
  );
};

const Index = () => {
  return (
    <SettingsProvider>
      <PlaniFlowApp />
    </SettingsProvider>
  );
};

export default Index;