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
// 1. IMPORTAR OS STORES
import { useAccountStore } from "@/stores/AccountStore";
import { useTransactionStore } from "@/stores/TransactionStore";
import { Account, Transaction } from "@/types"; // Importar tipos

const PlaniFlowApp = () => {
  const { settings, updateSettings } = useSettings();
  const { user, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState("dashboard");

  // 2. LER O ESTADO DIRETAMENTE DOS STORES
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

  // 3. REMOVER useStates LOCAIS de accounts e transactions
  // const [accounts, setAccounts] = useState<any[]>([]);
  // const [transactions, setTransactions] = useState<any[]>([]);

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

  // Date parameters for transaction navigation - Reset when switching pages
  const [transactionSelectedMonth, setTransactionSelectedMonth] = useState<
    Date | undefined
  >(undefined);
  const [transactionCustomStartDate, setTransactionCustomStartDate] = useState<
    Date | undefined
  >(undefined);
  const [transactionCustomEndDate, setTransactionCustomEndDate] = useState<
    Date | undefined
  >(undefined);

  // Reset transaction filters when switching to transactions page
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
        console.log("Loading accounts and transactions from Supabase...");

        // Load accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (accountsError) {
          console.error("Error loading accounts:", accountsError);
        } else {
          // 4. ATUALIZAR O STORE GLOBAL EM VEZ DO LOCAL
          // Mapeamento de campos inconsistentes (limit)
          const formattedAccounts = (accountsData || []).map((acc) => ({
            ...acc,
            limit: acc.limit_amount,
          }));
          setGlobalAccounts(formattedAccounts as Account[]);
        }

        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id);

        if (categoriesError) {
          console.error("Error loading categories:", categoriesError);
        } else {
          console.log("Loaded categories:", categoriesData?.length);
          setCategories(categoriesData || []);
        }

        // Load transactions
        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (transactionsError) {
          console.error("Error loading transactions:", transactionsError);
        } else {
          // 5. ATUALIZAR O STORE GLOBAL EM VEZ DO LOCAL
          // Mapeamento de campos inconsistentes (accountId, category, etc.)
          const formattedTransactions = (transactionsData || []).map(
            (trans) => ({
              ...trans,
              accountId: trans.account_id,
              category: trans.category_id,
              currentInstallment: trans.current_installment,
              parentTransactionId: trans.parent_transaction_id,
              toAccountId: trans.to_account_id,
              date: createDateFromString(trans.date), // Garantir que é objeto Date
            })
          );
          setGlobalTransactions(formattedTransactions as Transaction[]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
    // 6. DEPENDÊNCIAS ATUALIZADAS
  }, [user, setGlobalAccounts, setGlobalTransactions]);

  // 7. REMOVER handleAddAccount (O modal agora usa o store diretamente)
  /*
  const handleAddAccount = async (accountData: any) => {
    // ...toda a função foi removida...
  };
  */

  const handleEditAccount = async (updatedAccount: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("accounts")
        .update(updatedAccount)
        .eq("id", updatedAccount.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating account:", error);
        return;
      }

      // 8. ATUALIZAR O STORE GLOBAL
      updateGlobalAccounts(updatedAccount);
      setEditingAccount(null);
    } catch (error) {
      console.error("Error updating account:", error);
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

      if (error) {
        console.error("Error deleting account:", error);
        return;
      }

      // 9. ATUALIZAR O STORE GLOBAL
      removeGlobalAccount(accountId);
      
      // Também remove as transações associadas do store global
      const transactionsToRemove = transactions
        .filter(t => t.account_id === accountId)
        .map(t => t.id);
      removeGlobalTransaction(transactionsToRemove);

    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleAddTransaction = async (transactionData: any) => {
    if (!user) return;

    try {
      // Map camelCase properties to snake_case for Supabase
      const mappedData = {
        description: transactionData.description,
        amount: transactionData.amount,
        date: transactionData.date.toISOString().split("T")[0], // Convert to YYYY-MM-DD format
        type: transactionData.type,
        account_id: transactionData.account_id,
        category_id: transactionData.category_id,
        status: transactionData.status,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("transactions")
        .insert([mappedData])
        .select()
        .single();

      if (error) {
        console.error("Error adding transaction:", error);
        return;
      }

      // 10. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      addGlobalTransactions([data as Transaction]);

      // Update account balance
      const balanceChange =
        transactionData.type === "income"
          ? transactionData.amount
          : -transactionData.amount;

      const account = accounts.find(
        (acc) => acc.id === transactionData.account_id
      );
      if (account) {
        const newBalance = account.balance + balanceChange;

        if (
          account.type === "checking" &&
          newBalance < 0 &&
          account.limit_amount
        ) {
          if (Math.abs(newBalance) > account.limit_amount) {
            throw new Error(
              `Transação excede o limite de ${account.limit_amount.toLocaleString(
                "pt-BR",
                { style: "currency", currency: "BRL" }
              )}`
            );
          }
        }

        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", transactionData.account_id)
          .eq("user_id", user.id);

        // 11. ATUALIZAR O STORE GLOBAL DE CONTAS
        updateGlobalAccounts({ ...account, balance: newBalance });
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

      if (error) {
        console.error(
          "Database error adding installment transactions:",
          error
        );
        throw error;
      }

      // 12. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      addGlobalTransactions(newTransactions as Transaction[]);

      // Update account balance for all installments
      const totalAmount = transactionsData.reduce((sum, trans) => {
        return sum + (trans.type === "income" ? trans.amount : -trans.amount);
      }, 0);

      const accountId = transactionsData[0].account_id;
      const account = accounts.find((acc) => acc.id === accountId);
      if (account) {
        const newBalance = account.balance + totalAmount;
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", accountId)
          .eq("user_id", user.id);

        // 13. ATUALIZAR O STORE GLOBAL DE CONTAS
        updateGlobalAccounts({ ...account, balance: newBalance });
      }
    } catch (error) {
      console.error("Error adding installment transactions:", error);
      throw error; // Re-throw to be caught by the modal
    }
  };

  const handleImportTransactions = async (transactionsData: any[]) => {
    if (!user) return;

    try {
      // ... (Lógica de importação, map de categorias, etc.) ...
      const transactionsToInsert = await Promise.all(
        transactionsData.map(async (data) => {
          // ... (código de busca/criação de categoria) ...
          let category_id = null; // Substitua pela sua lógica
          
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

      // 14. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      addGlobalTransactions(newTransactions as Transaction[]);

      // ... (Lógica de cálculo de balanço) ...
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

      // 15. ATUALIZAR O STORE GLOBAL DE CONTAS (EM LOTE)
      updateGlobalAccounts(updatedAccountsList);

      toast({
        title: "Importação concluída",
        description: `${newTransactions.length} transações importadas com sucesso`,
      });

    } catch (error) {
      console.error('Error importing transactions:', error);
      // ... (toast de erro) ...
    }
  };


  const handleTransfer = async (
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: Date
  ) => {
    if (!user) return;

    try {
      const fromAccount = accounts.find((acc) => acc.id === fromAccountId);
      const toAccount = accounts.find((acc) => acc.id === toAccountId);
      if (!fromAccount || !toAccount) return;

      const newFromBalance = fromAccount.balance - amount;
      const newToBalance = toAccount.balance + amount;

      // ... (verificação de limite) ...

      const outgoingTransaction = {
        description: `Transferência para ${toAccount.name}`,
        amount,
        date: date.toISOString().split("T")[0],
        type: "expense" as const,
        category_id: null,
        account_id: fromAccountId,
        to_account_id: toAccountId, 
        status: "completed" as const,
        user_id: user.id,
      };

      const incomingTransaction = {
        description: `Transferência de ${fromAccount.name}`,
        amount,
        date: date.toISOString().split("T")[0],
        type: "income" as const,
        category_id: null,
        account_id: toAccountId,
        to_account_id: fromAccountId,
        status: "completed" as const,
        user_id: user.id,
      };

      const { data: newTransactions, error } = await supabase
        .from("transactions")
        .insert([outgoingTransaction, incomingTransaction])
        .select();

      if (error) {
        console.error("Error creating transfer:", error);
        return;
      }

      // 16. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      addGlobalTransactions(newTransactions as Transaction[]);

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

      // 17. ATUALIZAR O STORE GLOBAL DE CONTAS (EM LOTE)
      updateGlobalAccounts([
        { ...fromAccount, balance: newFromBalance },
        { ...toAccount, balance: newToBalance },
      ]);
    } catch (error) {
      // ... (tratamento de erro) ...
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

      // Lógica para Edição ÚNICA
      if (
        !editScope ||
        editScope === "current" ||
        !updatedTransaction.installments
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

        // ... (cálculo de balanço) ...
        const oldBalanceChange =
          oldTransaction.type === "income"
            ? -oldTransaction.amount
            : oldTransaction.amount;
        const newBalanceChange =
          updatedTransaction.type === "income"
            ? updatedTransaction.amount
            : -updatedTransaction.amount;
            
        // Update account balance
        if (oldTransaction.account_id === updatedTransaction.account_id) {
          const account = accounts.find(
            (acc) => acc.id === oldTransaction.account_id
          );
          if (account) {
            const newBalance =
              account.balance + oldBalanceChange + newBalanceChange;
            await supabase
              .from("accounts")
              .update({ balance: newBalance })
              .eq("id", oldTransaction.account_id)
              .eq("user_id", user.id);

            // 18. ATUALIZAR O STORE GLOBAL DE CONTAS
            updateGlobalAccounts({ ...account, balance: newBalance });
          }
        }

        // 19. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
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
      // ... (tratamento de erro) ...
    }
  };

  const handleInstallmentScopeEdit = async (
    updatedTransaction: any,
    editScope: EditScope,
    oldTransaction: any
  ) => {
    // ... (lógica de edição de parcelas) ...
    // ... (lógica de update no supabase) ...
    const { data: targetTransactions, error: selectError } = await supabase
      .from('transactions')
      // ... (query builder) ...
      
    if (selectError) throw selectError;
    
    for (const transaction of targetTransactions || []) {
       // ... (update no supabase) ...
    }


    // ... (cálculo de balanço) ...
    const totalBalanceChange = 0; // Substitua pela sua lógica

    if (totalBalanceChange !== 0) {
      const account = accounts.find(
        (acc) => acc.id === updatedTransaction.account_id
      );
      if (account) {
        const newBalance = account.balance + totalBalanceChange;
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", updatedTransaction.account_id)
          .eq("user_id", user?.id);

        // 20. ATUALIZAR O STORE GLOBAL DE CONTAS
        updateGlobalAccounts({ ...account, balance: newBalance });
      }
    }

    // Recarregar transações
    const { data: refreshedTransactions, error: refreshError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });

    if (!refreshError && refreshedTransactions) {
      const formattedTransactions = refreshedTransactions.map((trans) => ({
        ...trans,
        // ... (mapeamento de campos) ...
        date: createDateFromString(trans.date),
      }));
      // 21. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      setGlobalTransactions(formattedTransactions as Transaction[]);
    }

    setEditingTransaction(null);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;

    try {
      const transactionToDelete = transactions.find(
        (trans) => trans.id === transactionId
      );
      if (!transactionToDelete) return;

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update account balance
      const account = accounts.find(
        (acc) => acc.id === transactionToDelete.account_id
      );
      if (account) {
        const balanceChange =
          transactionToDelete.type === "income"
            ? -transactionToDelete.amount // Revert income (subtract)
            : transactionToDelete.amount; // Revert expense (add back)

        const newBalance = account.balance + balanceChange;
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", transactionToDelete.account_id)
          .eq("user_id", user.id);

        // 22. ATUALIZAR O STORE GLOBAL DE CONTAS
        updateGlobalAccounts({ ...account, balance: newBalance });
      }

      // 23. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      removeGlobalTransaction(transactionId);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const handleUpdateSettings = (newSettings: typeof settings) => {
    console.log("Updating settings:", newSettings);
    updateSettings(newSettings);
  };

  const handleClearAllData = async () => {
    if (!user) return;

    try {
      // ... (delete no supabase) ...
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);

      // 24. ATUALIZAR OS STORES GLOBAIS
      setGlobalAccounts([]);
      setGlobalTransactions([]);
      setCategories([]);

      toast({
        title: "Dados limpos",
        description: "Todos os dados foram removidos com sucesso",
      });
    } catch (error) {
      // ... (tratamento de erro) ...
    }
  };

  const openEditAccount = (account: any) => {
    setEditingAccount(account);
    setEditAccountModalOpen(true);
  };

  // ----- CORREÇÃO PRINCIPAL AQUI -----
  const handleCreditPayment = async (
    creditAccountId: string,
    bankAccountId: string,
    amount: number,
    date: Date
  ): Promise<{ creditAccount: Account; bankAccount: Account }> => { // 25. DEFINIR TIPO DE RETORNO
    if (!user) throw new Error("Usuário não autenticado");

    try {
      // Find or get the "Pagamento de Fatura" category
      const { data: paymentCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Pagamento de Fatura")
        .single();

      const creditAccount = accounts.find((acc) => acc.id === creditAccountId);
      const bankAccount = accounts.find((acc) => acc.id === bankAccountId);

      if (!creditAccount || !bankAccount) {
        throw new Error("Conta de crédito ou conta bancária não encontrada.");
      }

      const creditTransaction = {
        description: `Pagamento fatura ${
          creditAccount?.name || "cartão de crédito"
        }`,
        amount,
        date: date.toISOString().split("T")[0],
        type: "income" as const, // Payment reduces debt (positive for credit card)
        category_id: paymentCategory?.id || null,
        account_id: creditAccountId,
        status: "completed" as const,
        user_id: user.id,
      };

      const bankTransaction = {
        description: `Pagamento fatura ${
          creditAccount?.name || "cartão de crédito"
        }`,
        amount,
        date: date.toISOString().split("T")[0],
        type: "expense" as const, // Payment is an expense for bank account
        category_id: paymentCategory?.id || null,
        account_id: bankAccountId,
        status: "completed" as const,
        user_id: user.id,
      };

      const { data: newTransactions, error } = await supabase
        .from("transactions")
        .insert(creditTransaction)
        .select();

      const { data: newTransactions2, error: error2 } = await supabase
        .from("transactions")
        .insert(bankTransaction)
        .select();

      if (error || error2) {
        console.error("Error creating credit payment:", error || error2);
        throw error || error2;
      }

      const allNewTransactions = [
        ...(newTransactions || []),
        ...(newTransactions2 || []),
      ];

      // 26. ATUALIZAR O STORE GLOBAL DE TRANSAÇÕES
      addGlobalTransactions(allNewTransactions as Transaction[]);

      // Update account balances
      const newCreditBalance = creditAccount.balance + amount;
      const newBankBalance = bankAccount.balance - amount;

      await Promise.all([
        supabase
          .from("accounts")
          .update({ balance: newCreditBalance })
          .eq("id", creditAccountId)
          .eq("user_id", user.id),
        supabase
          .from("accounts")
          .update({ balance: newBankBalance })
          .eq("id", bankAccountId)
          .eq("user_id", user.id),
      ]);

      const updatedCreditAccount = {
        ...creditAccount,
        balance: newCreditBalance,
      };
      const updatedBankAccount = { ...bankAccount, balance: newBankBalance };

      // 27. ATUALIZAR O STORE GLOBAL DE CONTAS
      updateGlobalAccounts([updatedCreditAccount, updatedBankAccount]);
      
      // 28. RETORNAR OS OBJETOS ATUALIZADOS
      return {
        creditAccount: updatedCreditAccount,
        bankAccount: updatedBankAccount,
      };
      
    } catch (error) {
      console.error("Error processing credit payment:", error);
      throw error; // Lança o erro para o modal
    }
  };
  // ----- FIM DA CORREÇÃO -----


  const openEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransactionModalOpen(true);
  };

  const openCreditPayment = (account: any) => {
    setPayingCreditAccount(account);
    setCreditPaymentModalOpen(true);
  };

  const renderCurrentPage = () => {
    // 29. As props 'accounts' e 'transactions' agora vêm dos stores
    switch (currentPage) {
      case "accounts":
        return (
          <AccountsPage
            // 'accounts' prop foi removida (corrigido na etapa anterior)
            onAddAccount={() => setAddAccountModalOpen(true)}
            onEditAccount={openEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onPayCreditCard={openCreditPayment}
            onTransfer={() => setTransferModalOpen(true)}
            initialFilterType={accountFilterType}
          />
        );
      case "credit-bills":
        // A página de faturas agora lê dos stores
        return <CreditBillsPage onPayCreditCard={openCreditPayment} />;
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
      // ... (outros casos)
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
              // Store the date parameters for navigation
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
        // onAddAccount foi removido, o modal usa o store
      />

      <AddTransactionModal
        open={addTransactionModalOpen}
        onOpenChange={setAddTransactionModalOpen}
        onAddTransaction={handleAddTransaction}
        onAddInstallmentTransactions={handleAddInstallmentTransactions}
        accounts={accounts} // Passa as contas do store
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
        accounts={accounts} // Passa as contas do store
      />

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onTransfer={handleTransfer}
        accounts={accounts} // Passa as contas do store
      />

      <CreditPaymentModal
        open={creditPaymentModalOpen}
        onOpenChange={setCreditPaymentModalOpen}
        onPayment={handleCreditPayment}
        accounts={accounts.filter((acc) => acc.type !== "credit")} // Passa contas de débito
        creditAccount={payingCreditAccount}
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