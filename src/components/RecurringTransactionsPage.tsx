import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Repeat, Pencil, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Search } from "lucide-react";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/context/SettingsContext";
import { EditRecurringTransactionModal } from "./EditRecurringTransactionModal";
import { TransactionScopeDialog, EditScope } from "./TransactionScopeDialog";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  category_id: string | null;
  account_id: string;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_end_date: string | null;
  parent_transaction_id?: string | null;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
}

export function RecurringTransactionsPage() {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<RecurringTransaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<RecurringTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const { toast } = useToast();
  const { formatCurrency: formatCurrencyFromSettings } = useSettings();

  const formatCurrency = (value: number) => {
    return formatCurrencyFromSettings(value);
  };

  const formatCents = (valueInCents: number) =>
    formatCurrency(valueInCents / 100);

  useEffect(() => {
    loadRecurringTransactions();
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, type, balance, color, limit_amount, due_date, closing_date')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      logger.error('Error loading accounts:', error);
    }
  };

  const loadRecurringTransactions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(name, color),
          account:accounts!transactions_account_id_fkey(name)
        `)
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data as any || []);
    } catch (error) {
      logger.error('Error loading recurring transactions:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar transações recorrentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (updatedTransaction: RecurringTransaction, scope?: EditScope) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Extrair apenas os campos que foram passados (excluindo id, date e parent_transaction_id)
      const { id, date, parent_transaction_id, ...updates } = updatedTransaction;

      // Determinar o ID da transação principal (parent)
      const parentId = parent_transaction_id || id;

      let description = "";

      if (!scope || scope === "current") {
        // Editar apenas a transação atual
        const { error } = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
        description = "Transação recorrente atualizada com sucesso";
      } else if (scope === "current-and-remaining") {
        // Buscar a data da transação atual
        const { data: currentTx } = await supabase
          .from('transactions')
          .select('date')
          .eq('id', id)
          .single();

        if (!currentTx) throw new Error("Transação não encontrada");

        // Editar esta transação
        const { error: currentError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', id);
        if (currentError) throw currentError;

        // Editar transações futuras (com data >= data atual)
        const { error: futureError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('parent_transaction_id', parentId)
          .gte('date', currentTx.date)
          .neq('id', id);
        if (futureError) throw futureError;

        description = "Transação recorrente e futuras atualizadas com sucesso";
      } else if (scope === "all") {
        // Editar toda a série
        const { error: mainError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', parentId);
        if (mainError) throw mainError;

        // Editar TODAS as filhas
        const { error: childrenError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('parent_transaction_id', parentId);
        if (childrenError) throw childrenError;
        description = "Todas as transações recorrentes da série atualizadas com sucesso";
      }

      toast({
        title: "Sucesso",
        description,
      });

      setTransactions(prev => prev.map(t => 
        t.id === id ? { ...t, ...updatedTransaction } : t
      ));
      
      loadRecurringTransactions();
    } catch (error) {
      logger.error('Error updating recurring transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar transação recorrente",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWithScope = (transaction: RecurringTransaction) => {
    // Abrir diálogo de escopo para transações recorrentes
    setPendingDeleteTransaction(transaction);
    setScopeDialogOpen(true);
  };

  const handleDelete = async (scope: EditScope) => {
    if (!pendingDeleteTransaction) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determinar o ID da transação principal (parent)
      const parentId = pendingDeleteTransaction.parent_transaction_id || pendingDeleteTransaction.id;

      let description = "";

      if (scope === "current") {
        // Deletar apenas a transação atual
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', pendingDeleteTransaction.id);
        if (error) throw error;
        description = "Transação recorrente removida com sucesso";
      } else if (scope === "current-and-remaining") {
        // Buscar a data da transação atual
        const { data: currentTx } = await supabase
          .from('transactions')
          .select('date')
          .eq('id', pendingDeleteTransaction.id)
          .single();

        if (!currentTx) throw new Error("Transação não encontrada");

        // Deletar esta transação e transações futuras (com data >= data atual)
        const { error } = await supabase
          .from('transactions')
          .delete()
          .or(`id.eq.${pendingDeleteTransaction.id},and(parent_transaction_id.eq.${parentId},date.gte.${currentTx.date})`)
          .eq('user_id', user.id);
        if (error) throw error;
        description = "Transação recorrente e futuras removidas com sucesso";
      } else if (scope === "all") {
        // Deletar toda a série
        const { error } = await supabase
          .from('transactions')
          .delete()
          .or(`id.eq.${parentId},parent_transaction_id.eq.${parentId}`)
          .eq('user_id', user.id);
        if (error) throw error;
        description = "Todas as transações recorrentes da série removidas com sucesso";
      }

      toast({
        title: "Sucesso",
        description,
      });

      setTransactions(prev => prev.filter(t => t.id !== pendingDeleteTransaction.id));
    } catch (error) {
      logger.error('Error deleting recurring transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir transação recorrente",
        variant: "destructive",
      });
    } finally {
      setScopeDialogOpen(false);
      setPendingDeleteTransaction(null);
    }
  };

  const getRecurrenceLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily: "Diário",
      weekly: "Semanal",
      monthly: "Mensal",
      yearly: "Anual",
    };
    return labels[type] || type;
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = 
        filterType === "all" || 
        transaction.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, filterType]);

  const stats = useMemo(() => {
    const monthlyIncome = filteredTransactions
      .filter(t => t.type === "income" && t.recurrence_type === "monthly")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = filteredTransactions
      .filter(t => t.type === "expense" && t.recurrence_type === "monthly")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      total: filteredTransactions.length,
      monthlyIncome,
      monthlyExpenses,
    };
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">
                  Total de Recorrentes
                </p>
                <div className="text-responsive-xl font-bold leading-tight">
                  {stats.total}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">
                  Receitas Mensais
                </p>
                <div className="text-responsive-xl font-bold balance-positive leading-tight">
                  {formatCents(stats.monthlyIncome)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card sm:col-span-2 lg:col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">
                  Despesas Mensais
                </p>
                <div className="text-responsive-xl font-bold balance-negative leading-tight">
                  {formatCents(stats.monthlyExpenses)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search" className="text-caption">Buscar</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar transações recorrentes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter" className="text-caption">Filtrar por Tipo</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger id="filter" className="touch-target mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">Geração Automática</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            As transações recorrentes configuradas serão geradas automaticamente todos os dias às 00:01, 
            respeitando a frequência e data final definidas.
          </p>
        </CardContent>
      </Card>

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm || filterType !== "all"
                ? "Nenhum resultado encontrado"
                : "Nenhuma transação recorrente cadastrada"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {transaction.description}
                      <Badge variant={transaction.type === "income" ? "default" : "secondary"}>
                        {transaction.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Repeat className="h-3 w-3" />
                      {transaction.recurrence_type ? getRecurrenceLabel(transaction.recurrence_type) : '-'}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCents(Math.abs(transaction.amount))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: transaction.category?.color }}
                      />
                      {transaction.category?.name}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      {transaction.account?.name}
                    </div>
                    {transaction.recurrence_end_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Termina em: {format(new Date(transaction.recurrence_end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditTransaction(transaction)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteWithScope(transaction)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingDeleteTransaction && (
        <TransactionScopeDialog
          open={scopeDialogOpen}
          onOpenChange={setScopeDialogOpen}
          onScopeSelected={handleDelete}
          isRecurring={true}
          mode="delete"
        />
      )}

      <EditRecurringTransactionModal
        open={!!editTransaction}
        onOpenChange={(open) => !open && setEditTransaction(null)}
        onEditTransaction={handleEdit}
        transaction={editTransaction}
        accounts={accounts}
      />
    </div>
  );
}
