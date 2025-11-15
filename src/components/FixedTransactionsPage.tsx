import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, TrendingUp, TrendingDown, Calendar } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { AddFixedTransactionModal } from "./AddFixedTransactionModal";
import { EditFixedTransactionModal } from "./EditFixedTransactionModal";
import { Skeleton } from "@/components/ui/skeleton";

interface FixedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string;
  is_recurring: boolean;
  recurrence_type: "monthly";
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
          is_recurring,
          recurrence_type,
          category:categories(name, color),
          account:accounts!transactions_account_id_fkey(name)
        `)
        .eq("user_id", user.id)
        .eq("is_recurring", true)
        .eq("recurrence_type", "monthly")
        .is("recurrence_end_date", null)
        .neq("type", "transfer")
        .order("date", { ascending: false });

      if (error) throw error;
      setTransactions(data as FixedTransaction[]);
    } catch (error) {
      console.error("Error loading fixed transactions:", error);
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
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const handleAdd = async (transaction: Omit<FixedTransaction, "id">) => {
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
        
        // A primeira transação é a principal com is_recurring = true
        if (i === 0) {
          transactionsToGenerate.push({
            description: transaction.description,
            amount: transaction.amount,
            date: transactionDate,
            type: transaction.type,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            status: transactionDate <= today ? "completed" as const : "pending" as const,
            user_id: user.id,
            is_recurring: true,
            recurrence_type: "monthly" as const,
            recurrence_end_date: null,
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
          console.error("Erro ao vincular transações filhas:", updateError);
        }
      }

      const nextYearCalc = currentYear + 1;
      toast({
        title: "Transação fixa adicionada",
        description: `${transactionsToGenerate.length} transações foram geradas (até o final de ${nextYearCalc})`,
      });

      loadFixedTransactions();
      setAddModalOpen(false);
    } catch (error) {
      console.error("Error adding fixed transaction:", error);
      toast({
        title: "Erro ao adicionar transação",
        description: "Não foi possível adicionar a transação fixa.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (transaction: FixedTransaction) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          category_id: transaction.category_id,
          account_id: transaction.account_id,
          date: transaction.date,
        })
        .eq("id", transaction.id);

      if (error) throw error;

      toast({
        title: "Transação atualizada",
        description: "A transação fixa foi atualizada com sucesso.",
      });

      loadFixedTransactions();
      setEditModalOpen(false);
    } catch (error) {
      console.error("Error updating transaction:", error);
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
      // Primeiro, excluir todas as transações filhas pendentes
      const { error: childrenError } = await supabase
        .from("transactions")
        .delete()
        .eq("parent_transaction_id", transactionToDelete)
        .eq("status", "pending");

      if (childrenError) throw childrenError;

      // Depois, excluir a transação principal
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionToDelete);

      if (error) throw error;

      toast({
        title: "Transação removida",
        description: "A transação fixa e todas as transações pendentes foram removidas com sucesso.",
      });

      loadFixedTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações Fixas</h1>
          <p className="text-muted-foreground">
            Gerencie suas receitas e despesas mensais fixas
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transação Fixa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fixas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFixed}</div>
            <p className="text-xs text-muted-foreground">
              Transações mensais recorrentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas Mensais</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.monthlyIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              Entrada fixa por mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Mensais</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.monthlyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Saída fixa por mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre suas transações fixas por descrição ou tipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <Input
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:w-1/2"
            />
            <div className="flex gap-2">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                onClick={() => setFilterType("all")}
              >
                Todas
              </Button>
              <Button
                variant={filterType === "income" ? "default" : "outline"}
                onClick={() => setFilterType("income")}
              >
                Receitas
              </Button>
              <Button
                variant={filterType === "expense" ? "default" : "outline"}
                onClick={() => setFilterType("expense")}
              >
                Despesas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
          <CardDescription>
            Como funcionam as transações fixas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • <strong>Geração Automática:</strong> As transações fixas são geradas automaticamente todo dia 1º do mês.
          </p>
          <p>
            • <strong>Sem Data de Término:</strong> Diferente das transações recorrentes, as fixas não têm data de término e continuam sendo geradas indefinidamente.
          </p>
          <p>
            • <strong>Edição:</strong> Ao editar uma transação fixa, você altera apenas o modelo. As transações já geradas não são modificadas.
          </p>
          <p>
            • <strong>Exclusão:</strong> Ao excluir uma transação fixa, você remove apenas o modelo. As transações já geradas permanecem no sistema.
          </p>
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
            Tem certeza que deseja excluir esta transação fixa? Todas as transações pendentes também serão removidas. Transações já concluídas permanecerão no sistema.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
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
          onEditTransaction={handleEdit}
          transaction={transactionToEdit}
          accounts={accounts}
        />
      )}
    </div>
  );
}
