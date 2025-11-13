import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Account } from "@/types";
import { getTodayString } from "@/lib/dateUtils";
import { getAvailableBalance } from "@/lib/formatters"; // Remove formatCurrency se não for usado
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccountStore } from "@/stores/AccountStore";
import { CurrencyInput } from "./forms/CurrencyInput";

// Helper para formatar moeda (R$)
const formatBRL = (valueInCents: number) => {
  // Converte centavos (ex: 12345) para Reais (123.45)
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100); 
};


interface CreditPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPayment: (params: {
    creditCardAccountId: string;
    debitAccountId: string;
    amount: number;
    paymentDate: string;
  }) => Promise<{
    updatedCreditAccount: Account;
    updatedDebitAccount: Account;
  }>;
  creditAccount: Account | null;
  invoiceValueInCents: number; 
  nextInvoiceValueInCents: number;
  // BUGFIX: Receber a dívida total calculada
  totalDebtInCents: number;
}

export function CreditPaymentModal({
  open,
  onOpenChange,
  onPayment,
  creditAccount,
  invoiceValueInCents = 0,
  nextInvoiceValueInCents = 0,
  // BUGFIX: Usar a prop da dívida total
  totalDebtInCents: totalDebtInCentsProp = 0, 
}: CreditPaymentModalProps) {
  const [formData, setFormData] = useState({
    bankAccountId: "",
    amountInCents: 0,
    paymentType: "invoice" as "invoice" | "total_balance" | "partial",
    date: getTodayString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const accounts = useAccountStore((state) => state.accounts);
  
  const bankAccounts = useMemo(
    () => accounts.filter((acc) => acc.type !== "credit"),
    [accounts]
  );

  // Normalização: garantir valores positivos em centavos
  const normalizeCents = (v: number) => Math.max(0, Math.abs(v || 0));
  const invoiceValueNorm = normalizeCents(invoiceValueInCents);
  const nextInvoiceValueNorm = normalizeCents(nextInvoiceValueInCents);
  const totalDebtNorm = normalizeCents(totalDebtInCentsProp);

  useEffect(() => {
    if (open) {
      let initialAmount = 0;
      let initialPaymentType: "invoice" | "total_balance" | "partial" = "partial";

      if (invoiceValueNorm > 0) {
        initialAmount = invoiceValueNorm;
        initialPaymentType = "invoice";
      } else if (totalDebtNorm > 0) {
        initialAmount = totalDebtNorm;
        initialPaymentType = "total_balance";
      }

      setFormData({
        bankAccountId: "",
        amountInCents: initialAmount,
        paymentType: initialPaymentType,
        date: getTodayString(),
      });
    }
  }, [open, invoiceValueNorm, totalDebtNorm]); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditAccount || !formData.bankAccountId || formData.amountInCents <= 0) {
      toast({
        title: "Erro",
        description:
          "Por favor, preencha todos os campos e um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const { amountInCents } = formData;

    const bankAccount = accounts.find(
      (acc) => acc.id === formData.bankAccountId
    );
    if (bankAccount) {
      const availableBalanceInCents = getAvailableBalance(bankAccount);
      if (availableBalanceInCents < amountInCents) {
        const limitText = bankAccount.limit_amount
          ? ` (incluindo limite de ${formatBRL(bankAccount.limit_amount)})`
          : "";
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${bankAccount.name} não possui saldo suficiente${limitText}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validação contra a dívida total normalizada (valor absoluto)
    const totalDebtInCents = totalDebtNorm;
    
    // Pequena margem de 1 centavo para erros de arredondamento
    if (amountInCents > totalDebtInCents + 1) { 
      toast({
        title: "Valor Inválido",
        description: `O valor do pagamento (${formatBRL(amountInCents)}) não pode ser maior que a dívida total de ${formatBRL(
          totalDebtInCents
        )}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onPayment({
        creditCardAccountId: creditAccount.id,
        debitAccountId: formData.bankAccountId,
        amount: amountInCents,
        paymentDate: formData.date,
      });

      toast({
        title: "Sucesso!",
        description: "Pagamento de fatura realizado.",
        variant: "default",
      });
      onOpenChange(false); // Fechar o modal
    } catch (error) {
      console.error("Payment failed:", error);
      toast({
        title: "Erro",
        description: `Não foi possível processar o pagamento. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exibição: dívida total normalizada (valor absoluto)
  const totalDebtInCents = totalDebtNorm;

  const handlePaymentTypeChange = (
    type: "invoice" | "total_balance" | "partial"
  ) => {
    setFormData((prev) => {
      let newAmountInCents = prev.amountInCents; 

      if (type === "invoice") {
        newAmountInCents = invoiceValueNorm;
      } else if (type === "total_balance") {
        newAmountInCents = totalDebtNorm;
      }
      // Se 'partial', mantém o valor que o usuário digitou
      
      return {
        ...prev,
        paymentType: type,
        amountInCents: newAmountInCents,
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pagamento de Fatura</DialogTitle>
          <DialogDescription>
            Realize o pagamento da fatura do seu cartão de crédito
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {creditAccount && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h3 className="font-semibold">{creditAccount.name}</h3>
              <div className="text-sm space-y-1">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fatura Fechada:</span>
                  <span className="font-medium balance-negative">
                    {formatBRL(invoiceValueNorm)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fatura Aberta:</span>
                  <span className="font-medium text-muted-foreground">
                    {formatBRL(nextInvoiceValueNorm)}
                  </span>
                </p>
                <p className="flex justify-between text-base font-semibold border-t pt-1 mt-1">
                  <span className="text-foreground">Saldo Devedor Total:</span>
                  <span className="balance-negative">
                    {/* BUGFIX: Usar a prop totalDebtInCents */}
                    {formatBRL(totalDebtInCents)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bankAccount">Conta para Pagamento</Label>
            <Select
              value={formData.bankAccountId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, bankAccountId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta bancária" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: account.color || "#6b7280",
                          }}
                        />
                        <span>{account.name}</span>
                      </div>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formatBRL(getAvailableBalance(account))}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.bankAccountId && (
              <AccountBalanceDetails
                account={accounts.find(
                  (acc) => acc.id === formData.bankAccountId
                )}
              />
            )}
          </div>

          <div className="space-y-3">
            <Label>Tipo de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.paymentType === "invoice" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("invoice")}
                className="h-auto p-2 flex-col"
                disabled={invoiceValueInCents <= 0}
              >
                <span className="font-medium text-xs">Pagar Fatura</span>
                <span className="text-xs text-muted-foreground">
                  {formatBRL(invoiceValueInCents)}
                </span>
              </Button>
              <Button
                type="button"
                variant={
                  formData.paymentType === "total_balance" ? "default" : "outline"
                }
                onClick={() => handlePaymentTypeChange("total_balance")}
                className="h-auto p-2 flex-col"
                disabled={totalDebtInCents <= 0}
              >
                <span className="font-medium text-xs">Pagar Total</span>
                <span className="text-xs text-muted-foreground">
                  {/* BUGFIX: Usar a prop totalDebtInCents */}
                  {formatBRL(totalDebtInCents)}
                </span>
              </Button>
              <Button
                type="button"
                variant={formData.paymentType === "partial" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("partial")}
                className="h-auto p-2 flex-col"
              >
                <span className="font-medium text-xs">Outro Valor</span>
                <span className="text-xs text-muted-foreground">
                  Valor manual
                </span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor do Pagamento</Label>
              <CurrencyInput
                id="amount"
                value={formData.amountInCents}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    amountInCents: value,
                    paymentType: "partial",
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data do Pagamento</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
              />
            </div>
          </div>

          {bankAccounts.length === 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Atenção:</strong> Você precisa ter pelo menos uma conta
                bancária cadastrada para pagar faturas.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={bankAccounts.length === 0 || isSubmitting || formData.amountInCents <= 0}
            >
              {isSubmitting ? "Realizando..." : "Realizar Pagamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}