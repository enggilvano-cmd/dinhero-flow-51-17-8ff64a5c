import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Repeat, Pencil, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/context/SettingsContext";
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
  date: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const { toast } = useToast();
  const { t } = useTranslation();
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
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 w-full">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{t("recurringTransactions.title")}</h1>
          <p className="text-sm text-muted-foreground leading-tight">{t("recurringTransactions.subtitle")}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t("recurringTransactions.totalRecurring")}
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold leading-tight">
                  {stats.total}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t("recurringTransactions.monthlyIncome")}
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-positive leading-tight">
                  {formatCents(stats.monthlyIncome)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t("recurringTransactions.monthlyExpenses")}
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-negative leading-tight">
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
              <Label htmlFor="search" className="text-caption">{t('common.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t("recurringTransactions.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter" className="text-caption">{t("recurringTransactions.filterByType")}</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger id="filter" className="touch-target mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="income">{t('transactions.income')}</SelectItem>
                  <SelectItem value="expense">{t('transactions.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{t("recurringTransactions.autoGeneration")}</CardTitle>
              <CardDescription className="mt-1">
                {t("recurringTransactions.autoGenerationEnabled")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                ? t("common.noResults")
                : t("recurringTransactions.noTransactions")}
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
