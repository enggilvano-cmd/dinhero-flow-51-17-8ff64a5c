import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { useTranslation } from "react-i18next";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category_id: string | null;
  account_id: string;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_end_date: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface EditRecurringTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: RecurringTransaction) => void;
  transaction: RecurringTransaction | null;
  accounts: Account[];
}

export function EditRecurringTransactionModal({
  open,
  onOpenChange,
  onEditTransaction,
  transaction,
  accounts
}: EditRecurringTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amountInCents: 0,
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    recurrence_type: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    recurrence_end_date: null as Date | null,
  });
  const { toast } = useToast();
  const { categories } = useCategories();
  const { t } = useTranslation();

  useEffect(() => {
    if (open && transaction) {
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      setFormData({
        description: transaction.description,
        amountInCents: Math.abs(transaction.amount),
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id || "",
        account_id: transaction.account_id,
        recurrence_type: transaction.recurrence_type || "monthly",
        recurrence_end_date: transaction.recurrence_end_date ? new Date(transaction.recurrence_end_date) : null,
      });
    }
  }, [open, transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    if (!formData.description.trim() || formData.amountInCents <= 0 || !formData.account_id) {
      toast({
        title: t("common.error"),
        description: t("modals.editRecurringTransaction.errors.required"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        title: t("common.error"),
        description: t("modals.editRecurringTransaction.errors.categoryRequired"),
        variant: "destructive",
      });
      return;
    }

    const finalAmount = formData.type === 'income' 
      ? formData.amountInCents 
      : -Math.abs(formData.amountInCents);

    const updatedTransaction: RecurringTransaction = {
      id: transaction.id,
      description: formData.description.trim(),
      amount: finalAmount,
      type: formData.type,
      category_id: formData.category_id,
      account_id: formData.account_id,
      recurrence_type: formData.recurrence_type,
      recurrence_end_date: formData.recurrence_end_date ? format(formData.recurrence_end_date, 'yyyy-MM-dd') : null,
    };

    onEditTransaction(updatedTransaction);
    
    toast({
      title: t("common.success"),
      description: t("modals.editRecurringTransaction.success"),
    });

    onOpenChange(false);
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("modals.editRecurringTransaction.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.editRecurringTransaction.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t("modals.editRecurringTransaction.fields.description.label")}</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("modals.editRecurringTransaction.fields.description.placeholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t("modals.editRecurringTransaction.fields.amount.label")}</Label>
            <CurrencyInput
              id="amount"
              value={formData.amountInCents}
              onValueChange={(value) => setFormData({ ...formData, amountInCents: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t("modals.editRecurringTransaction.fields.type.label")}</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "income" | "expense") => 
                setFormData({ ...formData, type: value, category_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editRecurringTransaction.fields.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("transactions.income")}</SelectItem>
                <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("modals.editRecurringTransaction.fields.category.label")}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editRecurringTransaction.fields.category.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">{t("modals.editRecurringTransaction.fields.account.label")}</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editRecurringTransaction.fields.account.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: account.color || "#6b7280" }}
                      />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_type">{t("modals.editRecurringTransaction.fields.frequency.label")}</Label>
            <Select
              value={formData.recurrence_type}
              onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") => 
                setFormData({ ...formData, recurrence_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("recurringTransactions.frequency.daily")}</SelectItem>
                <SelectItem value="weekly">{t("recurringTransactions.frequency.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("recurringTransactions.frequency.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("recurringTransactions.frequency.yearly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_end_date">
              {t("modals.editRecurringTransaction.fields.endDate.label")}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.recurrence_end_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.recurrence_end_date ? (
                    format(formData.recurrence_end_date, "PPP", { locale: ptBR })
                  ) : (
                    <span>{t("modals.editRecurringTransaction.fields.endDate.placeholder")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.recurrence_end_date || undefined}
                  onSelect={(date) => setFormData({ ...formData, recurrence_end_date: date || null })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {t("modals.editRecurringTransaction.fields.endDate.help")}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("modals.editRecurringTransaction.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
