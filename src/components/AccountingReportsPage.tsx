import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BookOpen, Scale, TrendingUp, TrendingDown, Wallet, Waves } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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
    nature: "debit" | "credit";
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
  const [initializing, setInitializing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartAccount[]>([]);
  
  // Filtros
  const [periodType, setPeriodType] = useState<"month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const initializeChartOfAccounts = async () => {
    try {
      setInitializing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.rpc('initialize_chart_of_accounts', {
        p_user_id: user.id
      });

      if (error) throw error;

      toast({
        title: "Plano de Contas Inicializado",
        description: "O plano de contas contábil foi criado com sucesso!",
      });

      setNeedsInitialization(false);
      await loadData();
    } catch (error) {
      logger.error("Erro ao inicializar plano de contas:", error);
      toast({
        title: "Erro na inicialização",
        description: "Não foi possível inicializar o plano de contas.",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
    }
  };

  const migrateExistingTransactions = async () => {
    try {
      setMigrating(true);
      
      // Verificar se chart_of_accounts existe antes de migrar
      const { data: chartExists, error: chartCheckError } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .limit(1);

      if (chartCheckError) throw chartCheckError;

      // Se não existir chart_of_accounts, inicializar automaticamente
      if (!chartExists || chartExists.length === 0) {
        toast({
          title: "Inicializando Plano de Contas",
          description: "O plano de contas será criado antes da migração...",
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error: initError } = await supabase.rpc('initialize_chart_of_accounts', {
          p_user_id: user.id
        });

        if (initError) {
          throw new Error(`Falha ao inicializar plano de contas: ${initError.message}`);
        }

        // Aguardar um momento para garantir que o plano de contas foi criado
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Executar migração
      const { data, error } = await supabase.rpc('migrate_existing_transactions_to_journal');

      if (error) throw error;

      const result = data?.[0];
      
      if (result?.error_count > 0) {
        logger.error("Erros na migração:", result.error_details);
        toast({
          title: "Migração Parcial",
          description: `${result?.processed_count || 0} transações migradas. ${result?.error_count || 0} falharam. Verifique os detalhes no console.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Migração Concluída",
          description: `${result?.processed_count || 0} transações migradas com sucesso!`,
        });
      }

      await loadData();
    } catch (error) {
      logger.error("Erro ao migrar transações:", error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível migrar as transações existentes.";
      toast({
        title: "Erro na migração",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar plano de contas primeiro
      const { data: accounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      // Se não houver contas, precisa inicializar
      if (!accounts || accounts.length === 0) {
        setNeedsInitialization(true);
        setChartOfAccounts([]);
        setJournalEntries([]);
        setLoading(false);
        return;
      }

      setChartOfAccounts(accounts || []);
      setNeedsInitialization(false);

      // Buscar journal_entries com relacionamentos
      const { data: entries, error: entriesError } = await supabase
        .from("journal_entries")
        .select(`
          *,
          account:chart_of_accounts!journal_entries_account_id_fkey(code, name, category, nature),
          transaction:transactions(description)
        `)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"))
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;

      setJournalEntries((entries || []) as JournalEntry[]);
    } catch (error) {
      logger.error("Erro ao carregar dados contábeis:", error);
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

    const totalRevenue = revenues.reduce((sum, entry) => sum + Math.abs(entry.balance), 0);
    const totalExpense = expenses.reduce((sum, entry) => sum + Math.abs(entry.balance), 0);
    const netIncome = totalRevenue - totalExpense;

    return {
      revenues: revenues.map(r => ({ ...r, balance: Math.abs(r.balance) })),
      expenses: expenses.map(e => ({ ...e, balance: Math.abs(e.balance) })),
      totalRevenue,
      totalExpense,
      netIncome,
    };
  }, [trialBalance]);

  // Balanço Patrimonial
  const balanceSheet = useMemo(() => {
    const assets = trialBalance.filter(e => e.category === "asset" || e.category === "contra_asset");
    const liabilities = trialBalance.filter(e => e.category === "liability" || e.category === "contra_liability");
    const equity = trialBalance.filter(e => e.category === "equity");

    const totalAssets = assets.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    const totalEquity = equity.reduce((sum, e) => sum + Math.abs(e.balance), 0) + incomeStatement.netIncome;

    return {
      assets: assets.map(a => ({ ...a, balance: Math.abs(a.balance) })),
      liabilities: liabilities.map(l => ({ ...l, balance: Math.abs(l.balance) })),
      equity: equity.map(e => ({ ...e, balance: Math.abs(e.balance) })),
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }, [trialBalance, incomeStatement]);

  // Fluxo de Caixa
  const cashFlow = useMemo(() => {
    // Buscar contas de caixa/banco (assets líquidos)
    const cashAccounts = trialBalance.filter(e => 
      e.category === "asset" && (e.code.startsWith("1.1") || e.name.toLowerCase().includes("caixa") || e.name.toLowerCase().includes("banco"))
    );

    const operatingCashFlow = incomeStatement.netIncome;
    const totalCash = cashAccounts.reduce((sum, e) => sum + Math.abs(e.balance), 0);

    return {
      cashAccounts,
      operatingCashFlow,
      totalCash,
    };
  }, [trialBalance, incomeStatement]);

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
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-body text-muted-foreground">Carregando relatórios contábeis...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar opção de inicialização se necessário
  if (needsInitialization) {
    return (
      <div className="space-y-6">
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-title">Plano de Contas Não Inicializado</CardTitle>
            <CardDescription className="text-body">
              Para utilizar os relatórios contábeis, é necessário inicializar o Plano de Contas.
              Isso criará a estrutura contábil padrão (Ativo, Passivo, Receitas, Despesas, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="text-headline font-semibold mb-2">O que será criado:</h4>
              <ul className="list-disc list-inside space-y-1 text-caption text-muted-foreground">
                <li>Contas de Ativo (Caixa, Bancos, Investimentos)</li>
                <li>Contas de Passivo (Fornecedores, Empréstimos)</li>
                <li>Contas de Receita (Vendas, Serviços)</li>
                <li>Contas de Despesa (Operacionais, Administrativas)</li>
                <li>Contas de Patrimônio Líquido</li>
              </ul>
            </div>
            <Button 
              onClick={initializeChartOfAccounts} 
              disabled={initializing}
              className="w-full"
            >
              {initializing ? "Inicializando..." : "Inicializar Plano de Contas"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de migração */}
      {journalEntries.length === 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-title flex items-center justify-between">
              <span>Dados Contábeis Vazios</span>
              <Button 
                onClick={migrateExistingTransactions} 
                disabled={migrating}
                variant="default"
                size="sm"
              >
                {migrating ? "Migrando..." : "Migrar Transações Antigas"}
              </Button>
            </CardTitle>
            <CardDescription className="text-body">
              Parece que você tem transações no sistema, mas ainda não há lançamentos contábeis. 
              Clique no botão para criar os lançamentos automaticamente a partir das transações existentes.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">Filtros de Período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption font-medium mb-2 block">Tipo de Período</label>
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
                  <label className="text-caption font-medium mb-2 block">Data Inicial</label>
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
                  <label className="text-caption font-medium mb-2 block">Data Final</label>
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
      <Tabs defaultValue="dre" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 h-auto p-2">
          <TabsTrigger value="dre" className="flex items-center gap-1.5 px-2 py-2.5 text-caption h-auto">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">DRE</span>
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-1.5 px-2 py-2.5 text-caption h-auto">
            <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Balanço</span>
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="flex items-center gap-1.5 px-2 py-2.5 text-caption h-auto">
            <Waves className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Fluxo</span>
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm h-auto">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Balancete</span>
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm h-auto">
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Diário</span>
          </TabsTrigger>
        </TabsList>

        {/* DRE */}
        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração do Resultado do Exercício (DRE)</CardTitle>
              <CardDescription>
                {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Receitas */}
              <div>
                <div className="flex items-center justify-between py-2 border-b-2 border-success/30 mb-3">
                  <h3 className="text-lg font-semibold text-success flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Receitas
                  </h3>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(incomeStatement.totalRevenue)}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {incomeStatement.revenues.map((item) => (
                    <div key={item.code} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.code} - {item.name}</span>
                      <span className="font-medium">{formatCurrency(item.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Despesas */}
              <div>
                <div className="flex items-center justify-between py-2 border-b-2 border-destructive/30 mb-3">
                  <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Despesas
                  </h3>
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(incomeStatement.totalExpense)}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {incomeStatement.expenses.map((item) => (
                    <div key={item.code} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.code} - {item.name}</span>
                      <span className="font-medium">{formatCurrency(item.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resultado */}
              <div className="pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg">
                  <h3 className="text-xl font-bold">Resultado Líquido</h3>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      incomeStatement.netIncome >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatCurrency(incomeStatement.netIncome)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balanço Patrimonial */}
        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>Balanço Patrimonial</CardTitle>
              <CardDescription>
                Posição em {format(endDate, "dd/MM/yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ativo */}
                <div>
                  <div className="flex items-center justify-between py-2 border-b-2 border-primary/30 mb-3">
                    <h3 className="text-lg font-semibold text-primary">Ativo</h3>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(balanceSheet.totalAssets)}
                    </span>
                  </div>
                  <div className="space-y-2 ml-4">
                    {balanceSheet.assets.map((item) => (
                      <div key={item.code} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.code} - {item.name}</span>
                        <span className="font-medium">{formatCurrency(item.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Passivo + Patrimônio */}
                <div className="space-y-6">
                  {/* Passivo */}
                  <div>
                    <div className="flex items-center justify-between py-2 border-b-2 border-warning/30 mb-3">
                      <h3 className="text-lg font-semibold text-warning">Passivo</h3>
                      <span className="text-lg font-bold text-warning">
                        {formatCurrency(balanceSheet.totalLiabilities)}
                      </span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {balanceSheet.liabilities.map((item) => (
                        <div key={item.code} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.code} - {item.name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Patrimônio Líquido */}
                  <div>
                    <div className="flex items-center justify-between py-2 border-b-2 border-primary/30 mb-3">
                      <h3 className="text-lg font-semibold text-primary">Patrimônio Líquido</h3>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(balanceSheet.totalEquity)}
                      </span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {balanceSheet.equity.map((item) => (
                        <div key={item.code} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.code} - {item.name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Resultado do Exercício</span>
                        <span className="font-medium">{formatCurrency(incomeStatement.netIncome)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fluxo de Caixa */}
        <TabsContent value="cashflow">
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa</CardTitle>
              <CardDescription>
                {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contas de Caixa */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Disponibilidades</h3>
                <div className="space-y-2">
                  {cashFlow.cashAccounts.map((item) => (
                    <div key={item.code} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.code} - {item.name}</span>
                      <span className="font-medium">{formatCurrency(item.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>Total em Caixa</span>
                    <span>{formatCurrency(cashFlow.totalCash)}</span>
                  </div>
                </div>
              </div>

              {/* Fluxo Operacional */}
              <div className="pt-4 border-t-2">
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg">
                  <h3 className="text-lg font-bold">Fluxo Operacional (Resultado)</h3>
                  <span className={cn(
                    "text-lg font-bold",
                    cashFlow.operatingCashFlow >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(cashFlow.operatingCashFlow)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balancete de Verificação */}
        <TabsContent value="trial-balance">
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

                  {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) > 0.01 && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">
                        ⚠️ Atenção: Balancete não está balanceado. Diferença de {formatCurrency(Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit))}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Livro Diário */}
        <TabsContent value="journal">
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
      </Tabs>
    </div>
  );
}
