import { useState, useMemo } from "react";
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
import { AccountingPage } from "@/components/AccountingPage";
import { AddAccountModal } from "@/components/AddAccountModal";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { EditAccountModal } from "@/components/EditAccountModal";
import { EditTransactionModal } from "@/components/EditTransactionModal";

import { TransferModal } from "@/components/TransferModal";
import { CreditPaymentModal } from "@/components/CreditPaymentModal";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MigrationWarning } from "@/components/MigrationWarning";
import { Account, Transaction } from "@/types";
import { logger } from "@/lib/logger";
import { useAccounts } from "@/hooks/queries/useAccounts";
import { useInfiniteTransactions } from "@/hooks/queries/useInfiniteTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { useAccountHandlers } from "@/hooks/useAccountHandlers";
import { useTransactionHandlers } from "@/hooks/useTransactionHandlers";

const PlaniFlowApp = () => {
  const { settings, updateSettings } = useSettings();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const queryClient = useQueryClient();

  // Pagination state (não mais necessário com infinite scroll, mas mantido para compatibilidade)
  const [transactionsPageSize] = useState(50);

  // Transaction filters state
  const [transactionsSearch, setTransactionsSearch] = useState("");
  const [transactionsFilterType, setTransactionsFilterType] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [transactionsFilterAccount, setTransactionsFilterAccount] = useState<string>("all");
  const [transactionsFilterCategory, setTransactionsFilterCategory] = useState<string>("all");
  const [transactionsFilterStatus, setTransactionsFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [transactionsFilterAccountType, setTransactionsFilterAccountType] = useState<"all" | "checking" | "savings" | "credit" | "investment">("all");
  const [transactionsDateFrom, setTransactionsDateFrom] = useState<string | undefined>(undefined);
  const [transactionsDateTo, setTransactionsDateTo] = useState<string | undefined>(undefined);
  const [transactionsSortBy, setTransactionsSortBy] = useState<"date" | "amount">("date");
  const [transactionsSortOrder, setTransactionsSortOrder] = useState<"asc" | "desc">("desc");

  const [accountFilterType, setAccountFilterType] = useState<
    "all" | "checking" | "savings" | "credit" | "investment"
  >("all");

  // React Query hooks - fonte única de verdade
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const {
    transactions, 
    isLoading: loadingTransactions,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalCount,
  } = useInfiniteTransactions({ 
    pageSize: transactionsPageSize,
    search: transactionsSearch,
    type: transactionsFilterType,
    accountId: transactionsFilterAccount,
    categoryId: transactionsFilterCategory,
    status: transactionsFilterStatus,
    accountType: transactionsFilterAccountType,
    dateFrom: transactionsDateFrom,
    dateTo: transactionsDateTo,
    sortBy: transactionsSortBy,
    sortOrder: transactionsSortOrder,
  });
  const { categories, loading: loadingCategories } = useCategories();

  // Computed loading state otimizado com useMemo
  const loadingData = useMemo(() => 
    authLoading || loadingAccounts || loadingTransactions || loadingCategories,
    [authLoading, loadingAccounts, loadingTransactions, loadingCategories]
  );

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
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [payingCreditAccount, setPayingCreditAccount] = useState<Account | null>(null);
  
  const [currentInvoiceValue, setCurrentInvoiceValue] = useState(0);
  const [nextInvoiceValue, setNextInvoiceValue] = useState(0);
  const [payingTotalDebt, setPayingTotalDebt] = useState(0);

  // Use hooks customizados para handlers
  const { handleEditAccount, handleDeleteAccount, handleImportAccounts } = useAccountHandlers();
  const {
    handleAddTransaction,
    handleAddInstallmentTransactions,
    handleEditTransaction,
    handleDeleteTransaction,
    handleTransfer,
    handleImportTransactions,
    handleCreditPayment,
    handleReversePayment,
  } = useTransactionHandlers(); // ✅ Sem passar dados como props

  const handleUpdateSettings = (newSettings: typeof settings) => {
    logger.debug("Updating settings:", newSettings);
    updateSettings(newSettings);
  };

  const handleClearAllData = async () => {
    if (!user) return;
    try {
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.from("accounts").delete().eq("user_id", user.id);
      await supabase.from("categories").delete().eq("user_id", user.id);

      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });

      toast({
        title: "Dados limpos",
        description: "Todos os dados foram removidos com sucesso",
      });
    } catch (error) {
      logger.error("Error clearing data:", error);
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

  const analyticsTransactions = useMemo(() => 
    transactions.map(t => ({ ...t, category: t.category_id || "" })),
    [transactions]
  );

  const renderDashboard = () => (
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
      onNavigateToTransactions={() => {
        setCurrentPage("transactions");
      }}
    />
  );

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
            totalCount={totalCount}
            search={transactionsSearch}
            onSearchChange={setTransactionsSearch}
            filterType={transactionsFilterType}
            onFilterTypeChange={setTransactionsFilterType}
            filterAccount={transactionsFilterAccount}
            onFilterAccountChange={setTransactionsFilterAccount}
            filterCategory={transactionsFilterCategory}
            onFilterCategoryChange={setTransactionsFilterCategory}
            filterStatus={transactionsFilterStatus}
            onFilterStatusChange={setTransactionsFilterStatus}
            filterAccountType={transactionsFilterAccountType}
            onFilterAccountTypeChange={(value: string) => setTransactionsFilterAccountType(value as any)}
            dateFrom={transactionsDateFrom}
            dateTo={transactionsDateTo}
            onDateFromChange={setTransactionsDateFrom}
            onDateToChange={setTransactionsDateTo}
            sortBy={transactionsSortBy}
            onSortByChange={setTransactionsSortBy}
            sortOrder={transactionsSortOrder}
            onSortOrderChange={setTransactionsSortOrder}
            isLoading={loadingTransactions}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
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
            transactions={analyticsTransactions} 
            accounts={accounts} 
          />
        );
      case "users":
        return isAdmin() ? <UserManagement /> : renderDashboard();
      case "system-settings":
        return isAdmin() ? <SystemSettings /> : renderDashboard();
      default:
        return renderDashboard();
    }
  };

  const pageTitles: { [key: string]: string } = {
    dashboard: "Dashboard",
    accounts: "Contas",
    "credit-bills": "Faturas de Crédito",
    transactions: "Transações",
    recurring: "Transações Recorrentes",
    fixed: "Transações Fixas",
    categories: "Categorias",
    analytics: "Análises",
    bybit: "Integração Bybit",
    settings: "Configurações",
    profile: "Meu Perfil",
    users: "Gerenciar Usuários",
    "system-settings": "Configurações do Sistema",
  };

  const getPageTitle = (page: string) => {
    return pageTitles[page] || "Dashboard";
  };

  return (
    <Layout
      pageTitle={getPageTitle(currentPage)}
      onNavigate={setCurrentPage}
      onClearAllData={handleClearAllData}
      loading={loadingData}
    >
      <MigrationWarning />

      {renderCurrentPage()}

      {/* Modals */}
      <AddAccountModal
        open={addAccountModalOpen}
        onOpenChange={setAddAccountModalOpen}
        onAccountAdded={(account) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
          toast({
            title: "Conta adicionada",
            description: `A conta "${account.name}" foi adicionada com sucesso.`,
          });
        }}
      />

      <AddTransactionModal
        open={addTransactionModalOpen}
        onOpenChange={setAddTransactionModalOpen}
        onTransactionAdded={handleAddTransaction}
        onInstallmentTransactionAdded={handleAddInstallmentTransactions}
        accounts={accounts}
        categories={categories}
        initialType={transactionInitialType}
        initialAccountType={transactionInitialAccountType}
        lockType={transactionLockType}
      />

      <EditAccountModal
        open={editAccountModalOpen}
        onOpenChange={setEditAccountModalOpen}
        account={editingAccount}
        onAccountEdited={handleEditAccount}
      />

      <EditTransactionModal
        open={editTransactionModalOpen}
        onOpenChange={setEditTransactionModalOpen}
        transaction={editingTransaction}
        onTransactionEdited={handleEditTransaction}
        accounts={accounts}
        categories={categories}
      />

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        accounts={accounts}
        onTransfer={async (fromAccountId, toAccountId, amountInCents, date) => {
          await handleTransfer(fromAccountId, toAccountId, amountInCents, date);
          const fromAccount = accounts.find(acc => acc.id === fromAccountId)!;
          const toAccount = accounts.find(acc => acc.id === toAccountId)!;
          return { fromAccount, toAccount };
        }}
      />

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
    </Layout>
  );
};

export default PlaniFlowApp;