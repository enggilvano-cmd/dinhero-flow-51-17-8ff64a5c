import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Input é usado para Descrição
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Transaction, Account } from "@/types";
import { useCategories } from "@/hooks/useCategories";
import { createDateFromString } from "@/lib/dateUtils";
import { InstallmentEditScopeDialog, EditScope } from "./InstallmentEditScopeDialog";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { useTranslation } from "react-i18next";

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: Transaction, editScope?: EditScope) => void;
  transaction: Transaction | null;
  accounts: Account[];
}

export function EditTransactionModal({
  open,
  onOpenChange,
  onEditTransaction,
  transaction,
  accounts
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amountInCents: 0, // Usar 'amountInCents' como número
    date: new Date(),
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed",
    invoiceMonth: "", // Mês da fatura (YYYY-MM)
  });
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();
  const { t } = useTranslation();

  useEffect(() => {
    if (open && transaction) {
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      setFormData({
        description: transaction.description || "",
        amountInCents: Math.abs(transaction.amount),
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id || "",
        account_id: transaction.account_id || "",
        status: transaction.status || "completed",
        invoiceMonth: transaction.invoice_month_overridden ? (transaction.invoice_month || "") : "",
      });
    }
  }, [open, transaction, accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    if (!formData.description.trim() || formData.amountInCents <= 0 || !formData.account_id) {
      toast({
        title: t("common.error"),
        description: t("modals.editTransaction.errors.required"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        title: t("common.error"),
        description: t("modals.editTransaction.errors.categoryRequired"),
        variant: "destructive",
      });
      return;
    }

    const isInstallment = Boolean(transaction.parent_transaction_id || (transaction.installments && transaction.installments > 1));
    
    if (isInstallment) {
      setScopeDialogOpen(true);
      return;
    }

    processEdit("current");
  };

  const processEdit = (editScope: EditScope) => {
    if (!transaction) return;

    // =================================================================
    // LÓGICA DE SALVAMENTO (Correta):
    // Na hora de salvar, aplicamos o negativo de volta se for 'expense'
    // =================================================================
    const finalAmount = formData.type === 'income' 
      ? formData.amountInCents 
      : -Math.abs(formData.amountInCents);

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description.trim(),
      amount: finalAmount, // Salva o valor com o sinal correto
      date: formData.date,
      type: formData.type,
      category_id: formData.category_id,
      account_id: formData.account_id,
      status: formData.status,
      invoice_month: formData.invoiceMonth || undefined,
      invoice_month_overridden: Boolean(formData.invoiceMonth),
      is_recurring: transaction.is_recurring,
      recurrence_type: transaction.recurrence_type,
      recurrence_end_date: transaction.recurrence_end_date,
    };

    onEditTransaction(updatedTransaction, editScope);
    
    const scopeDescription = editScope === "current" ? t("modals.editTransaction.success.current") : 
                             editScope === "all" ? t("modals.editTransaction.success.all") :
                             t("modals.editTransaction.success.selected");
    
    toast({
      title: t("modals.editTransaction.success.title"),
      description: scopeDescription,
    });

    onOpenChange(false);
    setScopeDialogOpen(false);
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = Boolean(transaction?.parent_transaction_id || (transaction?.installments && transaction.installments > 1));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {t("modals.editTransaction.title")}
              {isInstallment && (
                <span className="text-sm font-normal text-muted-foreground block">
                  {t("modals.editTransaction.installmentInfo", { 
                    current: transaction?.current_installment, 
                    total: transaction?.installments 
                  })}
                </span>
              )}
              <DialogDescription>
                {t("modals.editTransaction.subtitle")}
              </DialogDescription>
            </DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t("modals.editTransaction.fields.description.label")}</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("modals.editTransaction.fields.description.placeholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t("modals.editTransaction.fields.amount.label")}</Label>
            {/* USO CORRETO DO CURRENCY INPUT:
              Ele lida com a formatação e garante que 'amountInCents'
              seja sempre um número positivo.
            */}
            <CurrencyInput
              id="amount"
              value={formData.amountInCents}
              onValueChange={(value) => setFormData({ ...formData, amountInCents: value })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("modals.editTransaction.fields.date.label")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? (
                    format(formData.date, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>{t("modals.editTransaction.fields.date.placeholder")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData({ ...formData, date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t("modals.editTransaction.fields.type.label")}</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "income" | "expense") => 
                setFormData({ ...formData, type: value, category_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editTransaction.fields.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("transactions.income")}</SelectItem>
                <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("modals.editTransaction.fields.category.label")}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editTransaction.fields.category.placeholder")} />
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
            <Label htmlFor="account">{t("modals.editTransaction.fields.account.label")}</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editTransaction.fields.account.placeholder")} />
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
            <Label htmlFor="status">{t("modals.editTransaction.fields.status.label")}</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "pending" | "completed") => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editTransaction.fields.status.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t("transactions.pending")}</SelectItem>
                <SelectItem value="completed">{t("transactions.completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Month Selection for Credit Cards */}
          {formData.account_id && 
           accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="invoiceMonth">{t("modals.editTransaction.fields.invoiceMonth.label")}</Label>
              <Select
                value={formData.invoiceMonth}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceMonth: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.editTransaction.fields.invoiceMonth.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const months = [];
                    const today = new Date();
                    for (let i = -2; i <= 12; i++) {
                      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      months.push(
                        <SelectItem key={value} value={value}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    }
                    return months;
                  })()}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("modals.editTransaction.fields.invoiceMonth.help")}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("modals.editTransaction.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <InstallmentEditScopeDialog
      open={scopeDialogOpen}
      onOpenChange={setScopeDialogOpen}
      onScopeSelected={processEdit}
      currentInstallment={transaction?.current_installment || 1}
      totalInstallments={transaction?.installments || 1}
    />
  </>
  );
}