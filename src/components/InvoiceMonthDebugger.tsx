import { useTransactionStore } from "@/stores/TransactionStore";
import { useAccountStore } from "@/stores/AccountStore";
import { calculateInvoiceMonthByDue } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Componente de Debug para visualizar o invoice_month calculado vs salvo
 * Útil para diagnosticar problemas com faturas de cartão
 */
export function InvoiceMonthDebugger() {
  const transactions = useTransactionStore((state) => state.transactions);
  const accounts = useAccountStore((state) => state.accounts);
  
  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.closing_date);
  
  if (creditAccounts.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-yellow-500">
      <CardHeader>
        <CardTitle className="text-sm text-yellow-700">Debug: Invoice Month</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        {creditAccounts.map(account => {
          const accountTxs = transactions
            .filter(t => t.account_id === account.id && t.type === 'expense')
            .slice(0, 5); // Mostra apenas 5 transações
          
          if (accountTxs.length === 0) return null;
          
          return (
            <div key={account.id} className="space-y-1 p-2 bg-muted rounded">
              <div className="font-bold">{account.name} (Fecha: {account.closing_date})</div>
              {accountTxs.map(tx => {
                const calculated = calculateInvoiceMonthByDue(
                  tx.date,
                  account.closing_date!,
                  account.due_date || 1
                );
                const stored = tx.invoice_month || 'N/A';
                const match = calculated === stored;
                
                return (
                  <div key={tx.id} className={`p-1 ${!match ? 'bg-red-100' : 'bg-green-100'}`}>
                    <div className="flex justify-between">
                      <span>{format(tx.date, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span>{tx.description.substring(0, 20)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Calc: {calculated}</span>
                      <span>DB: {stored}</span>
                      <span className={match ? 'text-green-700' : 'text-red-700'}>
                        {match ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
