import { useState, useEffect, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Account, PREDEFINED_COLORS, ACCOUNT_TYPE_LABELS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";
import { useAccountStore } from "@/stores/AccountStore";
import { useTranslation } from "react-i18next";

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditAccount: (account: Account) => Promise<void>;
  account: Account | null;
}

export function EditAccountModal({
  open,
  onOpenChange,
  onEditAccount,
  account,
}: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "" as "checking" | "savings" | "credit" | "investment" | "",
    balanceInCents: 0,
    limitInCents: 0,
    dueDate: "",
    closingDate: "",
    color: PREDEFINED_COLORS[0],
  });
  
  // Estado removido - saldo negativo será gerenciado pelas transações
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const updateAccounts = useAccountStore((state) => state.updateAccounts);
  const { t } = useTranslation();

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
      // Carrega o saldo mantendo o sinal (positivo ou negativo)
      balanceInCents: account.balance, 
      limitInCents: account.limit_amount || 0,
      dueDate: account.due_date?.toString() || "",
      closingDate: account.closing_date?.toString() || "",
      color: account.color || PREDEFINED_COLORS[0],
    });
    }
  }, [account]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!account) return;

    if (!formData.name.trim() || !formData.type) {
      toast({
        title: t("common.error"),
        description: t("modals.editAccount.errors.required"),
        variant: "destructive",
      });
      return;
    }

    // Lógica de salvamento simplificada
    let balanceInCents: number;
    
    if (formData.type === 'credit') {
      // Cartão de crédito sempre salva como dívida (negativo)
      balanceInCents = -Math.abs(formData.balanceInCents);
    } else {
      // Mantém o saldo como foi inserido pelo usuário
      balanceInCents = formData.balanceInCents;
    }


    const limitInCents =
      formData.limitInCents > 0 ? formData.limitInCents : undefined;

    let dueDate: number | undefined;
    if (formData.type === "credit" && formData.dueDate) {
      dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        toast({
          title: t("common.error"),
          description: t("modals.editAccount.errors.invalidDueDate"),
          variant: "destructive",
        });
        return;
      }
    }

    let closingDate: number | undefined;
    if (formData.type === "credit" && formData.closingDate) {
      closingDate = parseInt(formData.closingDate);
      if (isNaN(closingDate) || closingDate < 1 || closingDate > 31) {
        toast({
          title: t("common.error"),
          description: t("modals.editAccount.errors.invalidClosingDate"),
          variant: "destructive",
        });
        return;
      }
    }

    const updatedAccount = {
      id: account.id,
      user_id: account.user_id,
      name: formData.name.trim(),
      type: formData.type,
      balance: balanceInCents, // Usa o saldo com sinal corrigido
      limit_amount: limitInCents,
      due_date: dueDate,
      closing_date: closingDate,
      color: formData.color,
    };

    setIsSubmitting(true);
    try {
      await onEditAccount(updatedAccount);

      // Atualiza a conta no store global
      updateAccounts(updatedAccount);

      toast({
        title: t("common.success"),
        description: t("modals.editAccount.success"),
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to edit account:", error);
      // O toast de erro deve ser tratado dentro do onEditAccount ou aqui
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-financial-h3">{t("modals.editAccount.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.editAccount.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-financial-secondary font-medium"
            >
              {t("modals.editAccount.fields.name.label")}
            </Label>
            <Input
              id="name"
              placeholder={t("modals.editAccount.fields.name.placeholder")}
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="text-financial-input"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="type"
              className="text-financial-secondary font-medium"
            >
              {t("modals.editAccount.fields.type.label")}
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, type: value as any }));
              }}
            >
              <SelectTrigger className="text-financial-input">
                <SelectValue placeholder={t("modals.editAccount.fields.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">
                  {ACCOUNT_TYPE_LABELS.checking}
                </SelectItem>
                <SelectItem value="savings">
                  {ACCOUNT_TYPE_LABELS.savings}
                </SelectItem>
                <SelectItem value="credit">
                  {ACCOUNT_TYPE_LABELS.credit}
                </SelectItem>
                <SelectItem value="investment">
                  {ACCOUNT_TYPE_LABELS.investment}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="balance"
              className="text-financial-secondary font-medium"
            >
              {formData.type === "credit"
                ? t("modals.editAccount.fields.balance.debtLabel")
                : formData.type === "investment"
                ? t("modals.editAccount.fields.balance.investmentLabel")
                : t("modals.editAccount.fields.balance.label")}
            </Label>
            <CurrencyInput
              value={formData.balanceInCents}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, balanceInCents: value || 0 }))
              }
            />

            <p className="text-financial-caption">
              {formData.type === "credit"
                ? t("modals.editAccount.fields.balance.debtHelp")
                : formData.type === "investment"
                ? t("modals.editAccount.fields.balance.investmentHelp")
                : t("modals.editAccount.fields.balance.help")}
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="limit"
              className="text-financial-secondary font-medium"
            >
              {t("modals.editAccount.fields.limit.label")}
            </Label>
            <CurrencyInput
              value={formData.limitInCents}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, limitInCents: value || 0 }))
              }
            />
            <p className="text-financial-caption">
              {t("modals.editAccount.fields.limit.help")}
            </p>
          </div>

          {formData.type === "credit" && (
            <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 bg-muted/50 rounded-lg border-l-4 border-primary/30">
              <h4 className="text-financial-body font-medium text-primary">
                {t("modals.editAccount.fields.creditSettings")}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="closingDate"
                    className="text-financial-secondary font-medium"
                  >
                    {t("modals.editAccount.fields.closingDate.label")}
                  </Label>
                  <Input
                    id="closingDate"
                    type="number"
                    min="1"
                    max="31"
                    placeholder={t("modals.editAccount.fields.closingDate.placeholder")}
                    value={formData.closingDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        closingDate: e.target.value,
                      }))
                    }
                    className="text-financial-input"
                  />
                  <p className="text-financial-caption">{t("modals.editAccount.fields.closingDate.help")}</p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="dueDate"
                    className="text-financial-secondary font-medium"
                  >
                    {t("modals.editAccount.fields.dueDate.label")}
                  </Label>
                  <Input
                    id="dueDate"
                    type="number"
                    min="1"
                    max="31"
                    placeholder={t("modals.editAccount.fields.dueDate.placeholder")}
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                    className="text-financial-input"
                  />
                  <p className="text-financial-caption">{t("modals.editAccount.fields.dueDate.help")}</p>
                </div>
              </div>
            </div>
          )}

          <ColorPicker value={formData.color} onChange={handleColorChange} />

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 text-financial-button touch-target"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1 text-financial-button bg-primary hover:bg-primary/90 text-primary-foreground touch-target"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("modals.editAccount.actions.saving") : t("modals.editAccount.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}