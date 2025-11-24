import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { Account } from '@/types';

interface AccountsSummaryProps {
  accounts: Account[];
  accountTypes?: ('checking' | 'savings' | 'credit' | 'investment')[];
  title?: string;
  emptyMessage?: string;
  onNavigateToAccounts?: () => void;
  onAddAccount?: () => void;
}

export function AccountsSummary({
  accounts,
  accountTypes,
  title = 'Suas Contas',
  emptyMessage = 'Nenhuma conta cadastrada',
  onNavigateToAccounts,
  onAddAccount,
}: AccountsSummaryProps) {
  const { formatCurrency } = useSettings();

  const filteredAccounts = accountTypes
    ? accounts.filter((account) => accountTypes.includes(account.type))
    : accounts;

  const totalBalance = filteredAccounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  return (
    <Card
      className="financial-card cursor-pointer apple-interaction"
      onClick={() => onNavigateToAccounts?.()}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-headline flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {title} ({filteredAccounts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-body">{emptyMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddAccount?.();
              }}
              className="mt-3 h-8 text-body"
            >
              Adicionar conta
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: account.color || '#6b7280' }}
                  >
                    <div className="text-caption font-semibold">
                      {account.type === 'checking' && 'C'}
                      {account.type === 'savings' && 'P'}
                      {account.type === 'credit' && 'R'}
                      {account.type === 'investment' && 'I'}
                    </div>
                  </div>
                  <p className="font-medium text-body truncate">{account.name}</p>
                </div>
                <div
                  className={`text-body font-semibold flex-shrink-0 ${
                    account.type === 'credit'
                      ? account.balance < 0
                        ? 'text-destructive'
                        : 'text-emerald-600'
                      : account.balance >= 0
                      ? 'balance-positive'
                      : 'balance-negative'
                  }`}
                >
                  {formatCurrency(account.balance)}
                </div>
              </div>
            ))}
            {filteredAccounts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-headline font-medium">Total:</span>
                  <span
                    className={`text-headline font-semibold ${
                      accountTypes?.includes('credit')
                        ? totalBalance < 0
                          ? 'text-destructive'
                          : 'text-emerald-600'
                        : totalBalance >= 0
                        ? 'balance-positive'
                        : 'balance-negative'
                    }`}
                  >
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
