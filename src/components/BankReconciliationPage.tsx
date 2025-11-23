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
  Download,
  AlertCircle,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { getUserId, withErrorHandling } from "@/lib/supabase-utils";

import type { Transaction, Account, Category } from "@/types";

interface BankReconciliationPageProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
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
        (t as unknown as Record<string, unknown>).reconciled_at ? format(new Date((t as unknown as Record<string, unknown>).reconciled_at as string), "dd/MM/yyyy HH:mm") : "",
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
      render: (transaction: Transaction) => (
        <Checkbox
          checked={transaction.reconciled || false}
          disabled={updatingIds.has(transaction.id)}
          onCheckedChange={() => handleToggleReconciled(transaction.id, transaction.reconciled || false)}
          className="ml-2"
        />
      ),
    },
    {
      key: "date",
      header: "Data",
      render: (transaction: Transaction) => format(new Date(transaction.date), "dd/MM/yyyy"),
    },
    {
      key: "description",
      header: "Descrição",
      render: (transaction: Transaction) => (
        <div className="flex flex-col">
          <span className="font-medium">{transaction.description}</span>
          {transaction.reconciled && (transaction as unknown as Record<string, unknown>).reconciled_at && (
            <span className="text-xs text-muted-foreground">
              Reconciliado em: {format(new Date((transaction as unknown as Record<string, unknown>).reconciled_at as string), "dd/MM/yyyy HH:mm")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "account",
      header: "Conta",
      render: (transaction: Transaction) => {
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
      render: (transaction: Transaction) => {
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
      render: (transaction: Transaction) => (
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
      render: (transaction: Transaction) =>
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
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 w-full lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button onClick={handleExport} variant="outline" className="gap-1.5 apple-interaction h-9 text-xs sm:text-sm px-3">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Total de Transações</p>
                <div className="text-responsive-xl font-bold leading-tight">{stats.total}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Reconciliadas</p>
                <div className="text-responsive-xl font-bold balance-positive leading-tight">{stats.reconciled}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Não Reconciliadas</p>
                <div className="text-responsive-xl font-bold balance-negative leading-tight">{stats.notReconciled}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Valor Reconciliado</p>
                <div className="text-responsive-xl font-bold leading-tight">{formatCurrency(stats.reconciledAmount)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de Conta */}
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
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
              <Label>Status</Label>
              <Select value={reconciledFilter} onValueChange={(value: string) => setReconciledFilter(value as "all" | "reconciled" | "not_reconciled")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="reconciled">Reconciliadas</SelectItem>
                  <SelectItem value="not_reconciled">Não Reconciliadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Início */}
            <div className="space-y-2">
              <Label>Data Inicial</Label>
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
              <Label>Data Final</Label>
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
