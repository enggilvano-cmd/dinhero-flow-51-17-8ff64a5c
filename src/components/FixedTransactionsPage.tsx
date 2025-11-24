import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, TrendingUp, TrendingDown, Calendar, Search, CalendarPlus } from "lucide-react";
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
import { FixedTransactionScopeDialog, FixedScope } from "./FixedTransactionScopeDialog";
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
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<FixedTransaction | null>(null);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<"edit" | "delete">("edit");
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasCompletedTransactions, setHasCompletedTransactions] = useState(false);
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
        .is("parent_transaction_id", null)
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

      // Usar edge function atômica para garantir integridade dos dados
      const { data, error } = await supabase.functions.invoke('atomic-create-fixed', {
        body: {
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date,
          type: transaction.type,
          category_id: transaction.category_id,
          account_id: transaction.account_id,
          status: transaction.status || "pending",
        },
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.error_message || 'Erro ao criar transação fixa');
      }

      toast({
        title: "Transação fixa adicionada",
        description: `${result.created_count} transações foram geradas com sucesso`,
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
        description: error instanceof Error ? error.message : "Não foi possível adicionar a transação fixa.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = async (transaction: FixedTransaction) => {
    setTransactionToEdit(transaction);
    
    // Buscar informações sobre transações geradas
    try {
      const { data: childTransactions } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("parent_transaction_id", transaction.id);

      const pendingCount = childTransactions?.filter(t => t.status === "pending").length || 0;
      const hasCompleted = childTransactions?.some(t => t.status === "completed") || false;

      setPendingTransactionsCount(pendingCount);
      setHasCompletedTransactions(hasCompleted);
      setScopeMode("edit");
      setScopeDialogOpen(true);
    } catch (error) {
      logger.error("Error fetching child transactions:", error);
      // Se houver erro, abre o dialog sem informações de contagem
      setPendingTransactionsCount(0);
      setHasCompletedTransactions(false);
      setScopeMode("edit");
      setScopeDialogOpen(true);
    }
  };

  const handleScopeSelectedForEdit = async (scope: FixedScope) => {
    if (!transactionToEdit) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates = {
        description: transactionToEdit.description,
        amount: transactionToEdit.amount,
        type: transactionToEdit.type,
        category_id: transactionToEdit.category_id,
        account_id: transactionToEdit.account_id,
        date: transactionToEdit.date,
      };

      if (scope === "current") {
        // Editar apenas a transação principal
        const { error } = await supabase
          .from("transactions")
          .update(updates)
          .eq("id", transactionToEdit.id)
          .eq("user_id", user.id);
        if (error) throw error;

        toast({
          title: "Transação atualizada",
          description: "A transação principal foi atualizada com sucesso.",
        });
      } else if (scope === "current-and-remaining") {
        // Editar a transação principal
        const { error: mainError } = await supabase
          .from("transactions")
          .update(updates)
          .eq("id", transactionToEdit.id)
          .eq("user_id", user.id);
        if (mainError) throw mainError;

        // Editar todas as transações pendentes geradas
        const { error: childrenError, data: updatedChildren } = await supabase
          .from("transactions")
          .update(updates)
          .eq("parent_transaction_id", transactionToEdit.id)
          .eq("status", "pending")
          .eq("user_id", user.id)
          .select();
        if (childrenError) throw childrenError;

        logger.info(`Updated ${updatedChildren?.length || 0} pending child transactions`);

        toast({
          title: "Transações atualizadas",
          description: `A transação principal e ${updatedChildren?.length || 0} transação(ões) pendente(s) foram atualizadas.`,
        });
      } else if (scope === "all") {
        // Editar a transação principal
        const { error: mainError } = await supabase
          .from("transactions")
          .update(updates)
          .eq("id", transactionToEdit.id)
          .eq("user_id", user.id);
        if (mainError) throw mainError;

        // Editar TODAS as transações geradas (pendentes e concluídas)
        const { error: childrenError, data: updatedChildren } = await supabase
          .from("transactions")
          .update(updates)
          .eq("parent_transaction_id", transactionToEdit.id)
          .eq("user_id", user.id)
          .select();
        if (childrenError) throw childrenError;

        logger.info(`Updated ${updatedChildren?.length || 0} child transactions`);

        toast({
          title: "Transações atualizadas",
          description: `A transação principal e ${updatedChildren?.length || 0} transação(ões) geradas foram atualizadas.`,
        });
      }

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

  const handleDeleteClick = async (transactionId: string) => {
    setTransactionToDelete(transactionId);
    
    // Buscar informações sobre transações geradas
    try {
      const { data: childTransactions } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("parent_transaction_id", transactionId);

      const pendingCount = childTransactions?.filter(t => t.status === "pending").length || 0;
      const hasCompleted = childTransactions?.some(t => t.status === "completed") || false;

      setPendingTransactionsCount(pendingCount);
      setHasCompletedTransactions(hasCompleted);
      setScopeMode("delete");
      setScopeDialogOpen(true);
    } catch (error) {
      logger.error("Error fetching child transactions:", error);
      // Se houver erro, abre o dialog sem informações de contagem
      setPendingTransactionsCount(0);
      setHasCompletedTransactions(false);
      setScopeMode("delete");
      setScopeDialogOpen(true);
    }
  };

  const handleScopeSelectedForDelete = async (scope: FixedScope) => {
    if (!transactionToDelete) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (scope === "current") {
        // Deletar apenas a transação principal
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", transactionToDelete)
          .eq("user_id", user.id);
        if (error) throw error;

        toast({
          title: "Transação removida",
          description: "A transação principal foi removida com sucesso.",
        });
      } else if (scope === "current-and-remaining") {
        // Primeiro, deletar todas as transações PENDENTES filhas
        const { error: childrenError, data: deletedChildren } = await supabase
          .from("transactions")
          .delete()
          .eq("parent_transaction_id", transactionToDelete)
          .eq("status", "pending")
          .eq("user_id", user.id)
          .select();
        
        if (childrenError) {
          logger.error("Error deleting children:", childrenError);
          throw childrenError;
        }

        logger.info(`Deleted ${deletedChildren?.length || 0} pending child transactions`);

        // Depois, deletar a transação principal
        const { error: mainError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", transactionToDelete)
          .eq("user_id", user.id);
        
        if (mainError) {
          logger.error("Error deleting main transaction:", mainError);
          throw mainError;
        }

        toast({
          title: "Transações removidas",
          description: `A transação principal e ${deletedChildren?.length || 0} transação(ões) pendente(s) foram removidas.`,
        });
      } else if (scope === "all") {
        // Primeiro, deletar TODAS as transações filhas (pendentes E concluídas)
        const { error: childrenError, data: deletedChildren } = await supabase
          .from("transactions")
          .delete()
          .eq("parent_transaction_id", transactionToDelete)
          .eq("user_id", user.id)
          .select();
        
        if (childrenError) {
          logger.error("Error deleting all children:", childrenError);
          throw childrenError;
        }

        logger.info(`Deleted ${deletedChildren?.length || 0} child transactions`);

        // Depois, deletar a transação principal
        const { error: mainError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", transactionToDelete)
          .eq("user_id", user.id);
        
        if (mainError) {
          logger.error("Error deleting main transaction:", mainError);
          throw mainError;
        }

        toast({
          title: "Transações removidas",
          description: `A transação principal e ${deletedChildren?.length || 0} transação(ões) geradas foram removidas.`,
        });
      }

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
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-caption font-medium">Total de Fixas</p>
                <div className="balance-text">{stats.totalFixed}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-caption font-medium">Receitas Mensais</p>
                <div className="balance-text balance-positive">
                  {formatCurrency(stats.monthlyIncome)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-caption font-medium">Despesas Mensais</p>
                <div className="balance-text balance-negative">
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
              <Select value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)}>
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
                      <h3 className="text-headline font-semibold">
                        {transaction.description}
                      </h3>
                      <Badge variant={transaction.type === "income" ? "default" : "destructive"}>
                        {transaction.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-body text-muted-foreground">
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
                      onClick={() => handleEditClick(transaction)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteClick(transaction.id)}
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

      <FixedTransactionScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        onScopeSelected={scopeMode === "edit" ? handleScopeSelectedForEdit : handleScopeSelectedForDelete}
        mode={scopeMode}
        hasCompleted={hasCompletedTransactions}
        pendingCount={pendingTransactionsCount}
      />

      <AddFixedTransactionModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAddTransaction={handleAdd}
        accounts={accounts}
      />

      {transactionToEdit && (
        <EditFixedTransactionModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setTransactionToEdit(null);
          }}
          onEditTransaction={(transaction) => {
            setTransactionToEdit(transaction);
            setEditModalOpen(false);
            // Reabrir o scope dialog para o usuário escolher o escopo
            setPendingTransactionsCount(0);
            setHasCompletedTransactions(false);
            setScopeMode("edit");
            setScopeDialogOpen(true);
          }}
          transaction={transactionToEdit}
          accounts={accounts}
        />
      )}
    </div>
  );
}
