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
import { RecurringTransactionsPage } from "@/components/RecurringTransactionsPage";
import { FixedTransactionsPage } from "@/components/FixedTransactionsPage";
import { BankReconciliationPage } from "@/components/BankReconciliationPage";
import { ReportsPage } from "@/components/ReportsPage";
import { AddAccountModal } from "@/components/AddAccountModal";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { EditAccountModal } from "@/components/EditAccountModal";
import { EditTransactionModal } from "@/components/EditTransactionModal";
import { EditScope } from "@/components/InstallmentEditScopeDialog";
import { TransferModal } from "@/components/TransferModal";
import { CreditPaymentModal } from "@/components/CreditPaymentModal";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MigrationWarning } from "@/components/MigrationWarning";
import { createDateFromString } from "@/lib/dateUtils";
import { useAccountStore } from "@/stores/AccountStore";
import { useTransactionStore, AppTransaction } from "@/stores/TransactionStore"; // Importa AppTransaction
import { Account, Transaction } from "@/types";
import { logger } from "@/lib/logger";

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
  const removeGlobalTransactions = useTransactionStore(
    (state) => state.removeTransactions
  );

  const [categories, setCategories] = useState<any[]>([]);

  // Modal states
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addTransactionModalOpen, setAddTransactionModalOpen] = useState(false);
  const [transactionInitialType, setTransactionInitialType] = useState<"income" | "expense" | "">("");
  const [transactionInitialAccountType, setTransactionInitialAccountType] = useState<"credit" | "checking" | "">("");
  const [transactionLockType, setTransactionLockType] = useState(false);
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
        logger.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user, setGlobalAccounts, setGlobalTransactions]);

  // Função para recarregar transações
  const reloadTransactions = async () => {
    if (!user) return;
    try {
      logger.info('🔄 Recarregando transações...');
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
          date: createDateFromString(trans.date),
        })
      );
      setGlobalTransactions(formattedTransactions as Transaction[]);
      logger.info('✅ Transações recarregadas:', formattedTransactions.length);
    } catch (error) {
      logger.error("Error reloading transactions:", error);
    }
  };

  // Função para recarregar contas
  const reloadAccounts = async () => {
    if (!user) return;
    try {
      logger.info('🔄 Recarregando contas...');
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
      logger.info('✅ Contas recarregadas:', formattedAccounts.length);
    } catch (error) {
      logger.error("Error reloading accounts:", error);
    }
  };

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
      logger.error("Error updating account:", error);
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
      
      await reloadAccounts();
      toast({
        title: "Sucesso",
        description: "Conta excluída com sucesso",
      });
    } catch (error) {
      logger.error("Error deleting account:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta",
        variant: "destructive",
      });
    }
  };

  const handleImportAccounts = async (accountsData: any[]) => {
    if (!user) return;
    try {
      const accountsToAdd = accountsData.map(acc => ({
        ...acc,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from("accounts")
        .insert(accountsToAdd);
      
      if (error) throw error;
      
      await reloadAccounts();
      toast({
        title: "Sucesso",
        description: `${accountsToAdd.length} contas importadas com sucesso!`,
      });
    } catch (error) {
      console.error("Error importing accounts:", error);
      toast({
        title: "Erro",
        description: "Erro ao importar contas.",
        variant: "destructive"
      });
    }
  };

  const handleAddTransaction = async (transactionData: any) => {
    if (!user) return;
    try {
      // Usar edge function atômica para garantir consistência
      const { data, error } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: transactionData.description,
            amount: transactionData.amount,
            date: transactionData.date.toISOString().split("T")[0],
            type: transactionData.type,
            category_id: transactionData.category_id,
            account_id: transactionData.account_id,
            status: transactionData.status,
            invoice_month: transactionData.invoiceMonth || null,
            invoice_month_overridden: !!transactionData.invoiceMonth,
          }
        }
      });

      if (error) throw error;

      // Atualizar store com transação e saldo retornados
      addGlobalTransactions([data.transaction as Transaction]);
      
      if (data.balance) {
        const account = accounts.find(acc => acc.id === transactionData.account_id);
        if (account) {
          updateGlobalAccounts({ ...account, balance: data.balance.new_balance });
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
      // Criar todas as parcelas atomicamente usando Promise.all
      const results = await Promise.all(
        transactionsData.map(data =>
          supabase.functions.invoke('atomic-transaction', {
            body: {
              transaction: {
                description: data.description,
                amount: data.amount,
                date: data.date.toISOString().split("T")[0],
                type: data.type,
                category_id: data.category_id,
                account_id: data.account_id,
                status: data.status,
                invoice_month: data.invoiceMonth || null,
                invoice_month_overridden: !!data.invoiceMonth,
              }
            }
          })
        )
      );

      // Verificar erros
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      // Coletar transações criadas
      const newTransactions = results.map(r => r.data?.transaction).filter(Boolean);
      addGlobalTransactions(newTransactions as Transaction[]);

      // Atualizar saldo da conta (usar o último resultado)
      const lastResult = results[results.length - 1];
      if (lastResult.data?.balance) {
        const accountId = transactionsData[0].account_id;
        const account = accounts.find(acc => acc.id === accountId);
        if (account) {
          updateGlobalAccounts({ ...account, balance: lastResult.data.balance.new_balance });
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
        if (account && typeof balanceChange === 'number') {
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

      // Usar edge function atômica para transferência
      const { data, error } = await supabase.functions.invoke('atomic-transfer', {
        body: {
          transfer: {
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount: amount,
            date: date.toISOString().split("T")[0],
            description: `Transferência para ${toAccount.name}`,
          }
        }
      });

      if (error) throw error;

      // Atualizar stores com transações e saldos
      addGlobalTransactions([data.outgoing as Transaction, data.incoming as Transaction]);
      
      updateGlobalAccounts([
        { ...fromAccount, balance: data.from_balance.new_balance },
        { ...toAccount, balance: data.to_balance.new_balance },
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
      throw error;
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

      // Usar edge function atômica para edição
      const { data, error } = await supabase.functions.invoke('atomic-edit-transaction', {
        body: {
          transaction_id: updatedTransaction.id,
          updates: {
            description: updatedTransaction.description,
            amount: updatedTransaction.amount,
            date: typeof updatedTransaction.date === "string"
              ? updatedTransaction.date
              : updatedTransaction.date.toISOString().split("T")[0],
            type: updatedTransaction.type,
            category_id: updatedTransaction.category_id,
            account_id: updatedTransaction.account_id,
            status: updatedTransaction.status || "completed",
            invoice_month: updatedTransaction.invoice_month || null,
          },
          scope: editScope || "current",
        }
      });

      if (error) throw error;

      // Atualizar stores
      if (data.updated === 1) {
        updateGlobalTransaction(updatedTransaction);
      } else {
        // Múltiplas transações atualizadas (parcelas)
        await reloadTransactions();
      }

      // Atualizar saldos das contas afetadas
      if (data.balances) {
        const updatedAccounts = data.balances.map((bal: any) => {
          const account = accounts.find(acc => acc.id === bal.accountId);
          return account ? { ...account, balance: bal.new_balance } : null;
        }).filter(Boolean);
        
        if (updatedAccounts.length > 0) {
          updateGlobalAccounts(updatedAccounts);
        }
      }

      setEditingTransaction(null);
    } catch (error) {
      console.error("Error updating transaction:", error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const handleDeleteTransaction = async (transactionId: string, editScope?: EditScope) => {
    if (!user) return;

    try {
      const transactionToDelete = transactions.find(
        (trans) => trans.id === transactionId
      );
      if (!transactionToDelete) return;

      // Usar edge function atômica para deleção
      const { data, error } = await supabase.functions.invoke('atomic-delete-transaction', {
        body: {
          transaction_id: transactionId,
          scope: editScope || "current",
        }
      });

      if (error) throw error;

      // Remover transações do store
      await reloadTransactions();

      // Atualizar saldos das contas afetadas
      if (data.balances) {
        const updatedAccounts = data.balances.map((bal: any) => {
          const account = accounts.find(acc => acc.id === bal.accountId);
          return account ? { ...account, balance: bal.new_balance } : null;
        }).filter(Boolean);
        
        if (updatedAccounts.length > 0) {
          updateGlobalAccounts(updatedAccounts);
        }
      }

      toast({
        title: "Sucesso",
        description: `${data.deleted} transação(ões) excluída(s)`,
      });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      }
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

  // --- FUNÇÃO DE PAGAMENTO DE CRÉDITO (VERSÃO ATÔMICA) ---
  const handleCreditPayment = async ({
    creditCardAccountId,
    debitAccountId,
    amount,
    paymentDate,
  }: {
    creditCardAccountId: string;
    debitAccountId: string;
    amount: number;
    paymentDate: string;
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

      // Usar atomic-transaction para ambas as transações
      // 1. Income no cartão (pagamento recebido) - DIMINUI a dívida
      const { data: creditData, error: creditError } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: `Pagamento recebido de ${bankAccount.name}`,
            amount: Math.abs(amount),
            date: paymentDate,
            type: 'income',
            category_id: paymentCategory?.id || null,
            account_id: creditCardAccountId,
            status: 'completed',
          }
        }
      });

      if (creditError) {
        console.error("Erro ao criar transação de pagamento no cartão:", creditError);
        throw new Error(`Pagamento no cartão falhou: ${creditError.error}`);
      }

      // 2. Expense no banco (saída de dinheiro)
      const { data: bankData, error: bankError } = await supabase.functions.invoke('atomic-transaction', {
        body: {
          transaction: {
            description: `Pagamento fatura ${creditAccount.name}`,
            amount: Math.abs(amount),
            date: paymentDate,
            type: 'expense',
            category_id: paymentCategory?.id || null,
            account_id: debitAccountId,
            status: 'completed',
          }
        }
      });

      if (bankError) {
        console.error("Erro ao criar transação de débito no banco:", bankError);
        // Tentar reverter a transação do cartão
        if (creditData?.transaction?.id) {
          await supabase.from("transactions").delete().eq("id", creditData.transaction.id);
        }
        throw new Error(`Débito no banco falhou: ${bankError.error}`);
      }

      // Vincular as transações
      if (creditData?.transaction?.id && bankData?.transaction?.id) {
        await supabase
          .from("transactions")
          .update({ linked_transaction_id: bankData.transaction.id })
          .eq("id", creditData.transaction.id);
      }

      // Adicionar transações ao store
      addGlobalTransactions([
        creditData.transaction as Transaction,
        bankData.transaction as Transaction,
      ]);

      // Atualizar saldos no store
      const updatedCreditAccount = {
        ...creditAccount,
        balance: creditData.balance.new_balance,
      };
      const updatedBankAccount = {
        ...bankAccount,
        balance: bankData.balance.new_balance,
      };

      updateGlobalAccounts([updatedCreditAccount, updatedBankAccount]);
      
      // Força refetch para garantir sincronização
      console.log('🔄 Refazendo fetch após pagamento...');
      await Promise.all([
        reloadAccounts(),
        reloadTransactions()
      ]);

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
          // Adiciona o valor de volta à conta (linkedExpense.amount é positivo)
          const debitAccBalanceChange = linkedExpense.amount;
          
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
      
      // 6. Força refetch dos dados para garantir sincronização
      console.log('🔄 Refazendo fetch após estorno...');
      await Promise.all([
        reloadAccounts(),
        reloadTransactions()
      ]);

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
    currentBill: number,
    nextBill: number,
    totalBalance: number
  ) => {
    setPayingCreditAccount(account);
    setCurrentInvoiceValue(currentBill);
    setNextInvoiceValue(nextBill);
    setPayingTotalDebt(totalBalance);
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
            onImportAccounts={handleImportAccounts}
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
            onMarkAsPaid={handleEditTransaction}
            initialFilterType={transactionFilterType}
            initialFilterStatus={transactionFilterStatus}
            initialDateFilter={transactionDateFilter}
            initialFilterAccountType={transactionFilterAccountType}
            initialSelectedMonth={transactionSelectedMonth}
            initialCustomStartDate={transactionCustomStartDate}
            initialCustomEndDate={transactionCustomEndDate}
          />
        );
      case "recurring":
        return <RecurringTransactionsPage />;
      case "fixed":
        return <FixedTransactionsPage />;
      case "categories":
        return <CategoriesPage />;
      case "analytics":
        return (
          <AnalyticsPage 
            transactions={transactions.map(t => ({ ...t, category: t.category_id || "" }))} 
            accounts={accounts} 
          />
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
            onAddTransaction={() => {
              setTransactionInitialType("");
              setTransactionInitialAccountType("");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
            onAddExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddIncome={() => {
              setTransactionInitialType("income");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddCreditExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("credit");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
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
            onAddAccount={() => setAddAccountModalOpen(true)}
            onAddTransaction={() => {
              setTransactionInitialType("");
              setTransactionInitialAccountType("");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
            onAddExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddIncome={() => {
              setTransactionInitialType("income");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddCreditExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("credit");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
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
      case "reconciliation":
        return (
          <BankReconciliationPage
            transactions={transactions}
            accounts={accounts}
            categories={categories}
          />
        );
      case "reports":
        return (
          <ReportsPage
            transactions={transactions}
            accounts={accounts}
            categories={categories}
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
            onAddAccount={() => setAddAccountModalOpen(true)}
            onAddTransaction={() => {
              setTransactionInitialType("");
              setTransactionInitialAccountType("");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
            onAddExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddIncome={() => {
              setTransactionInitialType("income");
              setTransactionInitialAccountType("checking");
              setTransactionLockType(true);
              setAddTransactionModalOpen(true);
            }}
            onAddCreditExpense={() => {
              setTransactionInitialType("expense");
              setTransactionInitialAccountType("credit");
              setTransactionLockType(false);
              setAddTransactionModalOpen(true);
            }}
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
        onOpenChange={(open) => {
          setAddTransactionModalOpen(open);
          if (!open) {
            // Limpa os tipos iniciais quando o modal fechar
            setTransactionInitialType("");
            setTransactionInitialAccountType("");
            setTransactionLockType(false);
          }
        }}
        onAddTransaction={handleAddTransaction}
        onAddInstallmentTransactions={handleAddInstallmentTransactions}
        onSuccess={reloadTransactions}
        accounts={accounts}
        initialType={transactionInitialType}
        initialAccountType={transactionInitialAccountType}
        lockType={transactionLockType}
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
        onTransfer={async (fromAccountId, toAccountId, amountInCents, date) => {
          await handleTransfer(fromAccountId, toAccountId, amountInCents, date);
          const fromAccount = accounts.find(acc => acc.id === fromAccountId)!;
          const toAccount = accounts.find(acc => acc.id === toAccountId)!;
          return { fromAccount, toAccount };
        }}
      />

      {/* Passando os valores da fatura para o modal */}
      <CreditPaymentModal
        open={creditPaymentModalOpen}
        onOpenChange={setCreditPaymentModalOpen}
        onPayment={async (params) => {
          const result = await handleCreditPayment(params);
          return { updatedCreditAccount: result.creditAccount, updatedDebitAccount: result.bankAccount };
        }}
        creditAccount={payingCreditAccount}
        invoiceValueInCents={currentInvoiceValue}
        nextInvoiceValueInCents={nextInvoiceValue}
        totalDebtInCents={payingTotalDebt} 
      />
    </>
  );
};

export default PlaniFlowApp;