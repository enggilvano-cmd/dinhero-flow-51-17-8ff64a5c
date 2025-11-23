import { useMemo } from "react";
import { Account } from "@/types";
import { formatCurrency } from "@/lib/formatters";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailableBalanceIndicatorProps {
  account: Account | undefined;
  transactionType: "income" | "expense";
  amountInCents: number;
  className?: string;
}

export function AvailableBalanceIndicator({
  account,
  transactionType,
  amountInCents,
  className,
}: AvailableBalanceIndicatorProps) {
  const balanceInfo = useMemo(() => {
    if (!account) return null;

    const currentBalance = account.balance;
    const limit = account.limit_amount || 0;
    
    let available = 0;
    let balanceAfter = currentBalance;
    let status: "success" | "warning" | "danger" = "success";
    let message = "";

    if (account.type === "credit") {
      // Para cartão de crédito
      const currentDebt = Math.abs(Math.min(currentBalance, 0));
      available = limit - currentDebt;
      
      if (transactionType === "expense") {
        balanceAfter = currentBalance - amountInCents;
        const newDebt = Math.abs(Math.min(balanceAfter, 0));
        const remaining = limit - newDebt;
        
        if (amountInCents > available) {
          status = "danger";
          message = "Limite excedido";
        } else if (remaining < limit * 0.2) {
          status = "warning";
          message = "Próximo ao limite";
        } else {
          status = "success";
          message = "Limite disponível";
        }
      } else {
        balanceAfter = currentBalance + amountInCents;
        status = "success";
        message = "Pagamento";
      }
    } else {
      // Para contas normais
      available = currentBalance + limit;
      
      if (transactionType === "expense") {
        balanceAfter = currentBalance - amountInCents;
        const remainingAfter = balanceAfter + limit;
        
        if (amountInCents > available) {
          status = "danger";
          message = "Saldo insuficiente";
        } else if (remainingAfter < available * 0.2) {
          status = "warning";
          message = "Saldo baixo após transação";
        } else {
          status = "success";
          message = "Saldo suficiente";
        }
      } else {
        balanceAfter = currentBalance + amountInCents;
        status = "success";
        message = "Receita";
      }
    }

    return {
      currentBalance,
      available,
      balanceAfter,
      limit,
      status,
      message,
    };
  }, [account, transactionType, amountInCents]);

  if (!account || !balanceInfo) return null;

  const { currentBalance, available, balanceAfter, limit, status, message } = balanceInfo;

  const statusConfig = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-success/10",
      borderColor: "border-success/30",
      textColor: "text-success",
      iconColor: "text-success",
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-warning/10",
      borderColor: "border-warning/30",
      textColor: "text-warning",
      iconColor: "text-warning",
    },
    danger: {
      icon: AlertCircle,
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/30",
      textColor: "text-destructive",
      iconColor: "text-destructive",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-all duration-200",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.iconColor)} />
        <span className={cn("text-sm font-medium", config.textColor)}>
          {message}
        </span>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Saldo atual:</span>
          <span className="font-medium text-foreground">
            {formatCurrency(currentBalance)}
          </span>
        </div>

        {limit > 0 && (
          <div className="flex justify-between">
            <span>Limite:</span>
            <span className="font-medium text-foreground">
              {formatCurrency(limit)}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Disponível:</span>
          <span className={cn("font-medium", config.textColor)}>
            {formatCurrency(available)}
          </span>
        </div>

        {amountInCents > 0 && (
          <>
            <div className="border-t border-border/50 my-1 pt-1"></div>
            <div className="flex justify-between">
              <span>Saldo após:</span>
              <span
                className={cn(
                  "font-medium",
                  balanceAfter < 0 && account.type !== "credit"
                    ? "text-destructive"
                    : "text-foreground"
                )}
              >
                {formatCurrency(balanceAfter)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
