import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface TrialBalanceReportProps {
  journalEntries: JournalEntry[];
  chartAccounts: ChartAccount[];
  isLoading?: boolean;
  periodStart: string;
  periodEnd: string;
}

export function TrialBalanceReport({
  journalEntries,
  chartAccounts,
  isLoading = false,
  periodStart,
  periodEnd,
}: TrialBalanceReportProps) {
  const trialBalanceData = useMemo(() => {
    // Agrupar lançamentos por conta contábil
    const accountTotals = new Map<string, { debit: number; credit: number }>();

    journalEntries.forEach(entry => {
      const current = accountTotals.get(entry.account_id) || { debit: 0, credit: 0 };
      
      if (entry.entry_type === 'debit') {
        current.debit += entry.amount;
      } else {
        current.credit += entry.amount;
      }
      
      accountTotals.set(entry.account_id, current);
    });

    // Mapear para estrutura do relatório
    const balances = Array.from(accountTotals.entries()).map(([accountId, totals]) => {
      const account = chartAccounts.find(a => a.id === accountId);
      return {
        accountId,
        code: account?.code || '',
        name: account?.name || 'Conta não encontrada',
        category: account?.category || '',
        nature: account?.nature || '',
        debit: totals.debit,
        credit: totals.credit,
        balance: totals.debit - totals.credit,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));

    // Calcular totais
    const totalDebit = balances.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = balances.reduce((sum, item) => sum + item.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01; // Tolerância para arredondamentos

    return { balances, totalDebit, totalCredit, difference, isBalanced };
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
        <CardTitle className="text-headline">Balancete de Verificação</CardTitle>
        <CardDescription className="text-body">
          Período: {new Date(periodStart).toLocaleDateString('pt-BR')} a {new Date(periodEnd).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Alerta de Validação */}
        {trialBalanceData.isBalanced ? (
          <Alert className="mb-6 border-success bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-body">
              Balancete equilibrado: Débitos = Créditos
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-body">
              <strong>Desbalanceado!</strong> Diferença de {formatCurrency(trialBalanceData.difference)}
            </AlertDescription>
          </Alert>
        )}

        {/* Tabela de Contas */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left text-caption font-semibold py-3 px-2">Código</th>
                <th className="text-left text-caption font-semibold py-3 px-4">Conta</th>
                <th className="text-right text-caption font-semibold py-3 px-4">Débito</th>
                <th className="text-right text-caption font-semibold py-3 px-4">Crédito</th>
                <th className="text-right text-caption font-semibold py-3 px-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {trialBalanceData.balances.map((item) => (
                <tr key={item.accountId} className="border-b hover:bg-muted/50">
                  <td className="text-caption py-3 px-2">{item.code}</td>
                  <td className="text-body py-3 px-4">{item.name}</td>
                  <td className="text-body text-right py-3 px-4">
                    {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                  </td>
                  <td className="text-body text-right py-3 px-4">
                    {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                  </td>
                  <td className={`balance-text text-right py-3 px-2 ${item.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(Math.abs(item.balance))}
                  </td>
                </tr>
              ))}
              
              {/* Totais */}
              <tr className="border-t-2 font-semibold bg-muted/30">
                <td colSpan={2} className="text-body-large py-4 px-2">TOTAIS</td>
                <td className="balance-text text-right py-4 px-4">
                  {formatCurrency(trialBalanceData.totalDebit)}
                </td>
                <td className="balance-text text-right py-4 px-4">
                  {formatCurrency(trialBalanceData.totalCredit)}
                </td>
                <td className={`balance-text text-right py-4 px-2 ${trialBalanceData.isBalanced ? 'text-success' : 'text-destructive'}`}>
                  {trialBalanceData.isBalanced ? '✓ Equilibrado' : `⚠ ${formatCurrency(trialBalanceData.difference)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
