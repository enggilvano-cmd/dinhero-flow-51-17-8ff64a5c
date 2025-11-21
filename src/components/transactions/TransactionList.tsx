import { Badge } from "@/components/ui/badge";
import { VirtualizedTable } from "@/components/ui/virtualized-table";
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
      key: "date",
      header: t("transactions.table.date"),
      accessorKey: "date",
      render: (row: any) => {
        const date = row.date;
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      },
    },
    {
      key: "description",
      header: t("transactions.table.description"),
      accessorKey: "description",
      render: (row: any) => {
        return (
          <div className="flex items-center gap-2">
            {getTypeIcon(row.type)}
            <span>{row.description}</span>
            {row.installments && row.installments > 1 && (
              <Badge variant="secondary" className="ml-2">
                {row.current_installment}/{row.installments}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "category",
      header: t("transactions.table.category"),
      accessorKey: "category_id",
      render: (row: any) => getCategoryName(row.category_id),
    },
    {
      key: "account",
      header: t("transactions.table.account"),
      accessorKey: "account_id",
      render: (row: any) => getAccountName(row.account_id),
    },
    {
      key: "amount",
      header: t("transactions.table.amount"),
      accessorKey: "amount",
      render: (row: any) => {
        const colorClass =
          row.type === "income"
            ? "text-success"
            : row.type === "expense"
            ? "text-destructive"
            : "text-primary";
        return (
          <span className={`font-medium ${colorClass}`}>
            {formatCurrency(row.amount, currency)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("transactions.table.status"),
      accessorKey: "status",
      render: (row: any) => {
        return (
          <Badge variant={row.status === "completed" ? "default" : "secondary"}>
            {t(`transactions.status.${row.status}`)}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: t("common.actions"),
      accessorKey: "id",
      render: (row: any) => (
        <TransactionActions
          transaction={row}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkAsPaid={onMarkAsPaid}
          t={t}
        />
      ),
    },
  ];

  return (
    <VirtualizedTable
      data={transactions}
      columns={columns}
      keyField="id"
      emptyState={
        <div className="text-center py-8 text-muted-foreground">
          <p>{t("transactions.noTransactions")}</p>
        </div>
      }
      estimateSize={80}
      overscan={5}
    />
  );
}
