import { useMemo } from 'react';
import { Account, Transaction } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateFilterType } from './useDashboardFilters';

export function useDashboardCalculations(
  accounts: Account[],
  filteredTransactions: Transaction[],
  dateFilter: DateFilterType,
  selectedMonth: Date,
  customStartDate: Date | undefined,
  customEndDate: Date | undefined,
  t: (key: string) => string
) {
  const totalBalance = useMemo(() => 
    accounts
      .filter((acc) => acc.type !== 'credit' && acc.type !== 'investment')
      .reduce((sum, acc) => sum + acc.balance, 0),
    [accounts]
  );

  const creditAvailable = useMemo(() => 
    accounts
      .filter((acc) => acc.type === 'credit')
      .reduce((sum, acc) => {
        const limit = acc.limit_amount || 0;
        const used = Math.abs(acc.balance);
        return sum + (limit - used);
      }, 0),
    [accounts]
  );

  const periodIncome = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const periodExpenses = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const creditCardExpenses = useMemo(() => 
    filteredTransactions
      .filter((t) => {
        const account = accounts.find((acc) => acc.id === t.account_id);
        return t.type === 'expense' && account?.type === 'credit';
      })
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions, accounts]
  );

  const pendingExpenses = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const pendingIncome = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const pendingExpensesCount = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'expense' && t.status === 'pending')
      .length,
    [filteredTransactions]
  );

  const pendingIncomeCount = useMemo(() => 
    filteredTransactions
      .filter((t) => t.type === 'income' && t.status === 'pending')
      .length,
    [filteredTransactions]
  );

  const getPeriodLabel = () => {
    if (dateFilter === 'all') {
      return 'Todas as transações';
    } else if (dateFilter === 'current_month') {
      return new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
    } else if (dateFilter === 'month_picker') {
      return selectedMonth.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'dd/MM/yyyy', {
        locale: ptBR,
      })} - ${format(customEndDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    return t('dashboard.selectedPeriod');
  };

  return {
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
  };
}
