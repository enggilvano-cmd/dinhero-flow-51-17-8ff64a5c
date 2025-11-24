import { useMemo, useEffect, useState } from 'react';
import type { Account, Transaction, DateFilterType } from '@/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export function useDashboardCalculations(
  accounts: Account[],
  filteredTransactions: Transaction[],
  dateFilter: DateFilterType,
  selectedMonth: Date,
  customStartDate: Date | undefined,
  customEndDate: Date | undefined
) {
  // Saldo total das contas (excluindo credit e investment)
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

  // Usar agregação SQL para totais do período (consistente com TransactionsPage)
  const [aggregatedTotals, setAggregatedTotals] = useState({
    periodIncome: 0,
    periodExpenses: 0,
    balance: 0,
  });

  // Calcular date range baseado no filtro (memoizado para estabilidade)
  const dateRange = useMemo(() => {
    if (dateFilter === 'all') {
      return { dateFrom: undefined, dateTo: undefined };
    } else if (dateFilter === 'current_month') {
      const now = new Date();
      return {
        dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    } else if (dateFilter === 'month_picker') {
      return {
        dateFrom: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
      };
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return {
        dateFrom: format(customStartDate, 'yyyy-MM-dd'),
        dateTo: format(customEndDate, 'yyyy-MM-dd'),
      };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [dateFilter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => {
    const fetchAggregatedTotals = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('get_transactions_totals', {
          p_user_id: user.id,
          p_type: 'all',
          p_status: 'all',
          p_account_id: undefined,
          p_category_id: undefined,
          p_account_type: 'all',
          p_date_from: dateRange.dateFrom,
          p_date_to: dateRange.dateTo,
          p_search: undefined,
        });

        if (error) {
          logger.error("Error fetching aggregated totals:", error);
          return;
        }
        
        if (data && data.length > 0) {
          setAggregatedTotals({
            periodIncome: data[0].total_income,
            periodExpenses: data[0].total_expenses,
            balance: data[0].balance,
          });
        }
      } catch (error) {
        logger.error("Error fetching aggregated totals:", error);
      }
    };

    fetchAggregatedTotals();
  }, [dateRange]);

  // Calcular despesas de cartão de crédito do período (filtradas)
  const creditCardExpenses = useMemo(() => 
    filteredTransactions
      .filter((t) => {
        const account = accounts.find((acc) => acc.id === t.account_id);
        return t.type === 'expense' && account?.type === 'credit';
      })
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions, accounts]
  );

  // Calcular pendências (filtradas)
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
    return 'Período Selecionado';
  };

  return {
    totalBalance,
    creditAvailable,
    periodIncome: aggregatedTotals.periodIncome,
    periodExpenses: aggregatedTotals.periodExpenses,
    creditCardExpenses,
    pendingExpenses,
    pendingIncome,
    pendingExpensesCount,
    pendingIncomeCount,
    getPeriodLabel,
  };
}
