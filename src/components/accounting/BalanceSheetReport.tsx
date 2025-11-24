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

interface BalanceSheetReportProps {
  journalEntries: JournalEntry[];
  chartAccounts: ChartAccount[];
  isLoading?: boolean;
  referenceDate: string;
}

export function BalanceSheetReport({
  journalEntries,
  chartAccounts,
  isLoading = false,
  referenceDate,
}: BalanceSheetReportProps) {
  const balanceSheetData = useMemo(() => {
    const assets: Array<{ code: string; name: string; balance: number }> = [];
    const liabilities: Array<{ code: string; name: string; balance: number }> = [];
    const equity: Array<{ code: string; name: string; balance: number }> = [];

    // Calcular saldo de cada conta
    const accountBalances = new Map<string, number>();

    journalEntries.forEach(entry => {
      const account = chartAccounts.find(a => a.id === entry.account_id);
      if (!account) return;

      const current = accountBalances.get(entry.account_id) || 0;
      
      // Débito aumenta para contas de natureza débito, diminui para crédito
      if (account.nature === 'debit') {
        accountBalances.set(
          entry.account_id,
          entry.entry_type === 'debit' ? current + entry.amount : current - entry.amount
        );
      } else {
        accountBalances.set(
          entry.account_id,
          entry.entry_type === 'credit' ? current + entry.amount : current - entry.amount
        );
      }
    });

    // Classificar contas
    accountBalances.forEach((balance, accountId) => {
      const account = chartAccounts.find(a => a.id === accountId);
      if (!account || balance === 0) return;

      const item = {
        code: account.code,
        name: account.name,
        balance: Math.abs(balance),
      };

      if (account.category === 'asset' || account.category === 'contra_liability') {
        assets.push(item);
      } else if (account.category === 'liability' || account.category === 'contra_asset') {
        liabilities.push(item);
      } else if (account.category === 'equity') {
        equity.push(item);
      }
    });

    // Ordenar
    assets.sort((a, b) => a.code.localeCompare(b.code));
    liabilities.sort((a, b) => a.code.localeCompare(b.code));
    equity.sort((a, b) => a.code.localeCompare(b.code));

    const totalAssets = assets.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.balance, 0);
    const totalEquity = equity.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isBalanced = difference < 0.01; // Tolerância

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference,
      isBalanced,
    };
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
        <CardTitle className="text-headline">Balanço Patrimonial</CardTitle>
        <CardDescription className="text-body">
          Posição em {new Date(referenceDate).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Alerta de Validação da Equação Fundamental */}
        {balanceSheetData.isBalanced ? (
          <Alert className="mb-6 border-success bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-body">
              Equação fundamental balanceada: Ativo = Passivo + Patrimônio Líquido
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-body">
              <strong>Desbalanceado!</strong> Diferença de {formatCurrency(balanceSheetData.difference)}
              <br />
              Ativo: {formatCurrency(balanceSheetData.totalAssets)} ≠ Passivo + PL: {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* ATIVO */}
          <div>
            <h3 className="text-title font-bold mb-4 border-b-2 border-primary pb-2">ATIVO</h3>
            <div className="space-y-2">
              {balanceSheetData.assets.map((item) => (
                <div key={item.code} className="flex justify-between">
                  <span className="text-body">
                    {item.code} - {item.name}
                  </span>
                  <span className="balance-text">
                    {formatCurrency(item.balance)}
                  </span>
                </div>
              ))}
              {balanceSheetData.assets.length === 0 && (
                <p className="text-caption text-muted-foreground">Nenhum ativo registrado</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t-2 font-semibold">
              <div className="flex justify-between">
                <span className="text-body-large">TOTAL DO ATIVO</span>
                <span className="balance-text text-success">
                  {formatCurrency(balanceSheetData.totalAssets)}
                </span>
              </div>
            </div>
          </div>

          {/* PASSIVO + PATRIMÔNIO LÍQUIDO */}
          <div>
            <div>
              <h3 className="text-title font-bold mb-4 border-b-2 border-primary pb-2">PASSIVO</h3>
              <div className="space-y-2">
                {balanceSheetData.liabilities.map((item) => (
                  <div key={item.code} className="flex justify-between">
                    <span className="text-body">
                      {item.code} - {item.name}
                    </span>
                    <span className="balance-text">
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                ))}
                {balanceSheetData.liabilities.length === 0 && (
                  <p className="text-caption text-muted-foreground">Nenhum passivo registrado</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t font-semibold">
                <div className="flex justify-between">
                  <span className="text-body-large">Total do Passivo</span>
                  <span className="balance-text">
                    {formatCurrency(balanceSheetData.totalLiabilities)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-title font-bold mb-4 border-b-2 border-primary pb-2">PATRIMÔNIO LÍQUIDO</h3>
              <div className="space-y-2">
                {balanceSheetData.equity.map((item) => (
                  <div key={item.code} className="flex justify-between">
                    <span className="text-body">
                      {item.code} - {item.name}
                    </span>
                    <span className="balance-text">
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                ))}
                {balanceSheetData.equity.length === 0 && (
                  <p className="text-caption text-muted-foreground">Nenhuma conta de PL registrada</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t font-semibold">
                <div className="flex justify-between">
                  <span className="text-body-large">Total do Patrimônio Líquido</span>
                  <span className="balance-text">
                    {formatCurrency(balanceSheetData.totalEquity)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t-2 border-primary font-semibold">
              <div className="flex justify-between">
                <span className="text-body-large">TOTAL DO PASSIVO + PL</span>
                <span className={`balance-text ${balanceSheetData.isBalanced ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
