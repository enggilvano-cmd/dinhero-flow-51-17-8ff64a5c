import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ArrowLeftRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { TransactionActions } from "./TransactionActions";
import { EditScope } from "../InstallmentEditScopeDialog";
import { Button } from "@/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";

interface InfiniteTransactionListProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
  currency: string;
  onEdit: (transaction: any) => void;
  onDelete: (transactionId: string, scope?: EditScope) => void;
  onMarkAsPaid?: (transaction: any) => void;
  t: (key: string) => string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function InfiniteTransactionList({
  transactions,
  accounts,
  categories,
  currency,
  onEdit,
  onDelete,
  onMarkAsPaid,
  t,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // Estimated height of each transaction item (adjust based on actual)
    overscan: 5, // Render 5 extra items above/below viewport
  });

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

  // ✅ Intersection Observer for infinite scroll (works with virtual scrolling)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
          fetchNextPage();
        }
      },
      {
        root: parentRef.current,
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{
        height: "600px", // Fixed height for virtual scrolling
        width: "100%",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const transaction = transactions[virtualRow.index];
          if (!transaction) return null;

          return (
            <div
              key={transaction.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-background">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-1">{getTypeIcon(transaction.type)}</div>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{transaction.description}</span>
                      {transaction.installments && transaction.installments > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {transaction.current_installment}/{transaction.installments}
                        </Badge>
                      )}
                      {transaction.status === "pending" && (
                        <Badge variant="destructive" className="text-xs">
                          {t("transactions.pending")}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="truncate">{format(transaction.date, "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span className="truncate">{getCategoryName(transaction.category_id)}</span>
                      <span className="truncate">{getAccountName(transaction.account_id)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                  <span
                    className={`font-semibold text-lg ${
                      transaction.type === "income"
                        ? "text-success"
                        : transaction.type === "expense"
                        ? "text-destructive"
                        : "text-primary"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                    {formatCurrency(Math.abs(transaction.amount / 100), currency)}
                  </span>

                  <TransactionActions
                    transaction={transaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMarkAsPaid={onMarkAsPaid}
                    t={t}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* ✅ Observer target for infinite scroll - positioned at the end of virtual list */}
        <div
          ref={observerRef}
          style={{
            position: "absolute",
            top: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            height: "40px",
          }}
          className="flex items-center justify-center"
        >
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("common.loading")}</span>
            </div>
          )}
          {!hasNextPage && transactions.length > 0 && (
            <p className="text-sm text-muted-foreground">{t("transactions.noMoreTransactions")}</p>
          )}
        </div>

        {/* ✅ Manual load more button (fallback) */}
        {hasNextPage && !isFetchingNextPage && (
          <div
            style={{
              position: "absolute",
              top: `${virtualizer.getTotalSize() + 40}px`,
              width: "100%",
            }}
            className="flex justify-center pt-4 pb-4"
          >
            <Button
              variant="outline"
              onClick={fetchNextPage}
              className="w-full sm:w-auto"
            >
              {t("transactions.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
