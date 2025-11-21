import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { TransactionActions } from "./TransactionActions";
import { EditScope } from "../InstallmentEditScopeDialog";

interface TransactionListProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
  currency: string;
  onEdit: (transaction: any) => void;
  onDelete: (transactionId: string, scope?: EditScope) => void;
  onMarkAsPaid?: (transaction: any) => void;
  t: (key: string) => string;
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  currency,
  onEdit,
  onDelete,
  onMarkAsPaid,
  t,
}: TransactionListProps) {
  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || t("transactions.unknownAccount");
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "-";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "expense":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4 text-primary" />;
      default:
        return null;
    }
  };

  const columns = [
    {
      header: t("transactions.table.date"),
      accessorKey: "date",
      cell: ({ row }: any) => {
        const date = row.original.date;
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      },
    },
    {
      header: t("transactions.table.description"),
      accessorKey: "description",
      cell: ({ row }: any) => {
        const transaction = row.original;
        return (
          <div className="flex items-center gap-2">
            {getTypeIcon(transaction.type)}
            <span>{transaction.description}</span>
            {transaction.installments && transaction.installments > 1 && (
              <Badge variant="secondary" className="ml-2">
                {transaction.current_installment}/{transaction.installments}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      header: t("transactions.table.category"),
      accessorKey: "category_id",
      cell: ({ row }: any) => getCategoryName(row.original.category_id),
    },
    {
      header: t("transactions.table.account"),
      accessorKey: "account_id",
      cell: ({ row }: any) => getAccountName(row.original.account_id),
    },
    {
      header: t("transactions.table.amount"),
      accessorKey: "amount",
      cell: ({ row }: any) => {
        const transaction = row.original;
        const colorClass =
          transaction.type === "income"
            ? "text-success"
            : transaction.type === "expense"
            ? "text-destructive"
            : "text-primary";
        return (
          <span className={`font-medium ${colorClass}`}>
            {formatCurrency(transaction.amount, currency)}
          </span>
        );
      },
    },
    {
      header: t("transactions.table.status"),
      accessorKey: "status",
      cell: ({ row }: any) => {
        const status = row.original.status;
        return (
          <Badge variant={status === "completed" ? "default" : "secondary"}>
            {t(`transactions.status.${status}`)}
          </Badge>
        );
      },
    },
    {
      header: t("common.actions"),
      id: "actions",
      cell: ({ row }: any) => (
        <TransactionActions
          transaction={row.original}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkAsPaid={onMarkAsPaid}
          t={t}
        />
      ),
    },
  ];

  return (
    <ResponsiveTable
      data={transactions}
      columns={columns}
      emptyMessage={t("transactions.noTransactions")}
    />
  );
}
