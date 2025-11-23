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
import { logger } from "@/lib/logger";
import { ColorPicker } from "./forms/ColorPicker";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    type: "" as "checking" | "savings" | "credit" | "investment" | "",
    limitInCents: 0,
    dueDate: "",
    closingDate: "",
    color: PREDEFINED_COLORS[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // --- CORREÇÃO: Validação de Cartão de Crédito ---
    if (formData.type === "credit") {
      if (formData.limitInCents <= 0) {
        toast({
          title: "Erro",
          description: "O limite é obrigatório para cartões de crédito",
          variant: "destructive",
        });
        return;
      }
      if (!formData.closingDate) {
        toast({
          title: "Erro",
          description: "A data de fechamento é obrigatória para cartões de crédito",
          variant: "destructive",
        });
        return;
      }
      if (!formData.dueDate) {
        toast({
          title: "Erro",
          description: "A data de vencimento é obrigatória para cartões de crédito",
          variant: "destructive",
        });
        return;
      }
    }
    // --- Fim da Correção ---

    // Saldo inicial sempre começa em 0
    const balanceInCents = 0;

    const limitInCents =
      formData.limitInCents > 0 ? formData.limitInCents : undefined;

    let dueDate: number | undefined;
    if (formData.type === "credit") { // Validação de data (só se for crédito)
      dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        toast({
          title: "Erro",
          description: "Data de vencimento inválida (1-31)",
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
          description: "Data de fechamento inválida (1-31)",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("accounts")
        .insert({
          name: formData.name,
          type: formData.type,
          balance: balanceInCents,
          limit_amount: limitInCents,
          due_date: dueDate,
          closing_date: closingDate,
          color: formData.color,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidar cache do React Query
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

      toast({
        title: "Sucesso",
        description: "Conta adicionada com sucesso",
        variant: "default",
      });

      // Reset form
      setFormData({
        name: "",
        type: "" as "checking" | "savings" | "credit" | "investment" | "",
        limitInCents: 0,
        dueDate: "",
        closingDate: "",
        color: PREDEFINED_COLORS[0],
      });

      onOpenChange(false);
    } catch (error) {
      logger.error("Failed to add account:", error);
      toast({
        title: "Erro no Servidor",
        description: "Não foi possível adicionar a conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg sm:text-xl">
            Adicionar Conta
          </DialogTitle>
          <DialogDescription>
            Crie uma nova conta para gerenciar suas finanças
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
              placeholder="Ex: Conta Corrente, Cartão Nubank..."
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

          {/* Limite da Conta */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {formData.type === "credit" 
                ? "Limite do Cartão" 
                : formData.type === "checking" 
                ? "Limite de Cheque Especial (opcional)" 
                : "Limite (opcional)"}
            </Label>
            <CurrencyInput
              value={formData.limitInCents || 0}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, limitInCents: value || 0 }))
              }
            />
            {formData.type === "checking" && (
              <p className="text-xs text-muted-foreground">
                Informe o limite de cheque especial disponível na conta
              </p>
            )}
            {formData.type === "credit" && (
              <p className="text-xs text-muted-foreground">
                Limite total disponível no cartão de crédito
              </p>
            )}
          </div>

          {/* Campos específicos para Cartão de Crédito */}
          {formData.type === "credit" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                {/* --- CORREÇÃO: Rótulo removido (opcional) --- */}
                <Label htmlFor="closingDate" className="text-sm font-medium">
                  Data de Fechamento
                </Label>
                <Input
                  id="closingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
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
                  Data de Vencimento
                </Label>
                <Input
                  id="dueDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 20"
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