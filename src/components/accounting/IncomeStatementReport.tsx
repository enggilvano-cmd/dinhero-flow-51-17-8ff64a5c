import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

interface JournalEntry {
  id: string;
  account_id: string;
  entry_type: string;
  amount: number;
  entry_date: string;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  nature: string;
}

interface IncomeStatementReportProps {
  journalEntries: JournalEntry[];
  chartAccounts: ChartAccount[];
  isLoading?: boolean;
  periodStart: string;
  periodEnd: string;
}

export function IncomeStatementReport({
  journalEntries,
  chartAccounts,
  isLoading = false,
  periodStart,
  periodEnd,
}: IncomeStatementReportProps) {
  const dreData = useMemo(() => {
    const revenues: Array<{ code: string; name: string; amount: number }> = [];
    const expenses: Array<{ code: string; name: string; amount: number }> = [];

    // Agrupar lançamentos por conta
    const accountTotals = new Map<string, number>();

    journalEntries.forEach(entry => {
      const account = chartAccounts.find(a => a.id === entry.account_id);
      if (!account) return;

      // Receitas (crédito aumenta) e Despesas (débito aumenta)
      if (account.category === 'revenue') {
        const current = accountTotals.get(entry.account_id) || 0;
        accountTotals.set(
          entry.account_id,
          entry.entry_type === 'credit' ? current + entry.amount : current - entry.amount
        );
      } else if (account.category === 'expense') {
        const current = accountTotals.get(entry.account_id) || 0;
        accountTotals.set(
          entry.account_id,
          entry.entry_type === 'debit' ? current + entry.amount : current - entry.amount
        );
      }
    });

    // Separar em receitas e despesas
    accountTotals.forEach((amount, accountId) => {
      const account = chartAccounts.find(a => a.id === accountId);
      if (!account) return;

      if (account.category === 'revenue') {
        revenues.push({
          code: account.code,
          name: account.name,
          amount,
        });
      } else if (account.category === 'expense') {
        expenses.push({
          code: account.code,
          name: account.name,
          amount,
        });
      }
    });

    // Ordenar por código
    revenues.sort((a, b) => a.code.localeCompare(b.code));
    expenses.sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = revenues.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netIncome = totalRevenue - totalExpense;

    return { revenues, expenses, totalRevenue, totalExpense, netIncome };
  }, [journalEntries, chartAccounts]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">DRE - Demonstração do Resultado do Exercício</CardTitle>
        <CardDescription className="text-body">
          Período: {new Date(periodStart).toLocaleDateString('pt-BR')} a {new Date(periodEnd).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Receitas */}
          <div>
            <h3 className="text-body-large font-semibold mb-3">RECEITAS</h3>
            <div className="space-y-2 pl-4">
              {dreData.revenues.map((item) => (
                <div key={item.code} className="flex justify-between">
                  <span className="text-body">
                    {item.code} - {item.name}
                  </span>
                  <span className="balance-text text-success">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {dreData.revenues.length === 0 && (
                <p className="text-caption text-muted-foreground">Nenhuma receita no período</p>
              )}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t font-semibold">
              <span className="text-body-large">Total de Receitas</span>
              <span className="balance-text text-success">
                {formatCurrency(dreData.totalRevenue)}
              </span>
            </div>
          </div>

          {/* Despesas */}
          <div>
            <h3 className="text-body-large font-semibold mb-3">DESPESAS</h3>
            <div className="space-y-2 pl-4">
              {dreData.expenses.map((item) => (
                <div key={item.code} className="flex justify-between">
                  <span className="text-body">
                    {item.code} - {item.name}
                  </span>
                  <span className="balance-text text-destructive">
                    ({formatCurrency(item.amount)})
                  </span>
                </div>
              ))}
              {dreData.expenses.length === 0 && (
                <p className="text-caption text-muted-foreground">Nenhuma despesa no período</p>
              )}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t font-semibold">
              <span className="text-body-large">Total de Despesas</span>
              <span className="balance-text text-destructive">
                ({formatCurrency(dreData.totalExpense)})
              </span>
            </div>
          </div>

          {/* Resultado Líquido */}
          <div className="pt-6 border-t-2 border-primary">
            <div className="flex justify-between items-center">
              <span className="text-title font-bold">RESULTADO LÍQUIDO DO PERÍODO</span>
              <span className={`text-display font-bold ${dreData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
                {dreData.netIncome >= 0 ? '' : '('}
                {formatCurrency(Math.abs(dreData.netIncome))}
                {dreData.netIncome >= 0 ? '' : ')'}
              </span>
            </div>
            <p className="text-caption text-muted-foreground mt-2">
              {dreData.netIncome >= 0 ? 'Lucro' : 'Prejuízo'} no período
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
