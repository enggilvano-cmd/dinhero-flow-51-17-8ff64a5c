import { useState, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PREDEFINED_COLORS, ACCOUNT_TYPE_LABELS } from "@/types";
import { ColorPicker } from "./forms/ColorPicker";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { useAccountStore } from "@/stores/AccountStore";
import { useTranslation } from "react-i18next";

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "" as "checking" | "savings" | "credit" | "investment" | "",
    balanceInCents: 0,
    limitInCents: 0,
    dueDate: "",
    closingDate: "",
    color: PREDEFINED_COLORS[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { addAccount } = useAccountStore();
  const { t } = useTranslation();

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      toast({
        title: t("common.error"),
        description: t("modals.addAccount.errors.required"),
        variant: "destructive",
      });
      return;
    }

    // --- CORREÇÃO: Validação de Cartão de Crédito ---
    if (formData.type === "credit") {
      if (formData.limitInCents <= 0) {
        toast({
          title: t("common.error"),
          description: t("modals.addAccount.errors.limitRequired"),
          variant: "destructive",
        });
        return;
      }
      if (!formData.closingDate) {
        toast({
          title: t("common.error"),
          description: t("modals.addAccount.errors.closingDateRequired"),
          variant: "destructive",
        });
        return;
      }
      if (!formData.dueDate) {
        toast({
          title: t("common.error"),
          description: t("modals.addAccount.errors.dueDateRequired"),
          variant: "destructive",
        });
        return;
      }
    }
    // --- Fim da Correção ---

    // Se for cartão de crédito, sempre armazene o saldo como negativo (dívida).
    const balanceInCents =
      formData.type === "credit"
        ? -Math.abs(formData.balanceInCents)
        : formData.balanceInCents;

    const limitInCents =
      formData.limitInCents > 0 ? formData.limitInCents : undefined;

    let dueDate: number | undefined;
    if (formData.type === "credit") { // Validação de data (só se for crédito)
      dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        toast({
          title: t("common.error"),
          description: t("modals.addAccount.errors.invalidDueDate"),
          variant: "destructive",
        });
        return;
      }
    }

    let closingDate: number | undefined;
    if (formData.type === "credit") { // Validação de data (só se for crédito)
      closingDate = parseInt(formData.closingDate);
      if (isNaN(closingDate) || closingDate < 1 || closingDate > 31) {
        toast({
          title: t("common.error"),
          description: t("modals.addAccount.errors.invalidClosingDate"),
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await addAccount({
        name: formData.name,
        type: formData.type,
        balance: balanceInCents,
        limit_amount: limitInCents,
        due_date: dueDate,
        closing_date: closingDate,
        color: formData.color,
      });

      toast({
        title: t("common.success"),
        description: t("modals.addAccount.success"),
        variant: "default",
      });

      // Reset form
      setFormData({
        name: "",
        type: "" as "checking" | "savings" | "credit" | "investment" | "",
        balanceInCents: 0,
        limitInCents: 0,
        dueDate: "",
        closingDate: "",
        color: PREDEFINED_COLORS[0],
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add account:", error);
      toast({
        title: t("modals.addAccount.errors.serverError"),
        description: t("modals.addAccount.errors.serverErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg sm:text-xl">
            {t("modals.addAccount.title")}
          </DialogTitle>
          <DialogDescription>
            {t("modals.addAccount.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Nome da Conta */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              {t("modals.addAccount.fields.name.label")}
            </Label>
            <Input
              id="name"
              placeholder={t("modals.addAccount.fields.name.placeholder")}
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="h-10 sm:h-11"
            />
          </div>

          {/* Tipo de Conta */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">
              {t("modals.addAccount.fields.type.label")}
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value as any }))
              }
            >
              <SelectTrigger className="h-10 sm:h-11">
                <SelectValue placeholder={t("modals.addAccount.fields.type.placeholder")} />
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

          {/* Saldo/Valor */}
          <div className="space-y-2">
            <Label htmlFor="balance" className="text-sm font-medium">
              {formData.type === "credit"
                ? t("modals.addAccount.fields.balance.debtLabel")
                : formData.type === "investment"
                ? t("modals.addAccount.fields.balance.investmentLabel")
                : t("modals.addAccount.fields.balance.label")}
            </Label>
            <CurrencyInput
              value={formData.balanceInCents}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, balanceInCents: value }))
              }
              allowNegative={formData.type !== "credit"}
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formData.type === "credit"
                ? t("modals.addAccount.fields.balance.debtHelp")
                : formData.type === "investment"
                ? t("modals.addAccount.fields.balance.investmentHelp")
                : t("modals.addAccount.fields.balance.help")}
            </p>
          </div>

          {/* Limite da Conta */}
          <div className="space-y-2">
            {/* --- CORREÇÃO: Rótulo dinâmico --- */}
            <Label className="text-sm font-medium">
              {t("modals.addAccount.fields.limit.label")}{" "}
              {formData.type !== "credit" && `(${t("modals.addAccount.fields.limit.optional")})`}
            </Label>
            <CurrencyInput
              value={formData.limitInCents || 0}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, limitInCents: value || 0 }))
              }
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formData.type === "credit"
                ? t("modals.addAccount.fields.limit.creditHelp")
                : t("modals.addAccount.fields.limit.help")}
            </p>
          </div>

          {/* Campos específicos para Cartão de Crédito */}
          {formData.type === "credit" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                {/* --- CORREÇÃO: Rótulo removido (opcional) --- */}
                <Label htmlFor="closingDate" className="text-sm font-medium">
                  {t("modals.addAccount.fields.closingDate.label")}
                </Label>
                <Input
                  id="closingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder={t("modals.addAccount.fields.closingDate.placeholder")}
                  value={formData.closingDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      closingDate: e.target.value,
                    }))
                  }
                  className="h-10 sm:h-11"
                />
                <p className="text-xs text-muted-foreground">
                  {t("modals.addAccount.fields.closingDate.help")}
                </p>
              </div>

              <div className="space-y-2">
                {/* --- CORREÇÃO: Rótulo removido (opcional) --- */}
                <Label htmlFor="dueDate" className="text-sm font-medium">
                  {t("modals.addAccount.fields.dueDate.label")}
                </Label>
                <Input
                  id="dueDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder={t("modals.addAccount.fields.dueDate.placeholder")}
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dueDate: e.target.value,
                    }))
                  }
                  className="h-10 sm:h-11"
                />
                <p className="text-xs text-muted-foreground">
                  {t("modals.addAccount.fields.dueDate.help")}
                </p>
              </div>
            </div>
          )}

          {/* Seleção de Cor */}
          <ColorPicker
            value={formData.color}
            onChange={handleColorChange}
            label={t("modals.addAccount.fields.color.label")}
          />

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 sm:h-11"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 sm:h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("modals.addAccount.actions.adding") : t("modals.addAccount.actions.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}