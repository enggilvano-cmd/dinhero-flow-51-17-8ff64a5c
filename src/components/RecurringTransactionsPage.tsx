import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Repeat, Pencil, Trash2, Calendar, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
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
import { EditRecurringTransactionModal } from "./EditRecurringTransactionModal";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category_id: string | null;
  account_id: string;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_end_date: string | null;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
}

export function RecurringTransactionsPage() {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<RecurringTransaction | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

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
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
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
      console.error('Error loading recurring transactions:', error);
      toast({
        title: t("common.error"),
        description: t("recurringTransactions.errors.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (updatedTransaction: RecurringTransaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          description: updatedTransaction.description,
          amount: updatedTransaction.amount,
          type: updatedTransaction.type,
          category_id: updatedTransaction.category_id,
          account_id: updatedTransaction.account_id,
          recurrence_type: updatedTransaction.recurrence_type,
          recurrence_end_date: updatedTransaction.recurrence_end_date,
        })
        .eq('id', updatedTransaction.id);

      if (error) throw error;

      setTransactions(prev => prev.map(t => 
        t.id === updatedTransaction.id ? { ...t, ...updatedTransaction } : t
      ));
      
      loadRecurringTransactions();
    } catch (error) {
      console.error('Error updating recurring transaction:', error);
      toast({
        title: t("common.error"),
        description: t("recurringTransactions.errors.updateFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("recurringTransactions.deleteSuccess"),
      });

      setTransactions(prev => prev.filter(t => t.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      toast({
        title: t("common.error"),
        description: t("recurringTransactions.errors.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const getRecurrenceLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily: t("recurringTransactions.frequency.daily"),
      weekly: t("recurringTransactions.frequency.weekly"),
      monthly: t("recurringTransactions.frequency.monthly"),
      yearly: t("recurringTransactions.frequency.yearly"),
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("recurringTransactions.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("recurringTransactions.subtitle")}</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {t("recurringTransactions.noTransactions")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {transaction.description}
                      <Badge variant={transaction.type === "income" ? "default" : "secondary"}>
                        {transaction.type === "income" ? t("transactions.income") : t("transactions.expense")}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Repeat className="h-3 w-3" />
                      {transaction.recurrence_type ? getRecurrenceLabel(transaction.recurrence_type) : '-'}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 text-sm">
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
                        {t("recurringTransactions.endsOn")}: {format(new Date(transaction.recurrence_end_date), "dd/MM/yyyy", { locale: ptBR })}
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
                      onClick={() => setDeleteId(transaction.id)}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recurringTransactions.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("recurringTransactions.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
