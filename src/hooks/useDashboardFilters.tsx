import { useState, useCallback } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { Transaction, DateFilterType } from '@/types';
import { createDateFromString } from '@/lib/dateUtils';

export function useDashboardFilters() {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('current_month');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  const getFilteredTransactions = useCallback((transactions: Transaction[]) => {
    let filtered = transactions;

    if (dateFilter === 'current_month') {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter((t) => {
        const transactionDate = typeof t.date === 'string' 
          ? createDateFromString(t.date) 
          : t.date;
        return isWithinInterval(transactionDate, { start, end });
      });
    } else if (dateFilter === 'month_picker') {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      filtered = filtered.filter((t) => {
        const transactionDate = typeof t.date === 'string' 
          ? createDateFromString(t.date) 
          : t.date;
        return isWithinInterval(transactionDate, { start, end });
      });
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      filtered = filtered.filter((t) => {
        const transactionDate = typeof t.date === 'string' 
          ? createDateFromString(t.date) 
          : t.date;
        return isWithinInterval(transactionDate, {
          start: customStartDate,
          end: customEndDate,
        });
      });
    }

    return filtered;
  }, [dateFilter, selectedMonth, customStartDate, customEndDate]);

  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  }, []);

  const getNavigationParams = useCallback(() => {
    if (dateFilter === 'current_month') {
      return {
        dateFilter: 'current_month' as const,
        selectedMonth: undefined,
        customStartDate: undefined,
        customEndDate: undefined,
      };
    } else if (dateFilter === 'month_picker') {
      return {
        dateFilter: 'month_picker' as const,
        selectedMonth,
        customStartDate: undefined,
        customEndDate: undefined,
      };
    } else if (dateFilter === 'custom') {
      return {
        dateFilter: 'custom' as const,
        selectedMonth: undefined,
        customStartDate,
        customEndDate,
      };
    }
    return {
      dateFilter: 'all' as const,
      selectedMonth: undefined,
      customStartDate: undefined,
      customEndDate: undefined,
    };
  }, [dateFilter, selectedMonth, customStartDate, customEndDate]);

  return {
    dateFilter,
    setDateFilter,
    selectedMonth,
    setSelectedMonth,
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
  };
}
