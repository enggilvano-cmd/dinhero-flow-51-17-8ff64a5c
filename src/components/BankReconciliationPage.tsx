import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  CalendarIcon,
  Filter,
  Download,
  AlertCircle,
} from "lucide-react";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { getUserId, withErrorHandling } from "@/lib/supabase-utils";
import { t } from "@/lib/t";

interface BankReconciliationPageProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
}

export function BankReconciliationPage({
  transactions,
  accounts,
  categories,
}: BankReconciliationPageProps) {
  const { toast } = useToast();

  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [reconciledFilter, setReconciledFilter] = useState<"all" | "reconciled" | "not_reconciled">("not_reconciled");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // Filtro por conta
      if (selectedAccount !== "all" && transaction.account_id !== selectedAccount) {
        return false;
      }

      // Filtro por status de reconciliação
      if (reconciledFilter === "reconciled" && !transaction.reconciled) {
        return false;
      }
      if (reconciledFilter === "not_reconciled" && transaction.reconciled) {
        return false;
      }

      // Filtro por data
      const transactionDate = new Date(transaction.date);
      if (transactionDate < startDate || transactionDate > endDate) {
        return false;
      }

      // Apenas transações completed
      if (transaction.status !== "completed") {
        return false;
      }

      return true;
    });
  }, [transactions, selectedAccount, reconciledFilter, startDate, endDate]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredTransactions.length;
    const reconciled = filteredTransactions.filter((t) => t.reconciled).length;
    const notReconciled = total - reconciled;
    const reconciledAmount = filteredTransactions
      .filter((t) => t.reconciled)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return { total, reconciled, notReconciled, reconciledAmount };
  }, [filteredTransactions]);

  // Marcar/desmarcar como reconciliada
  const handleToggleReconciled = async (transactionId: string, currentStatus: boolean) => {
    setUpdatingIds((prev) => new Set(prev).add(transactionId));

    try {
      await withErrorHandling(
        async () => {
          const userId = await getUserId();
          const { error } = await supabase
            .from("transactions")
            .update({
              reconciled: !currentStatus,
              reconciled_at: !currentStatus ? new Date().toISOString() : null,
              reconciled_by: !currentStatus ? userId : null,
            })
            .eq("id", transactionId);

          if (error) throw error;
        },
        "Erro ao atualizar status"
      );

      toast({
        title: "Sucesso",
        description: !currentStatus
          ? "Transação marcada como reconciliada"
          : "Transação marcada como não reconciliada",
      });

      // Recarregar transações
      window.location.reload();
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  // Exportar relatório
  const handleExport = () => {
    const csvContent = [
      ["Data", "Descrição", "Conta", "Categoria", "Valor", "Reconciliado", "Data Reconciliação"],
      ...filteredTransactions.map((t) => [
        format(new Date(t.date), "dd/MM/yyyy"),
        t.description,
        accounts.find((a) => a.id === t.account_id)?.name || "",
        categories.find((c) => c.id === t.category_id)?.name || "",
        formatCurrency(t.amount),
        t.reconciled ? "Sim" : "Não",
        t.reconciled_at ? format(new Date(t.reconciled_at), "dd/MM/yyyy HH:mm") : "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliacao-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // Colunas da tabela
  const columns = [
    {
      key: "reconciled",
      header: "",
      render: (transaction: any) => (
        <Checkbox
          checked={transaction.reconciled || false}
          disabled={updatingIds.has(transaction.id)}
          onCheckedChange={() => handleToggleReconciled(transaction.id, transaction.reconciled)}
          className="ml-2"
        />
      ),
    },
    {
      key: "date",
      header: "Data",
      render: (transaction: any) => format(new Date(transaction.date), "dd/MM/yyyy"),
    },
    {
      key: "description",
      header: "Descrição",
      render: (transaction: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{transaction.description}</span>
          {transaction.reconciled && transaction.reconciled_at && (
            <span className="text-xs text-muted-foreground">
              Reconciliado em: {format(new Date(transaction.reconciled_at), "dd/MM/yyyy HH:mm")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "account",
      header: "Conta",
      render: (transaction: any) => {
        const account = accounts.find((a) => a.id === transaction.account_id);
        return account ? (
          <Badge variant="outline" style={{ borderColor: account.color }}>
            {account.name}
          </Badge>
        ) : (
          "-"
        );
      },
    },
    {
      key: "category",
      header: "Categoria",
      render: (transaction: any) => {
        const category = categories.find((c) => c.id === transaction.category_id);
        return category ? (
          <Badge variant="secondary" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
            {category.name}
          </Badge>
        ) : (
          "-"
        );
      },
    },
    {
      key: "amount",
      header: "Valor",
      render: (transaction: any) => (
        <span
          className={cn(
            "font-semibold",
            transaction.type === "income" ? "text-success" : "text-destructive"
          )}
        >
          {formatCurrency(transaction.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (transaction: any) =>
        transaction.reconciled ? (
          <Badge variant="default" className="bg-success/10 text-success hover:bg-success/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Reconciliado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="w-3 h-3 mr-1" />
            Não Reconciliado
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reconciliação Bancária</h1>
          <p className="text-muted-foreground mt-1">Confirme e reconcilie suas transações bancárias</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("reconciliation.totalTransactions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("reconciliation.reconciled")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.reconciled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("reconciliation.notReconciled")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.notReconciled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("reconciliation.reconciledAmount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.reconciledAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {t("common.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de Conta */}
            <div className="space-y-2">
              <Label>{t("transactions.account")}</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Status */}
            <div className="space-y-2">
              <Label>{t("reconciliation.status")}</Label>
              <Select value={reconciledFilter} onValueChange={(value: any) => setReconciledFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="reconciled">{t("reconciliation.reconciled")}</SelectItem>
                  <SelectItem value="not_reconciled">{t("reconciliation.notReconciled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Início */}
            <div className="space-y-2">
              <Label>{t("common.startDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Fim */}
            <div className="space-y-2">
              <Label>{t("common.endDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso se houver transações não reconciliadas */}
      {stats.notReconciled > 0 && reconciledFilter !== "reconciled" && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">Atenção: Transações Pendentes</p>
                <p className="text-sm text-muted-foreground">
                  Você possui {stats.notReconciled} transação(ões) não reconciliada(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            columns={columns}
            data={filteredTransactions}
            keyField="id"
            emptyState={
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma transação encontrada</p>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
