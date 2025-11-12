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

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    // --- CORREÇÃO: Validação de Cartão de Crédito ---
    if (formData.type === "credit") {
      if (formData.limitInCents <= 0) {
        toast({
          title: "Erro",
          description: "O limite da conta é obrigatório para cartões de crédito.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.closingDate) {
        toast({
          title: "Erro",
          description: "O dia de fechamento é obrigatório para cartões de crédito.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.dueDate) {
        toast({
          title: "Erro",
          description: "O dia de vencimento é obrigatório para cartões de crédito.",
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
          title: "Erro",
          description:
            "Por favor, insira um dia válido (1-31) para o vencimento.",
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
          title: "Erro",
          description:
            "Por favor, insira um dia válido (1-31) para o fechamento.",
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
        title: "Sucesso",
        description: "Conta adicionada com sucesso!",
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
        title: "Erro no Servidor",
        description:
          "Não foi possível adicionar a conta. Tente novamente mais tarde.",
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
            Adicionar Nova Conta
          </DialogTitle>
          <DialogDescription>
            Crie uma nova conta bancária, cartão de crédito ou investimento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Nome da Conta */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Nome da Conta
            </Label>
            <Input
              id="name"
              placeholder="Ex: Banco do Brasil - Conta Corrente"
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
              Tipo de Conta
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value as any }))
              }
            >
              <SelectTrigger className="h-10 sm:h-11">
                <SelectValue placeholder="Selecione o tipo de conta" />
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
                ? "Saldo Devedor Atual"
                : formData.type === "investment"
                ? "Valor Aplicado"
                : "Saldo Inicial"}
            </Label>
            <CurrencyInput
              value={formData.balanceInCents}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, balanceInCents: value }))
              }
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formData.type === "credit"
                ? "Insira o valor total que você deve no cartão neste momento (faturas abertas + fechadas não pagas)."
                : formData.type === "investment"
                ? "Valor total aplicado no investimento"
                : "Saldo atual da conta"}
            </p>
          </div>

          {/* Limite da Conta */}
          <div className="space-y-2">
            {/* --- CORREÇÃO: Rótulo dinâmico --- */}
            <Label className="text-sm font-medium">
              Limite da Conta{" "}
              {formData.type !== "credit" && "(opcional)"}
            </Label>
            <CurrencyInput
              value={formData.limitInCents || 0}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, limitInCents: value || 0 }))
              }
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formData.type === "credit"
                ? "Limite total de compras do seu cartão."
                : "Defina um limite opcional para esta conta."}
            </p>
          </div>

          {/* Campos específicos para Cartão de Crédito */}
          {formData.type === "credit" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                {/* --- CORREÇÃO: Rótulo removido (opcional) --- */}
                <Label htmlFor="closingDate" className="text-sm font-medium">
                  Dia do Fechamento
                </Label>
                <Input
                  id="closingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 5"
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
                  Dia do mês em que a fatura fecha
                </p>
              </div>

              <div className="space-y-2">
                {/* --- CORREÇÃO: Rótulo removido (opcional) --- */}
                <Label htmlFor="dueDate" className="text-sm font-medium">
                  Dia do Vencimento
                </Label>
                <Input
                  id="dueDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
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
                  Dia do mês em que a fatura vence
                </p>
              </div>
            </div>
          )}

          {/* Seleção de Cor */}
          <ColorPicker
            value={formData.color}
            onChange={handleColorChange}
            label="Cor da Conta"
          />

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 sm:h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 sm:h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adicionando..." : "Adicionar Conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}