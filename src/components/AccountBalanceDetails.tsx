import { Account } from "@/types";
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface AccountBalanceDetailsProps {
  account: Account | undefined | null;
}

export function AccountBalanceDetails({ account }: AccountBalanceDetailsProps) {
  const { t } = useTranslation();
  
  if (!account) {
    return null;
  }

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