import { Button } from '@/components/ui/button';
import { ArrowRightLeft, TrendingDown, TrendingUp, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardHeaderProps {
  onTransfer: () => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onAddCreditExpense: () => void;
}

export function DashboardHeader({
  onTransfer,
  onAddExpense,
  onAddIncome,
  onAddCreditExpense,
}: DashboardHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0 w-full">
        <h1 className="text-system-h1 leading-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground leading-tight">
          {t('dashboard.subtitle')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-4 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
        <Button
          onClick={onTransfer}
          variant="outline"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          aria-label={t('dashboard.transfer')}
        >
          <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>{t('dashboard.transfer')}</span>
        </Button>
        <Button
          onClick={onAddExpense}
          variant="destructive"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          aria-label={t('dashboard.expense')}
        >
          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>{t('dashboard.expense')}</span>
        </Button>
        <Button
          onClick={onAddIncome}
          variant="default"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm bg-success hover:bg-success/90"
          aria-label={t('dashboard.income')}
        >
          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>{t('dashboard.income')}</span>
        </Button>
        <Button
          onClick={onAddCreditExpense}
          variant="outline"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm border-warning text-warning hover:bg-warning hover:text-warning-foreground"
          aria-label={t('dashboard.creditCard')}
        >
          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>{t('dashboard.creditCard')}</span>
        </Button>
      </div>
    </div>
  );
}
