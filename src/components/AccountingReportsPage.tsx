import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BookOpen, Scale, TrendingUp, Wallet, Waves, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { generateCashFlow, generateDRE } from "@/lib/accountingReports";
import { useDoubleEntryValidation } from "@/hooks/useDoubleEntryValidation";
import { DoubleEntryAlert } from "@/components/accounting/DoubleEntryAlert";

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

  // Validação de partidas dobradas
  const { validationResults, totalUnbalancedTransactions, hasUnbalancedEntries } = useDoubleEntryValidation(journalEntries);

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

  // DRE (Demonstração de Resultados) - Lei 6.404/76
  const incomeStatement = useMemo(() => {
    return generateDRE(journalEntries, chartOfAccounts, startDate, endDate);
  }, [journalEntries, chartOfAccounts, startDate, endDate]);

  // Balanço Patrimonial
  const balanceSheet = useMemo(() => {
    const assets = trialBalance.filter(e => e.category === "asset");
    const contraAssets = trialBalance.filter(e => e.category === "contra_asset");
    const liabilities = trialBalance.filter(e => e.category === "liability");
    const contraLiabilities = trialBalance.filter(e => e.category === "contra_liability");
    const equity = trialBalance.filter(e => e.category === "equity");

    // Calcular totais corretamente: contas retificadoras devem ser subtraídas
    const totalAssets = assets.reduce((sum, e) => sum + Math.abs(e.balance), 0) - 
                        contraAssets.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, e) => sum + Math.abs(e.balance), 0) - 
                             contraLiabilities.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    const equityFromAccounts = equity.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    
    // CORREÇÃO: Patrimônio Líquido = Ativo - Passivo
    // O Resultado do Exercício já está refletido nos saldos das contas através dos journal_entries
    // Não devemos somar o netIncome novamente, pois isso causaria dupla contabilização
    const totalEquity = totalAssets - totalLiabilities;

    return {
      assets: assets.map(a => ({ ...a, balance: Math.abs(a.balance) })),
      contraAssets: contraAssets.map(a => ({ ...a, balance: Math.abs(a.balance) })),
      liabilities: liabilities.map(l => ({ ...l, balance: Math.abs(l.balance) })),
      contraLiabilities: contraLiabilities.map(l => ({ ...l, balance: Math.abs(l.balance) })),
      equity: equity.map(e => ({ ...e, balance: Math.abs(e.balance) })),
      totalAssets,
      totalLiabilities,
      totalEquity,
      equityFromAccounts, // Patrimônio registrado nas contas (sem o resultado)
    };
  }, [trialBalance, incomeStatement]);

  // Fluxo de Caixa
  const cashFlow = useMemo(() => {
    const report = generateCashFlow(journalEntries, chartOfAccounts, startDate, endDate);
    
    // Buscar contas de caixa/banco do balancete para exibição
    const cashAccounts = trialBalance.filter(e => 
      e.category === "asset" && (e.code.startsWith("1.01.01") || e.code.startsWith("1.01.02") || e.code.startsWith("1.01.03"))
    );

    return {
      cashAccounts,
      operatingCashFlow: report.operatingActivities,
      totalCash: report.closingBalance,
      openingBalance: report.openingBalance,
      inflows: report.inflows,
      outflows: report.outflows,
      investmentActivities: report.investmentActivities,
      netCashFlow: report.netCashFlow,
      closingBalance: report.closingBalance,
    };
  }, [journalEntries, chartOfAccounts, startDate, endDate, trialBalance]);

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
      {/* Alerta de Partidas Dobradas Desbalanceadas */}
      {hasUnbalancedEntries && (
        <DoubleEntryAlert 
          validationResults={validationResults}
          totalUnbalancedTransactions={totalUnbalancedTransactions}
        />
      )}

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

        {/* DRE - Lei 6.404/76 */}
        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração do Resultado do Exercício (DRE)</CardTitle>
              <CardDescription>
                Estrutura Vertical - Lei 6.404/76 | {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 1. Receita Operacional Bruta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 font-semibold">
                  <span className="text-body">RECEITA OPERACIONAL BRUTA</span>
                  <span className="balance-text text-success">
                    {formatCurrency(incomeStatement.grossRevenue)}
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  {incomeStatement.revenueItems.map((item: { code: string; name: string; amount: number }) => (
                    <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                      <span>{item.code} - {item.name}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Deduções */}
              {incomeStatement.revenueDeductions > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-body">(-) DEDUÇÕES DA RECEITA BRUTA</span>
                    <span className="balance-text text-destructive">
                      {formatCurrency(incomeStatement.revenueDeductions)}
                    </span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {incomeStatement.deductionItems.map((item: { code: string; name: string; amount: number }) => (
                      <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                        <span>{item.code} - {item.name}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Receita Líquida */}
              <div className="flex items-center justify-between py-3 px-4 bg-success/10 rounded-lg font-bold">
                <span className="text-body-large">= RECEITA OPERACIONAL LÍQUIDA</span>
                <span className="text-headline text-success">
                  {formatCurrency(incomeStatement.netRevenue)}
                </span>
              </div>

              {/* 4. CMV/CSV */}
              {incomeStatement.cogs > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-body">(-) CMV/CSV</span>
                    <span className="balance-text text-destructive">
                      {formatCurrency(incomeStatement.cogs)}
                    </span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {incomeStatement.cogsItems.map((item: { code: string; name: string; amount: number }) => (
                      <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                        <span>{item.code} - {item.name}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Lucro Bruto */}
              <div className="flex items-center justify-between py-3 px-4 bg-primary/10 rounded-lg font-bold border-l-4 border-primary">
                <span className="text-body-large">= LUCRO BRUTO</span>
                <span className={cn(
                  "text-headline",
                  incomeStatement.grossProfit >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(incomeStatement.grossProfit)}
                </span>
              </div>

              {/* 6. Despesas Operacionais */}
              {incomeStatement.operatingExpenses > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-body">(-) DESPESAS OPERACIONAIS</span>
                    <span className="balance-text text-destructive">
                      {formatCurrency(incomeStatement.operatingExpenses)}
                    </span>
                  </div>
                  
                  {/* Despesas com Vendas */}
                  {incomeStatement.salesExpenses > 0 && (
                    <div className="ml-4 space-y-1">
                      <div className="flex justify-between text-body-large font-medium">
                        <span>Despesas com Vendas</span>
                        <span className="text-destructive">{formatCurrency(incomeStatement.salesExpenses)}</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        {incomeStatement.salesExpenseItems.map((item: { code: string; name: string; amount: number }) => (
                          <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                            <span>{item.code} - {item.name}</span>
                            <span>{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Despesas Administrativas */}
                  {incomeStatement.administrativeExpenses > 0 && (
                    <div className="ml-4 space-y-1">
                      <div className="flex justify-between text-body-large font-medium">
                        <span>Despesas Administrativas</span>
                        <span className="text-destructive">{formatCurrency(incomeStatement.administrativeExpenses)}</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        {incomeStatement.administrativeExpenseItems.map((item: { code: string; name: string; amount: number }) => (
                          <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                            <span>{item.code} - {item.name}</span>
                            <span>{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. EBIT */}
              <div className="flex items-center justify-between py-3 px-4 bg-primary/10 rounded-lg font-bold border-l-4 border-primary">
                <span className="text-body-large">= LUCRO OPERACIONAL (EBIT)</span>
                <span className={cn(
                  "text-headline",
                  incomeStatement.ebit >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(incomeStatement.ebit)}
                </span>
              </div>

              {/* 8. Resultado Financeiro */}
              {(incomeStatement.financialRevenue > 0 || incomeStatement.financialExpenses > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-body">(+/-) RESULTADO FINANCEIRO</span>
                    <span className={cn(
                      "balance-text",
                      incomeStatement.financialResult >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(incomeStatement.financialResult)}
                    </span>
                  </div>
                  
                  {incomeStatement.financialRevenue > 0 && (
                    <div className="ml-6 space-y-1">
                      <div className="text-body font-medium">Receitas Financeiras</div>
                      {incomeStatement.financialRevenueItems.map((item: { code: string; name: string; amount: number }) => (
                        <div key={item.code} className="flex justify-between text-caption text-muted-foreground ml-4">
                          <span>{item.code} - {item.name}</span>
                          <span className="text-success">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {incomeStatement.financialExpenses > 0 && (
                    <div className="ml-6 space-y-1">
                      <div className="text-body font-medium">(-) Despesas Financeiras</div>
                      {incomeStatement.financialExpenseItems.map((item: { code: string; name: string; amount: number }) => (
                        <div key={item.code} className="flex justify-between text-caption text-muted-foreground ml-4">
                          <span>{item.code} - {item.name}</span>
                          <span className="text-destructive">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 9. Lucro antes IR */}
              <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg font-bold">
                <span className="text-body-large">= LUCRO ANTES DO IR/CSLL</span>
                <span className={cn(
                  "text-headline",
                  incomeStatement.profitBeforeTaxes >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(incomeStatement.profitBeforeTaxes)}
                </span>
              </div>

              {/* 10. Impostos */}
              {incomeStatement.incomeTaxes > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-body">(-) PROVISÃO PARA IR E CSLL</span>
                    <span className="balance-text text-destructive">
                      {formatCurrency(incomeStatement.incomeTaxes)}
                    </span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {incomeStatement.incomeTaxItems.map((item: { code: string; name: string; amount: number }) => (
                      <div key={item.code} className="flex justify-between text-caption text-muted-foreground">
                        <span>{item.code} - {item.name}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 11. Lucro Líquido */}
              <div className="flex items-center justify-between py-4 px-4 bg-success/20 rounded-lg font-bold border-2 border-success/30">
                <span className="text-title">= LUCRO LÍQUIDO DO EXERCÍCIO</span>
                <span className={cn(
                  "text-display",
                  incomeStatement.netProfit >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(incomeStatement.netProfit)}
                </span>
              </div>

              {/* 12. Outras Receitas/Despesas */}
              {incomeStatement.otherRevenuesExpenses !== 0 && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 font-semibold">
                      <span className="text-body">(+/-) OUTRAS RECEITAS E DESPESAS</span>
                      <span className={cn(
                        "balance-text",
                        incomeStatement.otherRevenuesExpenses >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {formatCurrency(incomeStatement.otherRevenuesExpenses)}
                      </span>
                    </div>
                    <div className="ml-6 space-y-1 text-caption text-muted-foreground">
                      {incomeStatement.otherRevenueItems.map((item: { code: string; name: string; amount: number }) => (
                        <div key={item.code} className="flex justify-between">
                          <span>{item.code} - {item.name}</span>
                          <span className="text-success">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      {incomeStatement.otherExpenseItems.map((item: { code: string; name: string; amount: number }) => (
                        <div key={item.code} className="flex justify-between">
                          <span>{item.code} - {item.name}</span>
                          <span className="text-destructive">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 13. Resultado Final */}
                  <div className="flex items-center justify-between py-4 px-4 bg-primary/20 rounded-lg font-bold border-2 border-primary">
                    <span className="text-title">= RESULTADO DO EXERCÍCIO</span>
                    <span className={cn(
                      "text-display",
                      incomeStatement.finalResult >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(incomeStatement.finalResult)}
                    </span>
                  </div>
                </>
              )}

              {/* EBITDA (Informativo) */}
              <div className="pt-4 border-t mt-6">
                <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
                  <div className="space-y-1">
                    <span className="text-body-large font-semibold">EBITDA (Informativo)</span>
                    <p className="text-caption text-muted-foreground">
                      EBIT + Depreciação + Amortização
                    </p>
                  </div>
                  <span className={cn(
                    "text-headline font-bold",
                    incomeStatement.ebitda >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(incomeStatement.ebitda)}
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
                    {balanceSheet.contraAssets.map((item) => (
                      <div key={item.code} className="flex justify-between text-sm">
                        <span className="text-muted-foreground italic">{item.code} - {item.name}</span>
                        <span className="font-medium text-destructive">({formatCurrency(item.balance)})</span>
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
                      {balanceSheet.contraLiabilities.map((item) => (
                        <div key={item.code} className="flex justify-between text-sm">
                          <span className="text-muted-foreground italic">{item.code} - {item.name}</span>
                          <span className="font-medium text-destructive">({formatCurrency(item.balance)})</span>
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
                      {/* Capital Próprio e Lucros Acumulados */}
                      {balanceSheet.equity.map((item) => (
                        <div key={item.code} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.code} - {item.name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))}
                      
                      {/* Resultado do Exercício (Lucro/Prejuízo do Período) */}
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground italic">Resultado do Exercício (período)</span>
                          <span className={cn(
                            "font-medium italic",
                            incomeStatement.finalResult >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {formatCurrency(incomeStatement.finalResult)}
                          </span>
                        </div>
                        <p className="text-caption text-muted-foreground/70 italic">
                          * Já incluído no total de PL acima
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validação da Equação Contábil */}
              <div className="pt-6 border-t-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <p className="text-caption text-muted-foreground mb-1">Total de Ativos</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(balanceSheet.totalAssets)}</p>
                  </div>
                  <div className="p-4 bg-warning/5 rounded-lg">
                    <p className="text-caption text-muted-foreground mb-1">Passivo + Patrimônio Líquido</p>
                    <p className="text-xl font-bold text-warning">
                      {formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}
                    </p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-lg",
                    Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) < 0.01
                      ? "bg-success/10 border-2 border-success/20"
                      : "bg-destructive/10 border-2 border-destructive/20"
                  )}>
                    <p className="text-caption text-muted-foreground mb-1">Status da Equação</p>
                    <p className={cn(
                      "text-xl font-bold",
                      Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) < 0.01
                        ? "text-success"
                        : "text-destructive"
                    )}>
                      {Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) < 0.01
                        ? "✓ Balanceado"
                        : "✗ Desbalanceado"}
                    </p>
                  </div>
                </div>
                
                {Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) >= 0.01 && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ Atenção: A equação contábil fundamental não está balanceada.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ATIVO ({formatCurrency(balanceSheet.totalAssets)}) ≠ PASSIVO + PL ({formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Diferença: {formatCurrency(Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)))}
                    </p>
                  </div>
                )}
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
              {/* Saldo Inicial */}
              <div>
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg">
                  <h3 className="text-lg font-bold">Saldo Inicial</h3>
                  <span className="text-lg font-bold">
                    {formatCurrency(cashFlow.openingBalance)}
                  </span>
                </div>
              </div>

              {/* Atividades Operacionais */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Atividades Operacionais
                </h3>
                <div className="space-y-2 ml-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-success">+ Entradas (Débitos em Caixa)</span>
                    <span className="font-medium text-success">{formatCurrency(cashFlow.inflows)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-destructive">- Saídas (Créditos em Caixa)</span>
                    <span className="font-medium text-destructive">({formatCurrency(cashFlow.outflows)})</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>Fluxo Operacional Líquido</span>
                    <span className={cn(
                      cashFlow.operatingCashFlow >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(cashFlow.operatingCashFlow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Atividades de Investimento */}
              {cashFlow.investmentActivities !== 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Atividades de Investimento
                  </h3>
                  <div className="space-y-2 ml-6">
                    <div className="flex justify-between pt-2 font-bold">
                      <span>Fluxo de Investimentos</span>
                      <span className={cn(
                        cashFlow.investmentActivities >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {formatCurrency(cashFlow.investmentActivities)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fluxo de Caixa Líquido */}
              <div className="pt-4 border-t-2">
                <div className="flex items-center justify-between py-3 bg-primary/10 px-4 rounded-lg">
                  <h3 className="text-lg font-bold">Fluxo de Caixa Líquido do Período</h3>
                  <span className={cn(
                    "text-lg font-bold",
                    cashFlow.netCashFlow >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(cashFlow.netCashFlow)}
                  </span>
                </div>
              </div>

              {/* Saldo Final */}
              <div>
                <div className="flex items-center justify-between py-4 bg-muted px-4 rounded-lg border-2 border-primary/20">
                  <h3 className="text-xl font-bold">Saldo Final de Caixa</h3>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(cashFlow.closingBalance)}
                  </span>
                </div>
              </div>

              {/* Disponibilidades por Conta */}
              {cashFlow.cashAccounts.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-caption font-semibold mb-2 text-muted-foreground">
                    Composição do Saldo Final:
                  </h3>
                  <div className="space-y-1 ml-4">
                    {cashFlow.cashAccounts.map((item) => (
                      <div key={item.code} className="flex justify-between text-caption">
                        <span className="text-muted-foreground">{item.code} - {item.name}</span>
                        <span className="font-medium">{formatCurrency(Math.abs(item.balance))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                              entry.balance >= 0 ? "text-success" : "text-destructive"
                            )}>
                              {formatCurrency(Math.abs(entry.balance))}
                            </TableCell>
                          </TableRow>
                        ))}
                      <TableRow className={cn(
                        "font-bold bg-muted/50",
                        Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) >= 0.01 && "bg-destructive/10"
                      )}>
                        <TableCell colSpan={3} className="flex items-center gap-2">
                          Total
                          {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) >= 0.01 && (
                            <Badge variant="destructive" className="text-caption">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Desbalanceado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(trialBalanceTotals.debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(trialBalanceTotals.credit)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono font-semibold",
                          Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) >= 0.01 && "text-destructive"
                        )}>
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

                  {/* Validação da Equação Contábil Fundamental */}
                  {Math.abs(trialBalanceTotals.debit - trialBalanceTotals.credit) < 0.01 && (
                    <div className="mt-6 pt-6 border-t-2">
                      <h3 className="text-headline font-semibold mb-4">Validação da Equação Contábil Fundamental</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-primary/5 rounded-lg">
                          <p className="text-caption text-muted-foreground mb-1">Total de Ativos</p>
                          <p className="text-xl font-bold text-primary">
                            {formatCurrency(
                              trialBalance
                                .filter(e => e.category === "asset")
                                .reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance
                                .filter(e => e.category === "contra_asset")
                                .reduce((sum, e) => sum + Math.abs(e.balance), 0)
                            )}
                          </p>
                        </div>
                        <div className="p-4 bg-warning/5 rounded-lg">
                          <p className="text-caption text-muted-foreground mb-1">Passivo + Patrimônio Líquido</p>
                          <p className="text-xl font-bold text-warning">
                            {formatCurrency(
                              trialBalance
                                .filter(e => e.category === "liability")
                                .reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance
                                .filter(e => e.category === "contra_liability")
                                .reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              trialBalance
                                .filter(e => e.category === "equity")
                                .reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              incomeStatement.finalResult
                            )}
                          </p>
                        </div>
                        <div className={cn(
                          "p-4 rounded-lg",
                          Math.abs(
                            (trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                            trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)) -
                            (trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                            trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                            trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                            incomeStatement.finalResult)
                          ) < 0.01
                            ? "bg-success/10 border-2 border-success/20"
                            : "bg-destructive/10 border-2 border-destructive/20"
                        )}>
                          <p className="text-caption text-muted-foreground mb-1">Status A = P + PL</p>
                          <p className={cn(
                            "text-xl font-bold",
                            Math.abs(
                              (trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)) -
                              (trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              incomeStatement.finalResult)
                            ) < 0.01
                              ? "text-success"
                              : "text-destructive"
                          )}>
                            {Math.abs(
                              (trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)) -
                              (trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                              trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                              incomeStatement.finalResult)
                            ) < 0.01
                              ? "✓ Balanceado"
                              : "✗ Desbalanceado"}
                          </p>
                        </div>
                      </div>
                      
                      {Math.abs(
                        (trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                        trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)) -
                        (trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                        trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                        trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                        incomeStatement.finalResult)
                      ) >= 0.01 && (
                        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-destructive font-medium">
                              A equação contábil fundamental não está balanceada.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ATIVO ({formatCurrency(
                                trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                                trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)
                              )}) ≠ 
                              PASSIVO + PL + RESULTADO ({formatCurrency(
                                trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                                trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                                trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                                incomeStatement.finalResult
                              )})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Diferença: {formatCurrency(Math.abs(
                                (trialBalance.filter(e => e.category === "asset").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                                trialBalance.filter(e => e.category === "contra_asset").reduce((sum, e) => sum + Math.abs(e.balance), 0)) -
                                (trialBalance.filter(e => e.category === "liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) -
                                trialBalance.filter(e => e.category === "contra_liability").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                                trialBalance.filter(e => e.category === "equity").reduce((sum, e) => sum + Math.abs(e.balance), 0) +
                                incomeStatement.finalResult)
                              ))}
                            </p>
                          </div>
                        </div>
                      )}
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
