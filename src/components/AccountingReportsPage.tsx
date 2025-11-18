import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BookOpen, Scale, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface JournalEntry {
  id: string;
  account_id: string;
  transaction_id: string | null;
  entry_type: "debit" | "credit";
  amount: number;
  description: string;
  entry_date: string;
  created_at: string;
  account?: {
    code: string;
    name: string;
    category: string;
  };
  transaction?: {
    description: string;
  };
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  nature: "debit" | "credit";
  is_active: boolean;
}

interface TrialBalanceEntry {
  code: string;
  name: string;
  category: string;
  nature: "debit" | "credit";
  debit: number;
  credit: number;
  balance: number;
}

export function AccountingReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartAccount[]>([]);
  
  // Filtros
  const [periodType, setPeriodType] = useState<"month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar journal_entries com relacionamentos
      const { data: entries, error: entriesError } = await supabase
        .from("journal_entries")
        .select(`
          *,
          account:chart_of_accounts!journal_entries_account_id_fkey(code, name, category),
          transaction:transactions(description)
        `)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"))
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;

      // Buscar plano de contas
      const { data: accounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      setJournalEntries((entries || []) as JournalEntry[]);
      setChartOfAccounts(accounts || []);
    } catch (error) {
      console.error("Erro ao carregar dados contábeis:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os relatórios contábeis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodTypeChange = (value: "month" | "year" | "custom") => {
    setPeriodType(value);
    const now = new Date();

    if (value === "month") {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
      setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (value === "year") {
      setStartDate(new Date(now.getFullYear(), 0, 1));
      setEndDate(new Date(now.getFullYear(), 11, 31));
    }
  };

  // Balancete de Verificação
  const trialBalance = useMemo<TrialBalanceEntry[]>(() => {
    const balanceMap = new Map<string, TrialBalanceEntry>();

    // Inicializar todas as contas
    chartOfAccounts.forEach(account => {
      balanceMap.set(account.id, {
        code: account.code,
        name: account.name,
        category: account.category,
        nature: account.nature,
        debit: 0,
        credit: 0,
        balance: 0,
      });
    });

    // Somar lançamentos
    journalEntries.forEach(entry => {
      const current = balanceMap.get(entry.account_id);
      if (current) {
        if (entry.entry_type === "debit") {
          current.debit += entry.amount;
        } else {
          current.credit += entry.amount;
        }
        
        // Calcular saldo baseado na natureza da conta
        if (current.nature === "debit") {
          current.balance = current.debit - current.credit;
        } else {
          current.balance = current.credit - current.debit;
        }
      }
    });

    // Retornar apenas contas com movimentação
    return Array.from(balanceMap.values())
      .filter(entry => entry.debit > 0 || entry.credit > 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [journalEntries, chartOfAccounts]);

  // Totais do balancete
  const trialBalanceTotals = useMemo(() => {
    return trialBalance.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [trialBalance]);

  // DRE (Demonstração de Resultados)
  const incomeStatement = useMemo(() => {
    const revenues = trialBalance.filter(entry => entry.category === "revenue");
    const expenses = trialBalance.filter(entry => entry.category === "expense");

    const totalRevenue = revenues.reduce((sum, entry) => sum + entry.balance, 0);
    const totalExpense = expenses.reduce((sum, entry) => sum + entry.balance, 0);
    const netIncome = totalRevenue - totalExpense;

    return {
      revenues,
      expenses,
      totalRevenue,
      totalExpense,
      netIncome,
    };
  }, [trialBalance]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      asset: "Ativo",
      liability: "Passivo",
      equity: "Patrimônio Líquido",
      revenue: "Receita",
      expense: "Despesa",
      contra_asset: "Ativo (Retificadora)",
      contra_liability: "Passivo (Retificadora)",
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Carregando relatórios contábeis...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Relatórios Contábeis</h1>
        <p className="text-muted-foreground">
          Livro Diário, Balancete de Verificação e Demonstração de Resultados
        </p>
      </div>

      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Tipo de Período</label>
              <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês Atual</SelectItem>
                  <SelectItem value="year">Ano Atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === "custom" && (
              <>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Data Inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Data Final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Abas de Relatórios */}
      <Tabs defaultValue="journal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="journal" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Livro Diário
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Balancete
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            DRE
          </TabsTrigger>
        </TabsList>

        {/* Livro Diário */}
        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Livro Diário</CardTitle>
              <CardDescription>
                Todos os lançamentos contábeis do período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {journalEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado no período selecionado
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journalEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {entry.account?.code} - {entry.account?.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {getCategoryLabel(entry.account?.category || "")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            {entry.transaction?.description || entry.description}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.entry_type === "debit" ? formatCurrency(entry.amount) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.entry_type === "credit" ? formatCurrency(entry.amount) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balancete de Verificação */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balancete de Verificação</CardTitle>
              <CardDescription>
                Saldos de débitos e créditos por conta contábil
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trialBalance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma movimentação encontrada no período selecionado
                </p>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Débito</TableHead>
                          <TableHead className="text-right">Crédito</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialBalance.map((entry) => (
                          <TableRow key={entry.code}>
                            <TableCell className="font-mono">{entry.code}</TableCell>
                            <TableCell className="font-medium">{entry.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getCategoryLabel(entry.category)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(entry.debit)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(entry.credit)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono font-semibold",
                              entry.balance >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {formatCurrency(Math.abs(entry.balance))}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(trialBalanceTotals.debit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(trialBalanceTotals.credit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Validação do Balancete */}
                  <div className="mt-4 p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Validação de Partidas Dobradas</p>
                        <p className="text-sm text-muted-foreground">
                          Débitos e Créditos devem ser iguais
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Diferença</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01
                            ? "text-green-600"
                            : "text-red-600"
                        )}>
                          {formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit))}
                        </p>
                        {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 ? (
                          <Badge variant="default" className="mt-1">✓ Balanceado</Badge>
                        ) : (
                          <Badge variant="destructive" className="mt-1">✗ Desbalanceado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRE - Demonstração de Resultados */}
        <TabsContent value="income-statement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receitas Totais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(incomeStatement.totalRevenue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Despesas Totais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(incomeStatement.totalExpense)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Resultado Líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn(
                  "text-2xl font-bold",
                  incomeStatement.netIncome >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(incomeStatement.netIncome)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Demonstração de Resultados (DRE)</CardTitle>
              <CardDescription>
                Receitas, Despesas e Resultado do período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Receitas */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-600">Receitas</h3>
                {incomeStatement.revenues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma receita no período</p>
                ) : (
                  <div className="space-y-2">
                    {incomeStatement.revenues.map((entry) => (
                      <div key={entry.code} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                        <div>
                          <span className="font-medium">{entry.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({entry.code})</span>
                        </div>
                        <span className="font-mono font-semibold text-green-600">
                          {formatCurrency(entry.balance)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-2 bg-muted rounded font-semibold">
                      <span>Total de Receitas</span>
                      <span className="font-mono text-green-600">
                        {formatCurrency(incomeStatement.totalRevenue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Despesas */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-600">Despesas</h3>
                {incomeStatement.expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma despesa no período</p>
                ) : (
                  <div className="space-y-2">
                    {incomeStatement.expenses.map((entry) => (
                      <div key={entry.code} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                        <div>
                          <span className="font-medium">{entry.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({entry.code})</span>
                        </div>
                        <span className="font-mono font-semibold text-red-600">
                          {formatCurrency(entry.balance)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-2 bg-muted rounded font-semibold">
                      <span>Total de Despesas</span>
                      <span className="font-mono text-red-600">
                        {formatCurrency(incomeStatement.totalExpense)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Resultado */}
              <div className="pt-4 border-t-2">
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="text-xl font-bold">Resultado Líquido do Período</span>
                  <span className={cn(
                    "text-2xl font-bold font-mono",
                    incomeStatement.netIncome >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(incomeStatement.netIncome)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
