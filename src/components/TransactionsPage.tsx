import { useSettings } from "@/context/SettingsContext";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCardsSkeletonGrid } from "@/components/transactions/StatCardSkeleton";
import { TransactionTableSkeleton } from "@/components/transactions/TransactionTableSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  CalendarIcon,
  Download,
  Upload,
  BarChart3,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TransactionList } from "@/components/transactions/TransactionList";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ImportTransactionsModal } from "./ImportTransactionsModal";
import { EditScope, TransactionScopeDialog } from "./TransactionScopeDialog";
import { FixedTransactionScopeDialog, FixedScope } from "./FixedTransactionScopeDialog";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface TransactionsPageProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
  onAddTransaction: () => void;
  onEditTransaction: (transaction: any) => void;
  onDeleteTransaction: (transactionId: string, scope?: EditScope) => void;
  onImportTransactions: (transactions: any[], transactionsToReplace: string[]) => void;
  onMarkAsPaid?: (transaction: any) => Promise<void>;
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
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<any>(null);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasCompletedTransactions, setHasCompletedTransactions] = useState(false);
  
  // Local search state with debounce
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);

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
  const { settings } = useSettings();

  // =================================================================
  // CORREÇÃO 1: A função 'formatCurrency' local deve dividir por 100
  // =================================================================
  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat(settings.language === 'pt-BR' ? 'pt-BR' : settings.language === 'es-ES' ? 'es-ES' : 'en-US', {
      style: "currency",
      currency: settings.currency,
    }).format(valueInCents / 100); // Dividido por 100
  };

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

  const handleCustomDateChange = (startDate: Date | undefined, endDate: Date | undefined) => {
    onCustomStartDateChange(startDate);
    onCustomEndDateChange(endDate);
    if (startDate && endDate) {
      onDateFromChange(format(startDate, 'yyyy-MM-dd'));
      onDateToChange(format(endDate, 'yyyy-MM-dd'));
    } else {
      onDateFromChange(undefined);
      onDateToChange(undefined);
    }
  };

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        // Skip transfers as they don't affect total income/expenses
        const isTransfer = transaction.to_account_id != null;
        if (!isTransfer) {
          if (transaction.type === "income") {
            acc.income += transaction.amount;
          } else if (transaction.type === "expense") {
            // Despesas vêm negativas do banco, então usar Math.abs para somar positivo
            acc.expenses += Math.abs(transaction.amount);
          }
        }
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [transactions]);

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
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-3 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5 apple-interaction h-9 text-xs sm:text-sm px-3"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Importar</span>
          </Button>
          <Button
            variant="outline"
            onClick={exportToExcel}
            className="gap-1.5 apple-interaction h-9 text-xs sm:text-sm px-3"
            disabled={transactions.length === 0}
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Exportar</span>
          </Button>
          <Button
            onClick={onAddTransaction}
            className="gap-1.5 apple-interaction h-9 text-xs sm:text-sm col-span-2 md:col-span-1 px-3"
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
                  <p className="text-caption font-medium text-muted-foreground">
                    Total Transações
                  </p>
                  <div className="text-responsive-xl font-bold leading-tight">
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
                  <p className="text-caption font-medium text-muted-foreground">
                    Receitas
                  </p>
                  <div className="text-responsive-xl font-bold balance-positive leading-tight">
                    {formatCurrency(totals.income)}
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
                  <p className="text-caption font-medium text-muted-foreground">
                    Despesas
                  </p>
                  <div className="text-responsive-xl font-bold balance-negative leading-tight">
                    {formatCurrency(totals.expenses)}
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
                  <p className="text-caption font-medium text-muted-foreground">
                    Saldo
                  </p>
                  <div
                    className={`text-responsive-xl font-bold leading-tight ${
                      totals.income - totals.expenses >= 0
                        ? "balance-positive"
                        : "balance-negative"
                    }`}
                  >
                    {formatCurrency(totals.income - totals.expenses)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* BLOCO DE FILTROS */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo */}
            <div>
              <Label htmlFor="filterType" className="text-caption">Tipo</Label>
              <Select
                value={filterType}
                onValueChange={(value: any) => onFilterTypeChange(value)}
              >
                <SelectTrigger className="touch-target mt-2" id="filterType">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="filterStatus" className="text-caption">Status</Label>
              <Select
                value={filterStatus}
                onValueChange={(value: any) => onFilterStatusChange(value)}
              >
                <SelectTrigger className="touch-target mt-2" id="filterStatus">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Conta */}
            <div>
              <Label htmlFor="filterAccountType" className="text-caption">Tipo de Conta</Label>
              <Select
                value={filterAccountType}
                onValueChange={(value: string) => onFilterAccountTypeChange(value)}
              >
                <SelectTrigger
                  className="touch-target mt-2"
                  id="filterAccountType"
                >
                  <SelectValue placeholder="Tipo de Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="credit">Cartão de Crédito</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conta Específica */}
            <div>
              <Label htmlFor="filterAccount" className="text-caption">Conta</Label>
              <Select value={filterAccount} onValueChange={onFilterAccountChange}>
                <SelectTrigger
                  className="touch-target mt-2"
                  id="filterAccount"
                >
                  <SelectValue placeholder="Conta Específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {accountsByType.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: account.color || "#6b7280",
                          }}
                        />
                        <span className="truncate">{account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div>
              <Label htmlFor="filterCategory" className="text-caption">Categoria</Label>
              <Select
                value={filterCategory}
                onValueChange={onFilterCategoryChange}
              >
                <SelectTrigger
                  className="touch-target mt-2"
                  id="filterCategory"
                >
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: category.color || "#6b7280",
                          }}
                        />
                        <span className="truncate">{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div>
              <Label htmlFor="periodFilter" className="text-caption">Personalizado</Label>
              <Select
                value={periodFilter}
                onValueChange={handleDateFilterChange}
              >
                <SelectTrigger className="touch-target mt-2" id="periodFilter">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="current_month">Mês Atual</SelectItem>
                  <SelectItem value="month_picker">Seletor de Mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordenação */}
            <div>
              <Label className="text-caption">Filtrar</Label>
              <div className="flex gap-1 mt-2">
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => onSortByChange(value)}
                >
                  <SelectTrigger className="flex-1 touch-target">
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
                  className="touch-target"
                  onClick={() =>
                    onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                  }
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </Button>
              </div>
            </div>

            {/* Busca */}
            <div className="sm:col-span-2">
              <Label htmlFor="search" className="text-caption">Buscar</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar transações..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
          </div>

          {/* Controles de data - mostrar apenas quando necessário */}
          {periodFilter === "month_picker" && (
            <div className="border-t border-border mt-4 pt-4">
              <div className="flex items-center gap-1 px-3 border border-input rounded-md bg-background max-w-xs mx-auto touch-target">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMonthChange(subMonths(selectedMonth, 1))}
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="flex-1 text-center text-system-body">
                  {format(selectedMonth, "MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMonthChange(addMonths(selectedMonth, 1))}
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          {periodFilter === "custom" && (
            <div className="border-t border-border mt-4 pt-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-xs mx-auto">
                <Popover
                  open={startDatePickerOpen}
                  onOpenChange={setStartDatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal text-xs sm:text-sm",
                        !customStartDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customStartDate
                          ? format(customStartDate, "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "Data Inicial"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => {
                        handleCustomDateChange(date, customEndDate);
                        setStartDatePickerOpen(false);
                      }}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>

                <Popover
                  open={endDatePickerOpen}
                  onOpenChange={setEndDatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal text-xs sm:text-sm",
                        !customEndDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">
                        {customEndDate
                          ? format(customEndDate, "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "Data Final"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => {
                        handleCustomDateChange(customStartDate, date);
                        setEndDatePickerOpen(false);
                      }}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
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
            <TransactionList
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              currency={settings.currency}
              onEdit={onEditTransaction}
              onDelete={handleDeleteWithScope}
              onMarkAsPaid={onMarkAsPaid}
            />
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