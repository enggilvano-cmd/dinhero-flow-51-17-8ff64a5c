import { useSettings } from "@/context/SettingsContext";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCardsSkeletonGrid } from "@/components/transactions/StatCardSkeleton";
import { TransactionTableSkeleton } from "@/components/transactions/TransactionTableSkeleton";
import { TransactionHeader } from "@/components/transactions/TransactionHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TransactionList } from "@/components/transactions/TransactionList";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ImportTransactionsModal } from "./ImportTransactionsModal";
import { EditScope, TransactionScopeDialog } from "./TransactionScopeDialog";
import { FixedTransactionScopeDialog, FixedScope } from "./FixedTransactionScopeDialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TransactionFilterChips } from "@/components/transactions/TransactionFilterChips";
import { TransactionFilterDialog } from "@/components/transactions/TransactionFilterDialog";
import type { Transaction, Account, Category, ImportTransactionData } from '@/types';
import { ListErrorBoundary } from '@/components/ui/list-error-boundary';

interface TransactionsPageProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onAddTransaction: () => void;
  onTransfer: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string, scope?: EditScope) => void;
  onImportTransactions: (transactions: ImportTransactionData[], transactionsToReplace: string[]) => void;
  onMarkAsPaid?: (transaction: Transaction) => Promise<void>;
  totalCount: number;
  pageCount: number;
  currentPage: number;
  pageSize: number | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number | null) => void;
  search: string;
  onSearchChange: (search: string) => void;
  filterType: "all" | "income" | "expense" | "transfer";
  onFilterTypeChange: (type: "all" | "income" | "expense" | "transfer") => void;
  filterAccount: string;
  onFilterAccountChange: (accountId: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (categoryId: string) => void;
  filterStatus: "all" | "pending" | "completed";
  onFilterStatusChange: (status: "all" | "pending" | "completed") => void;
  filterAccountType: string;
  onFilterAccountTypeChange: (type: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange: (date: string | undefined) => void;
  onDateToChange: (date: string | undefined) => void;
  sortBy: "date" | "amount";
  onSortByChange: (sortBy: "date" | "amount") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
  isLoading?: boolean;
  periodFilter: "all" | "current_month" | "month_picker" | "custom";
  onPeriodFilterChange: (value: "all" | "current_month" | "month_picker" | "custom") => void;
  selectedMonth: Date;
  onSelectedMonthChange: (date: Date) => void;
  customStartDate: Date | undefined;
  onCustomStartDateChange: (date: Date | undefined) => void;
  customEndDate: Date | undefined;
  onCustomEndDateChange: (date: Date | undefined) => void;
}

export function TransactionsPage({
  transactions,
  accounts,
  categories,
  onAddTransaction,
  onTransfer,
  onEditTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onMarkAsPaid,
  totalCount,
  pageCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterAccount,
  onFilterAccountChange,
  filterCategory,
  onFilterCategoryChange,
  filterStatus,
  onFilterStatusChange,
  filterAccountType,
  onFilterAccountTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  isLoading = false,
  periodFilter,
  onPeriodFilterChange,
  selectedMonth,
  onSelectedMonthChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
}: TransactionsPageProps) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(null);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasCompletedTransactions, setHasCompletedTransactions] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  
  // Local search state with debounce (300ms para inputs de texto)
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Update parent search when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, search, onSearchChange]);

  // Sync local search with prop changes (for external resets)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const { toast } = useToast();
  const { settings, formatCurrency } = useSettings();

  // Filter accounts by type for the account selector
  const accountsByType = useMemo(() => {
    if (filterAccountType === "all") {
      return accounts;
    }
    return accounts.filter((account: any) => account.type === filterAccountType);
  }, [accounts, filterAccountType]);

  // Handle date filter changes
  const handleDateFilterChange = (value: "all" | "current_month" | "month_picker" | "custom") => {
    onPeriodFilterChange(value);
    
    if (value === "current_month") {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      onDateFromChange(format(start, 'yyyy-MM-dd'));
      onDateToChange(format(end, 'yyyy-MM-dd'));
    } else if (value === "all") {
      onDateFromChange(undefined);
      onDateToChange(undefined);
    }
  };

  const handleMonthChange = (newMonth: Date) => {
    onSelectedMonthChange(newMonth);
    const start = startOfMonth(newMonth);
    const end = endOfMonth(newMonth);
    onDateFromChange(format(start, 'yyyy-MM-dd'));
    onDateToChange(format(end, 'yyyy-MM-dd'));
  };

  // Update date range when custom dates change
  useEffect(() => {
    if (periodFilter === "custom" && customStartDate && customEndDate) {
      onDateFromChange(format(customStartDate, 'yyyy-MM-dd'));
      onDateToChange(format(customEndDate, 'yyyy-MM-dd'));
    }
  }, [customStartDate, customEndDate, periodFilter]);

  // Generate filter chips
  const filterChips = useMemo(() => {
    const chips = [];

    // Type filter
    if (filterType !== "all") {
      const typeLabels = {
        income: "Receita",
        expense: "Despesa",
        transfer: "Transferência",
      };
      chips.push({
        id: "type",
        label: `Tipo: ${typeLabels[filterType as keyof typeof typeLabels]}`,
        value: filterType,
        onRemove: () => onFilterTypeChange("all"),
      });
    }

    // Status filter
    if (filterStatus !== "all") {
      const statusLabels = {
        completed: "Concluído",
        pending: "Pendente",
      };
      chips.push({
        id: "status",
        label: `Status: ${statusLabels[filterStatus as keyof typeof statusLabels]}`,
        value: filterStatus,
        onRemove: () => onFilterStatusChange("all"),
      });
    }

    // Account type filter
    if (filterAccountType !== "all") {
      const accountTypeLabels = {
        checking: "Conta Corrente",
        credit: "Cartão de Crédito",
        investment: "Investimento",
        savings: "Poupança",
      };
      chips.push({
        id: "accountType",
        label: `Tipo: ${accountTypeLabels[filterAccountType as keyof typeof accountTypeLabels]}`,
        value: filterAccountType,
        onRemove: () => onFilterAccountTypeChange("all"),
      });
    }

    // Specific account filter
    if (filterAccount !== "all") {
      const account = accounts.find((a) => a.id === filterAccount);
      if (account) {
        chips.push({
          id: "account",
          label: `Conta: ${account.name}`,
          value: filterAccount,
          color: account.color,
          onRemove: () => onFilterAccountChange("all"),
        });
      }
    }

    // Category filter
    if (filterCategory !== "all") {
      const category = categories.find((c) => c.id === filterCategory);
      if (category) {
        chips.push({
          id: "category",
          label: `Categoria: ${category.name}`,
          value: filterCategory,
          color: category.color,
          onRemove: () => onFilterCategoryChange("all"),
        });
      }
    }

    // Period filter
    if (periodFilter !== "all") {
      let periodLabel = "";
      if (periodFilter === "current_month") {
        periodLabel = "Mês Atual";
      } else if (periodFilter === "month_picker") {
        periodLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
      } else if (periodFilter === "custom" && customStartDate && customEndDate) {
        periodLabel = `${format(customStartDate, "dd/MM/yyyy")} - ${format(customEndDate, "dd/MM/yyyy")}`;
      }
      
      if (periodLabel) {
        chips.push({
          id: "period",
          label: `Período: ${periodLabel}`,
          value: periodFilter,
          onRemove: () => handleDateFilterChange("all"),
        });
      }
    }

    return chips;
  }, [
    filterType,
    filterStatus,
    filterAccountType,
    filterAccount,
    filterCategory,
    periodFilter,
    selectedMonth,
    customStartDate,
    customEndDate,
    accounts,
    categories,
    onFilterTypeChange,
    onFilterStatusChange,
    onFilterAccountTypeChange,
    onFilterAccountChange,
    onFilterCategoryChange,
    handleDateFilterChange,
  ]);

  const clearAllFilters = () => {
    onFilterTypeChange("all");
    onFilterStatusChange("all");
    onFilterAccountTypeChange("all");
    onFilterAccountChange("all");
    onFilterCategoryChange("all");
    handleDateFilterChange("all");
  };

  // Calcular totais usando agregação SQL (evita N+1)
  const [aggregatedTotals, setAggregatedTotals] = useState({ income: 0, expenses: 0, balance: 0 });

  useEffect(() => {
    const fetchAggregatedTotals = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('get_transactions_totals', {
          p_user_id: user.id,
          p_type: filterType,
          p_status: filterStatus,
          p_account_id: filterAccount,
          p_category_id: filterCategory,
          p_account_type: filterAccountType,
          p_date_from: dateFrom || undefined,
          p_date_to: dateTo || undefined,
          p_search: search || undefined,
        });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setAggregatedTotals({
            income: data[0].total_income,
            expenses: data[0].total_expenses,
            balance: data[0].balance,
          });
        }
      } catch (error) {
        logger.error("Error fetching aggregated totals:", error);
      }
    };

    fetchAggregatedTotals();
  }, [
    filterType,
    filterStatus,
    filterAccount,
    filterCategory,
    filterAccountType,
    dateFrom,
    dateTo,
    search,
  ]);

  const exportToExcel = async () => {
    try {
      const { exportTransactionsToExcel } = await import('@/lib/exportUtils');
      await exportTransactionsToExcel(transactions, accounts, categories);
      
      toast({
        title: "Sucesso",
        description: `${transactions.length} transação${transactions.length !== 1 ? 'ões' : ''} exportada${transactions.length !== 1 ? 's' : ''} com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar transações",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWithScope = async (transactionId: string, scope?: EditScope) => {
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!scope && transaction) {
      // Verificar se é parcela, transação fixa ou recorrente
      const isInstallment = Boolean(transaction.installments && transaction.installments > 1);
      const isRecurring = Boolean(transaction.is_recurring || transaction.is_fixed);
      const hasParent = Boolean(transaction.parent_transaction_id);
      
      if (isInstallment || isRecurring || hasParent) {
        // Buscar informações sobre transações geradas (filhas)
        try {
          const parentId = transaction.parent_transaction_id || transaction.id;
          const { data: childTransactions } = await supabase
            .from("transactions")
            .select("id, status")
            .eq("parent_transaction_id", parentId);

          const pendingCount = childTransactions?.filter(t => t.status === "pending").length || 0;
          const hasCompleted = childTransactions?.some(t => t.status === "completed") || false;

          setPendingTransactionsCount(pendingCount);
          setHasCompletedTransactions(hasCompleted);
        } catch (error) {
          logger.error("Error fetching child transactions:", error);
          setPendingTransactionsCount(0);
          setHasCompletedTransactions(false);
        }
        
        // Abrir diálogo de escopo
        setPendingDeleteTransaction(transaction);
        setScopeDialogOpen(true);
        return;
      }
    }
    
    // Deletar diretamente se não for parcela/fixa/recorrente ou se já tiver scope
    onDeleteTransaction(transactionId, scope);
  };

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">
      <TransactionHeader
        onAddTransaction={onAddTransaction}
        onTransfer={onTransfer}
      />

      {/* Header Actions */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-3 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5 apple-interaction h-9 text-body px-3"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Importar</span>
          </Button>
          <Button
            variant="outline"
            onClick={exportToExcel}
            className="gap-1.5 apple-interaction h-9 text-body px-3"
            disabled={transactions.length === 0}
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Exportar</span>
          </Button>
          <Button
            onClick={onAddTransaction}
            className="gap-1.5 apple-interaction h-9 text-body col-span-2 md:col-span-1 px-3"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards (Usarão a 'formatCurrency' local corrigida) */}
      {isLoading ? (
        <StatCardsSkeletonGrid />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="financial-card">
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    Total Transações
                  </p>
                  <div className="balance-text">
                    {totalCount}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card">
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    Receitas
                  </p>
                  <div className="balance-text balance-positive">
                    {formatCurrency(aggregatedTotals.income)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card">
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    Despesas
                  </p>
                  <div className="balance-text balance-negative">
                    {formatCurrency(aggregatedTotals.expenses)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="financial-card">
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">
                    Saldo
                  </p>
                  <div
                    className={`balance-text ${
                      aggregatedTotals.balance >= 0
                        ? "balance-positive"
                        : "balance-negative"
                    }`}
                  >
                    {formatCurrency(aggregatedTotals.balance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* BLOCO DE FILTROS - ESTILO CHIPS */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Top bar: Filter button, chips, search, and sort */}
          <div className="flex flex-col gap-4">
            {/* Filter button and active chips */}
            <div className="flex flex-wrap items-center gap-3">
              <TransactionFilterDialog
                open={filterDialogOpen}
                onOpenChange={setFilterDialogOpen}
                filterType={filterType}
                onFilterTypeChange={(value) => onFilterTypeChange(value as any)}
                filterStatus={filterStatus}
                onFilterStatusChange={(value) => onFilterStatusChange(value as any)}
                filterAccountType={filterAccountType}
                onFilterAccountTypeChange={onFilterAccountTypeChange}
                filterAccount={filterAccount}
                onFilterAccountChange={onFilterAccountChange}
                filterCategory={filterCategory}
                onFilterCategoryChange={onFilterCategoryChange}
                periodFilter={periodFilter}
                onPeriodFilterChange={(value) => handleDateFilterChange(value as any)}
                selectedMonth={selectedMonth}
                onMonthChange={handleMonthChange}
                customStartDate={customStartDate}
                onCustomStartDateChange={onCustomStartDateChange}
                customEndDate={customEndDate}
                onCustomEndDateChange={onCustomEndDateChange}
                accounts={accountsByType}
                categories={categories}
                activeFiltersCount={filterChips.length}
              />
              
              <TransactionFilterChips
                chips={filterChips}
                onClearAll={clearAllFilters}
              />
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar transações..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => onSortByChange(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="amount">Valor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                  }
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {isLoading ? (
        <TransactionTableSkeleton />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl">
              Transações ({totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ListErrorBoundary fallbackMessage="Erro ao carregar lista de transações">
              <TransactionList
                transactions={transactions}
                accounts={accounts}
                categories={categories}
                currency={settings.currency}
                onEdit={onEditTransaction}
                onDelete={handleDeleteWithScope}
                onMarkAsPaid={onMarkAsPaid}
              />
            </ListErrorBoundary>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      <PaginationControls
        currentPage={currentPage}
        pageCount={pageCount}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[50, 100, 200]}
      />

      <ImportTransactionsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        accounts={accounts}
        transactions={transactions}
        onImportTransactions={onImportTransactions}
      />

      {pendingDeleteTransaction && (pendingDeleteTransaction.is_fixed || pendingDeleteTransaction.parent_transaction_id) && (
        <FixedTransactionScopeDialog
          open={scopeDialogOpen}
          onOpenChange={setScopeDialogOpen}
          onScopeSelected={(scope: FixedScope) => {
            if (pendingDeleteTransaction) {
              // Converter FixedScope para EditScope
              const editScope: EditScope =
                scope === "current"
                  ? "current"
                  : scope === "current-and-remaining"
                    ? "current-and-remaining"
                    : "all";
              onDeleteTransaction(pendingDeleteTransaction.id, editScope);
              setPendingDeleteTransaction(null);
            }
          }}
          mode="delete"
          hasCompleted={hasCompletedTransactions}
          pendingCount={pendingTransactionsCount}
        />
      )}

      {pendingDeleteTransaction && !pendingDeleteTransaction.is_fixed && !pendingDeleteTransaction.parent_transaction_id && (
        <TransactionScopeDialog
          open={scopeDialogOpen}
          onOpenChange={setScopeDialogOpen}
          onScopeSelected={(scope) => {
            if (pendingDeleteTransaction) {
              onDeleteTransaction(pendingDeleteTransaction.id, scope);
              setPendingDeleteTransaction(null);
            }
          }}
          currentInstallment={pendingDeleteTransaction.current_installment || 1}
          totalInstallments={pendingDeleteTransaction.installments || 1}
          isRecurring={Boolean(pendingDeleteTransaction.is_recurring)}
          mode="delete"
        />
      )}
    </div>
  );
}