import { Account } from "@/types";
import { formatCurrency, getAvailableBalance, getCreditCardDebt, hasCreditInFavor } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface AccountBalanceDetailsProps {
  account: Account | undefined | null;
}

export function AccountBalanceDetails({ account }: AccountBalanceDetailsProps) {
  const { t } = useTranslation();
  
  if (!account) {
    return null;
  }

  // Cartão de crédito tem UI diferente
  if (account.type === 'credit') {
    const debt = getCreditCardDebt(account);
    const available = getAvailableBalance(account);
    const hasCredit = hasCreditInFavor(account);
    
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        {hasCredit ? (
          <>
            <p className="text-emerald-600 font-medium">
              {t("accounts.creditInFavor")}: {formatCurrency(account.balance)}
            </p>
            <p>
              {t("accounts.available")}: {formatCurrency(available)}
            </p>
          </>
        ) : (
          <>
            <p className={debt > 0 ? "text-destructive font-medium" : ""}>
              {t("accounts.debt")}: {formatCurrency(debt)}
            </p>
            <p>
              {t("accounts.available")}: {formatCurrency(available)}
            </p>
          </>
        )}
        {account.limit_amount && account.limit_amount > 0 && (
          <span className="block text-xs text-muted-foreground">
            ({t("accounts.limit")}: {formatCurrency(account.limit_amount)})
          </span>
        )}
      </div>
    );
  }

  // Outras contas
  return (
    <p className="text-sm text-muted-foreground">
      {t("accounts.available")}: {formatCurrency(getAvailableBalance(account))}
      {account.limit_amount && account.limit_amount > 0 ? (
        <span className="block text-xs text-blue-600">
          ({t("accounts.balance")}: {formatCurrency(account.balance)} + {t("accounts.limit")}: {formatCurrency(account.limit_amount)})
        </span>
      ) : null}
    </p>
  );
}