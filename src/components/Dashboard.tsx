import { useMemo } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { Account, Transaction, Category } from '@/types';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { useDashboardCalculations } from '@/hooks/useDashboardCalculations';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { FilterCard } from './dashboard/FilterCard';
import { BalanceCards } from './dashboard/BalanceCards';
import { FinancialEvolutionChart } from './dashboard/FinancialEvolutionChart';
import { AccountsSummary } from './dashboard/AccountsSummary';
import { RecentTransactions } from './dashboard/RecentTransactions';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  onTransfer: () => void;
  onAddTransaction: () => void;
  onAddAccount?: () => void;
  onAddExpense?: () => void;
  onAddIncome?: () => void;
  onAddCreditExpense?: () => void;
  onNavigateToAccounts?: (filterType?: 'credit') => void;
  onNavigateToTransactions?: (
    filterType?: 'income' | 'expense',
    filterStatus?: 'all' | 'pending' | 'completed',
    dateFilter?: 'all' | 'current_month' | 'custom' | 'month_picker',
    filterAccountType?: 'all' | 'checking' | 'savings' | 'credit',
    selectedMonth?: Date,
    customStartDate?: Date,
    customEndDate?: Date
  ) => void;
}

export function Dashboard({
  accounts,
  transactions,
  onTransfer,
  onAddTransaction,
  onAddAccount,
  onAddExpense,
  onAddIncome,
  onAddCreditExpense,
  onNavigateToAccounts,
  onNavigateToTransactions,
}: DashboardProps) {
  const { formatCurrency } = useSettings();

  const {
    dateFilter,
    setDateFilter,
    selectedMonth,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    startDatePickerOpen,
    setStartDatePickerOpen,
    endDatePickerOpen,
    setEndDatePickerOpen,
    getFilteredTransactions,
    goToPreviousMonth,
    goToNextMonth,
    getNavigationParams,
  } = useDashboardFilters();

  const filteredTransactions = useMemo(
    () => getFilteredTransactions(transactions),
    [transactions, getFilteredTransactions]
  );

  const {
    totalBalance,
    creditAvailable,
    periodIncome,
    periodExpenses,
    creditCardExpenses,
    pendingExpenses,
    pendingIncome,
    pendingExpensesCount,
    pendingIncomeCount,
    getPeriodLabel,
  } = useDashboardCalculations(
    accounts,
    filteredTransactions,
    dateFilter,
    selectedMonth,
    customStartDate,
    customEndDate
  );

  return (
    <div className="space-y-3 sm:space-y-4 fade-in max-w-screen-2xl mx-auto px-2 sm:px-0 pb-6 sm:pb-8">
      <DashboardHeader
        onTransfer={onTransfer}
        onAddExpense={onAddExpense || onAddTransaction}
        onAddIncome={onAddIncome || onAddTransaction}
        onAddCreditExpense={onAddCreditExpense || onAddTransaction}
      />

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <FilterCard
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            selectedMonth={selectedMonth}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            startDatePickerOpen={startDatePickerOpen}
            setStartDatePickerOpen={setStartDatePickerOpen}
            endDatePickerOpen={endDatePickerOpen}
            setEndDatePickerOpen={setEndDatePickerOpen}
            goToPreviousMonth={goToPreviousMonth}
            goToNextMonth={goToNextMonth}
          />

          <BalanceCards
            formatCurrency={formatCurrency}
            totalBalance={totalBalance}
            periodIncome={periodIncome}
            periodExpenses={periodExpenses}
            creditAvailable={creditAvailable}
            creditCardExpenses={creditCardExpenses}
            pendingIncome={pendingIncome}
            pendingExpenses={pendingExpenses}
            pendingIncomeCount={pendingIncomeCount}
            pendingExpensesCount={pendingExpensesCount}
            getPeriodLabel={getPeriodLabel}
            getNavigationParams={getNavigationParams}
            onNavigateToAccounts={onNavigateToAccounts}
            onNavigateToTransactions={onNavigateToTransactions}
          />
        </div>

        <FinancialEvolutionChart
          transactions={transactions}
          accounts={accounts}
          dateFilter={dateFilter}
          selectedMonth={selectedMonth}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <AccountsSummary
            accounts={accounts}
            onNavigateToAccounts={onNavigateToAccounts}
            onAddAccount={onAddAccount}
          />

          <RecentTransactions
            transactions={filteredTransactions}
            maxItems={Math.max(accounts.length, 3)}
            onNavigateToTransactions={onNavigateToTransactions}
            onAddTransaction={onAddTransaction}
          />
        </div>
      </div>
    </div>
  );
}
