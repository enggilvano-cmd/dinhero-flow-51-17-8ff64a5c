import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, TrendingUp, TrendingDown, Calendar, Search, CalendarPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { logger } from "@/lib/logger";
import { AddFixedTransactionModal } from "./AddFixedTransactionModal";
import { EditFixedTransactionModal } from "./EditFixedTransactionModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

interface FixedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string;
  is_fixed: boolean;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
}

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
}

export function FixedTransactionsPage() {
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<FixedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<FixedTransaction | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFixedTransactions();
    loadAccounts();
  }, []);

  const loadFixedTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          description,
          amount,
          date,
          type,
          category_id,
          account_id,
          is_fixed,
          category:categories(name, color),
          account:accounts!transactions_account_id_fkey(name)
        `)
        .eq("user_id", user.id)
        .eq("is_fixed", true)
        .neq("type", "transfer")
        .order("date", { ascending: false });

      if (error) throw error;
      setTransactions(data as FixedTransaction[]);
    } catch (error) {
      logger.error("Error loading fixed transactions:", error);
      toast({
        title: "Erro ao carregar transações fixas",
        description: "Não foi possível carregar as transações fixas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, type, balance, color, limit_amount, due_date, closing_date")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      logger.error("Error loading accounts:", error);
    }
  };

  const handleAdd = async (transaction: Omit<FixedTransaction, "id"> & { status?: "pending" | "completed" }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Gerar transações do mês atual até o final do ano corrente + todos os meses do próximo ano
      const transactionsToGenerate = [];
      // Parse da data de forma segura para evitar problemas de timezone
      const [year, month, day] = transaction.date.split('-').map(Number);
      const currentYear = year;
      const currentMonth = month - 1; // JavaScript usa 0-11 para meses
      const dayOfMonth = day;

      // Calcular meses restantes no ano corrente (incluindo o mês atual)
      const monthsLeftInCurrentYear = 12 - currentMonth;

      // Usar o status escolhido pelo usuário, padrão é "pending"
      const initialStatus = transaction.status || "pending";

      // Gerar transações para os meses restantes do ano corrente
      // A primeira transação (i=0) será a transação principal recorrente
      for (let i = 0; i < monthsLeftInCurrentYear; i++) {
        const nextDate = new Date(currentYear, currentMonth + i, dayOfMonth);
        
        // Ajustar para o dia correto do mês
        const targetMonth = nextDate.getMonth();
        nextDate.setDate(dayOfMonth);
        
        // Se o mês mudou (ex: 31 de janeiro -> 3 de março), ajustar para o último dia do mês anterior
        if (nextDate.getMonth() !== targetMonth) {
          nextDate.setDate(0);
        }

        const transactionDate = nextDate.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        // A primeira transação usa o status escolhido pelo usuário
        // As demais seguem a lógica de data (passado = completed, futuro = pending)
        if (i === 0) {
          transactionsToGenerate.push({
            description: transaction.description,
            amount: transaction.amount,
            date: transactionDate,
            type: transaction.type,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            status: initialStatus,
            user_id: user.id,
            is_fixed: true,
          });
        } else {
          transactionsToGenerate.push({
            description: transaction.description,
            amount: transaction.amount,
            date: transactionDate,
            type: transaction.type,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            status: transactionDate <= today ? "completed" as const : "pending" as const,
            user_id: user.id,
          });
        }
      }

      // Gerar transações para todos os 12 meses do próximo ano
      const nextYear = currentYear + 1;
      for (let month = 0; month < 12; month++) {
        const nextDate = new Date(nextYear, month, dayOfMonth);
        
        // Ajustar para o dia correto do mês
        const targetMonth = nextDate.getMonth();
        nextDate.setDate(dayOfMonth);
        
        // Se o mês mudou (ex: 31 de janeiro -> 3 de março), ajustar para o último dia do mês anterior
        if (nextDate.getMonth() !== targetMonth) {
          nextDate.setDate(0);
        }

      transactionsToGenerate.push({
        description: transaction.description,
        amount: transaction.amount,
        date: nextDate.toISOString().split('T')[0],
        type: transaction.type,
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        status: "pending" as const,
        user_id: user.id,
        is_fixed: true,
      });
      }

      // Inserir todas as transações de uma vez
      const { error: insertError, data: insertedTransactions } = await supabase
        .from("transactions")
        .insert(transactionsToGenerate)
        .select();

      if (insertError) throw insertError;

      // Pegar o ID da transação principal (a primeira inserida)
      const recurringTransaction = insertedTransactions[0];

      // Atualizar as transações filhas com o parent_transaction_id
      const childTransactionIds = insertedTransactions.slice(1).map(t => t.id);
      
      if (childTransactionIds.length > 0) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ parent_transaction_id: recurringTransaction.id })
          .in("id", childTransactionIds);

        if (updateError) {
          logger.error("Erro ao vincular transações filhas:", updateError);
        }
      }

      const nextYearCalc = currentYear + 1;
      toast({
        title: "Transação fixa adicionada",
        description: `${transactionsToGenerate.length} transações foram geradas (até o final de ${nextYearCalc})`,
      });

      // 🔄 Sincronizar listas e dashboard imediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      loadFixedTransactions();
      setAddModalOpen(false);
    } catch (error) {
      logger.error("Error adding fixed transaction:", error);
      toast({
        title: "Erro ao adicionar transação",
        description: "Não foi possível adicionar a transação fixa.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (transaction: FixedTransaction) => {
    try {
      // Na página de Transações Fixas, sempre editar a transação principal e todas as pendentes
      const updates = {
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        date: transaction.date,
      };

      // Editar a transação principal
      const { error: mainError } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction.id);
      if (mainError) throw mainError;

      // Editar todas as transações pendentes geradas
      const { error: childrenError } = await supabase
        .from("transactions")
        .update(updates)
        .eq("parent_transaction_id", transaction.id)
        .eq("status", "pending");
      if (childrenError) throw childrenError;

      toast({
        title: "Transação atualizada",
        description: "A transação fixa e todas as pendentes foram atualizadas com sucesso.",
      });

      // 🔄 Sincronizar listas e dashboard imediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      loadFixedTransactions();
      setEditModalOpen(false);
    } catch (error) {
      logger.error("Error updating transaction:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a transação.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;

    try {
      // Na página de Transações Fixas, sempre deletar a transação principal e todas as pendentes
      
      // Deletar todas as transações pendentes geradas
      const { error: childrenError } = await supabase
        .from("transactions")
        .delete()
        .eq("parent_transaction_id", transactionToDelete)
        .eq("status", "pending");
      if (childrenError) throw childrenError;

      // Deletar a transação principal
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionToDelete);
      if (error) throw error;

      toast({
        title: "Transação removida",
        description: "A transação fixa e todas as pendentes foram removidas com sucesso.",
      });

      // 🔄 Sincronizar listas e dashboard imediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      loadFixedTransactions();
    } catch (error) {
      logger.error("Error deleting transaction:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover a transação.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleGenerateNext12Months = async (transactionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar a transação fixa principal
      const { data: mainTransaction, error: fetchError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchError || !mainTransaction) {
        throw new Error("Transação não encontrada");
      }

      // Buscar a última transação gerada (maior data)
      const { data: childTransactions, error: childError } = await supabase
        .from("transactions")
        .select("date")
        .eq("parent_transaction_id", transactionId)
        .order("date", { ascending: false })
        .limit(1);

      if (childError) throw childError;

      // Determinar a data inicial para os próximos 12 meses
      let startDate: Date;
      if (childTransactions && childTransactions.length > 0) {
        // Se existem transações filhas, começar do mês seguinte à última
        const lastDate = new Date(childTransactions[0].date);
        startDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
      } else {
        // Se não existem transações filhas, começar do mês seguinte à principal
        const mainDate = new Date(mainTransaction.date);
        startDate = new Date(mainDate.getFullYear(), mainDate.getMonth() + 1, mainDate.getDate());
      }

      const dayOfMonth = new Date(mainTransaction.date).getDate();
      const transactionsToGenerate = [];

      // Gerar 12 meses subsequentes
      for (let i = 0; i < 12; i++) {
        const nextDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i,
          dayOfMonth
        );

        // Ajustar para o dia correto do mês
        const targetMonth = nextDate.getMonth();
        nextDate.setDate(dayOfMonth);

        // Se o mês mudou, ajustar para o último dia do mês anterior
        if (nextDate.getMonth() !== targetMonth) {
          nextDate.setDate(0);
        }

        transactionsToGenerate.push({
          description: mainTransaction.description,
          amount: mainTransaction.amount,
          date: nextDate.toISOString().split("T")[0],
          type: mainTransaction.type,
          category_id: mainTransaction.category_id,
          account_id: mainTransaction.account_id,
          status: "pending" as const,
          user_id: user.id,
          is_fixed: false,
          parent_transaction_id: transactionId,
        });
      }

      // Inserir as novas transações
      const { error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToGenerate);

      if (insertError) throw insertError;

      toast({
        title: "Transações geradas",
        description: `12 novos meses foram gerados com sucesso.`,
      });

      // 🔄 Sincronizar listas e dashboard
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
        queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
      ]);

      loadFixedTransactions();
    } catch (error) {
      logger.error("Error generating next 12 months:", error);
      toast({
        title: "Erro ao gerar transações",
        description: "Não foi possível gerar os próximos 12 meses.",
        variant: "destructive",
      });
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        filterType === "all" || transaction.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, filterType]);

  const stats = useMemo(() => {
    const totalFixed = filteredTransactions.length;
    const monthlyIncome = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyExpenses = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { totalFixed, monthlyIncome, monthlyExpenses };
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 w-full lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button onClick={() => setAddModalOpen(true)} className="gap-1.5 apple-interaction h-9 text-xs sm:text-sm px-2 sm:px-3">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate whitespace-nowrap">
              <span className="hidden sm:inline">Nova Transação Fixa</span>
              <span className="sm:hidden">Nova Fixa</span>
            </span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Total de Fixas</p>
                <div className="text-responsive-xl font-bold leading-tight">{stats.totalFixed}</div>
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
                <p className="text-caption font-medium text-muted-foreground">Receitas Mensais</p>
                <div className="text-responsive-xl font-bold balance-positive leading-tight">
                  {formatCurrency(stats.monthlyIncome)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card col-span-2 lg:col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-muted-foreground">Despesas Mensais</p>
                <div className="text-responsive-xl font-bold balance-negative leading-tight">
                  {formatCurrency(stats.monthlyExpenses)}
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
                  placeholder="Buscar por descrição..."
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
                  <SelectItem value="all">Todas</SelectItem>
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
              <h3 className="text-base font-semibold mb-2">Informações Importantes</h3>
            </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Geração Inicial:</strong> Ao criar uma transação fixa, são geradas automaticamente todas as ocorrências do mês atual até o final do próximo ano.
            </p>
            <p>
              • <strong>Período de Geração:</strong> As transações são criadas para os meses restantes do ano corrente + 12 meses do próximo ano (até 24 ocorrências).
            </p>
            <p>
              • <strong>Edição:</strong> Ao editar uma transação fixa, a transação principal e todas as transações pendentes futuras são atualizadas automaticamente.
            </p>
            <p>
              • <strong>Exclusão:</strong> Ao excluir uma transação fixa, a transação principal e todas as transações pendentes são removidas. As transações já concluídas permanecem no histórico.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma transação fixa encontrada.
                <br />
                Adicione transações fixas para gerenciar suas receitas e despesas mensais.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTransactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {transaction.description}
                      </h3>
                      <Badge variant={transaction.type === "income" ? "default" : "destructive"}>
                        {transaction.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>💰 {formatCurrency(Number(transaction.amount))}</span>
                      {transaction.category && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: transaction.category.color }}
                          />
                          {transaction.category.name}
                        </span>
                      )}
                      {transaction.account && (
                        <span>🏦 {transaction.account.name}</span>
                      )}
                      <span>📅 Todo dia {new Date(transaction.date).getDate()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleGenerateNext12Months(transaction.id)}
                      title="Gerar mais 12 meses"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setTransactionToEdit(transaction);
                        setEditModalOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setTransactionToDelete(transaction.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação fixa? 
              Esta ação irá excluir a transação principal e todas as transações pendentes geradas automaticamente.
              As transações já concluídas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFixedTransactionModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAddTransaction={handleAdd}
        accounts={accounts}
      />

      {transactionToEdit && (
        <EditFixedTransactionModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onEditTransaction={(transaction) => handleEdit(transaction)}
          transaction={transactionToEdit}
          accounts={accounts}
        />
      )}
    </div>
  );
}
