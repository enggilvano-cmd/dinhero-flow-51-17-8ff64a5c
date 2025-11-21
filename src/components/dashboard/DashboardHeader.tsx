import { Button } from '@/components/ui/button';
import { ArrowRightLeft, TrendingDown, TrendingUp, CreditCard } from 'lucide-react';

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
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0 w-full">
        <h1 className="text-system-h1 leading-tight">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground leading-tight">
          Visão geral das suas finanças
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-4 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
        <Button
          onClick={onTransfer}
          variant="outline"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          aria-label="Transferência"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>Transferência</span>
        </Button>
        <Button
          onClick={onAddExpense}
          variant="destructive"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          aria-label="Despesa"
        >
          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>Despesa</span>
        </Button>
        <Button
          onClick={onAddIncome}
          variant="default"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm bg-success hover:bg-success/90"
          aria-label="Receita"
        >
          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>Receita</span>
        </Button>
        <Button
          onClick={onAddCreditExpense}
          variant="outline"
          className="gap-2 apple-interaction h-9 text-xs sm:text-sm border-warning text-warning hover:bg-warning hover:text-warning-foreground"
          aria-label="Cartão de Crédito"
        >
          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          <span>Cartão de Crédito</span>
        </Button>
      </div>
    </div>
  );
}
