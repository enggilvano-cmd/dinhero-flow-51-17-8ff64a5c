import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, BookOpen } from "lucide-react";
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
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  nature: "debit" | "credit";
}

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function LedgerPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  
  // Filtros de período
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    loadChartOfAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadJournalEntries();
    }
  }, [selectedAccountId, startDate, endDate]);

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
      await loadChartOfAccounts();
    } catch (error) {
      console.error("Erro ao inicializar plano de contas:", error);
      toast({
        title: "Erro na inicialização",
        description: "Não foi possível inicializar o plano de contas.",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
    }
  };

  const loadChartOfAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      
      // Se não houver contas, precisa inicializar
      if (!data || data.length === 0) {
        setNeedsInitialization(true);
        setChartOfAccounts([]);
        setLoading(false);
        return;
      }
      
      setChartOfAccounts(data || []);
      setNeedsInitialization(false);
      
      // Selecionar primeira conta por padrão
      if (data && data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar plano de contas:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar o plano de contas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadJournalEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("account_id", selectedAccountId)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"))
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setJournalEntries((data || []) as JournalEntry[]);
    } catch (error) {
      console.error("Erro ao carregar lançamentos:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os lançamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = useMemo(() => {
    return chartOfAccounts.find(acc => acc.id === selectedAccountId);
  }, [chartOfAccounts, selectedAccountId]);

  // Calcular saldo inicial (antes do período selecionado)
  const openingBalance = useMemo(async () => {
    if (!selectedAccountId || !selectedAccount) return 0;

    const { data, error } = await supabase
      .from("journal_entries")
      .select("entry_type, amount")
      .eq("account_id", selectedAccountId)
      .lt("entry_date", format(startDate, "yyyy-MM-dd"));

    if (error) return 0;

    let balance = 0;
    (data || []).forEach(entry => {
      if (selectedAccount.nature === "debit") {
        balance += entry.entry_type === "debit" ? entry.amount : -entry.amount;
      } else {
        balance += entry.entry_type === "credit" ? entry.amount : -entry.amount;
      }
    });

    return balance;
  }, [selectedAccountId, selectedAccount, startDate]);

  // Construir livro razão com saldo acumulado
  const ledgerEntries = useMemo(() => {
    const entries: LedgerEntry[] = [];
    let runningBalance = 0; // Será atualizado com saldo inicial

    // Aguardar saldo inicial
    Promise.resolve(openingBalance).then(initialBalance => {
      runningBalance = initialBalance;
    });

    journalEntries.forEach(entry => {
      const debit = entry.entry_type === "debit" ? entry.amount : 0;
      const credit = entry.entry_type === "credit" ? entry.amount : 0;

      // Atualizar saldo baseado na natureza da conta
      if (selectedAccount?.nature === "debit") {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      entries.push({
        date: entry.entry_date,
        description: entry.description,
        debit,
        credit,
        balance: runningBalance,
      });
    });

    return entries;
  }, [journalEntries, selectedAccount, openingBalance]);

  // Totais
  const totals = useMemo(() => {
    return ledgerEntries.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [ledgerEntries]);

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
            <p className="text-muted-foreground">Carregando livro razão...</p>
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
            <CardTitle>Plano de Contas Não Inicializado</CardTitle>
            <CardDescription>
              Para utilizar o Livro Razão, é necessário inicializar o Plano de Contas.
              Isso criará a estrutura contábil padrão.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Livro Razão
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórico detalhado de movimentação por conta contábil
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Seleção de Conta */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conta Contábil</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {chartOfAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Inicial */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
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

            {/* Data Final */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
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
          </div>
        </CardContent>
      </Card>

      {/* Informações da Conta */}
      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Conta: {selectedAccount.code} - {selectedAccount.name}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{getCategoryLabel(selectedAccount.category)}</Badge>
              <Badge variant="secondary">
                Natureza: {selectedAccount.nature === "debit" ? "Devedora" : "Credora"}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Livro Razão */}
      <Card>
        <CardHeader>
          <CardTitle>Lançamentos no Período</CardTitle>
          <CardDescription>
            Histórico com saldo acumulado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ledgerEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lançamento encontrado no período selecionado
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Saldo Inicial */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-medium">
                      Saldo Anterior
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(0)} {/* Atualizar com openingBalance real */}
                    </TableCell>
                  </TableRow>

                  {/* Lançamentos */}
                  {ledgerEntries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="max-w-md">{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono font-semibold",
                        entry.balance >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(Math.abs(entry.balance))}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totais */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2}>Total do Período</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.credit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Math.abs(totals.debit - totals.credit))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
