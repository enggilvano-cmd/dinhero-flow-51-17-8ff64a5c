import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { CurrencyInput } from "./forms/CurrencyInput";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";
import { ArrowRight } from "lucide-react";
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccountStore } from "@/stores/AccountStore";
import { Account } from "@/types";
import { useTranslation } from "react-i18next";
import { logger } from "@/lib/logger";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (fromAccountId: string, toAccountId: string, amountInCents: number, date: Date) => Promise<{ fromAccount: Account, toAccount: Account }>;
}

export function TransferModal({ open, onOpenChange, onTransfer }: TransferModalProps) {
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amountInCents: 0,
    date: getTodayString()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const accounts = useAccountStore((state) => state.accounts);
  const { t } = useTranslation();

  // Contas de origem podem ser qualquer tipo, exceto crédito.
  const sourceAccounts = useMemo(() => accounts.filter(acc => acc.type !== "credit"), [accounts]);
  
  // Contas de destino também não podem ser de crédito para evitar ambiguidade com pagamento de fatura.
  const destinationAccounts = useMemo(() => 
    accounts.filter(acc => acc.type !== "credit" && acc.id !== formData.fromAccountId), 
    [accounts, formData.fromAccountId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fromAccountId || !formData.toAccountId || formData.amountInCents <= 0) {
      toast({
        title: t("common.error"),
        description: t("modals.transfer.errors.required"),
        variant: "destructive"
      });
      return;
    }

    if (formData.fromAccountId === formData.toAccountId) {
      toast({
        title: t("common.error"),
        description: t("modals.transfer.errors.sameAccount"),
        variant: "destructive"
      });
      return;
    }

    // Check if source account has sufficient balance or overdraft limit
    // Frontend validation for UX. The backend should always re-validate this rule
    // to ensure data integrity and prevent unauthorized transactions.
    const fromAccount = sourceAccounts.find(acc => acc.id === formData.fromAccountId);
    if (fromAccount) {
      const availableBalanceInCents = getAvailableBalance(fromAccount);
      if (availableBalanceInCents < formData.amountInCents) {
        const limitText = fromAccount.limit_amount 
          ? ` (${t("modals.transfer.errors.includingLimit")} ${formatCurrency(fromAccount.limit_amount)})`
          : '';
        toast({
          title: t("modals.transfer.errors.insufficientBalance"),
          description: `${t("modals.transfer.errors.account")} ${fromAccount.name} ${t("modals.transfer.errors.noBalance")}${limitText}.`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onTransfer(
        // Uma transferência deve ser tratada no backend como duas transações atômicas:
        // 1. Uma despesa na conta de origem (fromAccountId)
        // 2. Uma receita na conta de destino (toAccountId)
        // Esta chamada única assume que o backend abstrai essa complexidade.
        formData.fromAccountId,
        formData.toAccountId,
        formData.amountInCents,
        createDateFromString(formData.date)
      );

      toast({
        title: t("common.success"),
        description: t("modals.transfer.success"),
        variant: "default"
      });

      // Reset form
      setFormData({
        fromAccountId: "",
        toAccountId: "",
        amountInCents: 0,
        date: getTodayString()
      });

      onOpenChange(false);
    } catch (error) {
      // A função onTransfer deve lançar um erro em caso de falha para este bloco ser ativado.
      logger.error("Transfer failed:", error);
      toast({
        title: t("modals.transfer.errors.title"),
        description: t("modals.transfer.errors.failed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.transfer.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.transfer.subtitle")}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromAccount">{t("modals.transfer.fields.from.label")}</Label>
              <Select value={formData.fromAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, fromAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.transfer.fields.from.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: account.color || "#6b7280" }}
                          />
                          <span>{account.name}</span>
                        </div>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.fromAccountId && (
                <AccountBalanceDetails account={accounts.find(acc => acc.id === formData.fromAccountId)} />
              )}
            </div>

            <div className="flex justify-center">
              <div className="p-2 bg-muted rounded-full">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toAccount">{t("modals.transfer.fields.to.label")}</Label>
              <Select value={formData.toAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, toAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.transfer.fields.to.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: account.color || "#6b7280" }}
                            />
                            <span>{account.name}</span>
                          </div>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {formatCurrency(account.balance)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("modals.transfer.fields.amount.label")}</Label>
              <CurrencyInput
                id="amount"
                value={formData.amountInCents}
                onValueChange={(value) => setFormData(prev => ({ ...prev, amountInCents: value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t("modals.transfer.fields.date.label")}</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            {t("modals.transfer.help.credit")}
            <br />
            {t("modals.transfer.help.payBill")}
          </p>

          {sourceAccounts.length < 2 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>{t("common.attention")}:</strong> {t("modals.transfer.help.minAccounts")}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={sourceAccounts.length < 2 || isSubmitting}
            >
              {isSubmitting ? t("modals.transfer.actions.processing") : t("modals.transfer.actions.transfer")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}