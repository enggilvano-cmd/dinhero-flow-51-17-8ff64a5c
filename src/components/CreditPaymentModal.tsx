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
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccountStore } from "@/stores/AccountStore";
import { CurrencyInput } from "./forms/CurrencyInput";

interface CreditPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPayment: (
    creditAccountId: string,
    bankAccountId: string,
    amountInCents: number,
    date: Date
  ) => Promise<{ creditAccount: Account; bankAccount: Account }>;
  creditAccount: Account | null;
  // Props para valores da fatura, passados pelo componente pai
  invoiceValueInCents?: number;
  nextInvoiceValueInCents?: number;
}

export function CreditPaymentModal({
  open,
  onOpenChange,
  onPayment,
  creditAccount,
  invoiceValueInCents = 0,
  nextInvoiceValueInCents = 0,
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
  const updateAccountsInStore = useAccountStore(
    (state) => state.updateAccounts
  );

  // Apenas contas bancárias podem pagar faturas
  const bankAccounts = useMemo(
    () => accounts.filter((acc) => acc.type !== "credit"),
    [accounts]
  );

  // --- CORREÇÃO 1: 'useEffect' ---
  // Esta lógica agora define corretamente o valor inicial
  // e reseta o modal ao fechar.
  useEffect(() => {
    if (open) {
      // Define o valor da fatura como padrão AO ABRIR
      setFormData({
        bankAccountId: "",
        amountInCents: invoiceValueInCents, // Define o valor inicial
        paymentType: "invoice",
        date: getTodayString(),
      });
    }
  }, [open, invoiceValueInCents]); // Depende do valor da fatura estar pronto

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
    if (amountInCents <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    // Validação de saldo da conta de origem (UX)
    const bankAccount = accounts.find(
      (acc) => acc.id === formData.bankAccountId
    );
    if (bankAccount) {
      const availableBalanceInCents = getAvailableBalance(bankAccount);
      if (availableBalanceInCents < amountInCents) {
        const limitText = bankAccount.limit_amount
          ? ` (incluindo limite de ${formatCurrency(
              bankAccount.limit_amount / 100 // formatCurrency espera Reais
            )})`
          : "";
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${bankAccount.name} não possui saldo suficiente para este pagamento${limitText}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // O usuário não pode pagar mais do que o saldo devedor total.
    const totalDebtInCents = Math.abs(creditAccount.balance);
    if (amountInCents > totalDebtInCents) {
      toast({
        title: "Valor Inválido",
        description: `O valor do pagamento (${formatCurrency(
          amountInCents / 100 // formatCurrency espera Reais
        )}) não pode ser maior que a dívida total de ${formatCurrency(
          totalDebtInCents / 100 // formatCurrency espera Reais
        )}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        creditAccount: updatedCreditAccount,
        bankAccount: updatedBankAccount,
      } = await onPayment(
        creditAccount.id,
        formData.bankAccountId,
        amountInCents,
        createDateFromString(formData.date)
      );

      // Atualiza as contas no store global
      updateAccountsInStore([updatedCreditAccount, updatedBankAccount]);
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
        description: "Não foi possível processar o pagamento.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CORREÇÃO 2: 'handlePaymentTypeChange' ---
  // Esta lógica agora preserva o valor se clicar em "Outro Valor"
  const handlePaymentTypeChange = (
    type: "invoice" | "total_balance" | "partial"
  ) => {
    setFormData((prev) => {
      let newAmountInCents = prev.amountInCents; // Preserva o valor atual por padrão

      if (type === "invoice" && creditAccount) {
        newAmountInCents = invoiceValueInCents;
      } else if (type === "total_balance" && creditAccount) {
        newAmountInCents = Math.abs(creditAccount.balance);
      }
      // Se type === 'partial', newAmountInCents (que é o prev.amountInCents) é mantido.
      // Se o usuário quiser 0, ele pode apagar no input.

      return {
        ...prev,
        paymentType: type,
        amountInCents: newAmountInCents,
      };
    });
  };

  // O saldo devedor total (ex: -50000)
  const totalDebtInCents = creditAccount ? Math.abs(creditAccount.balance) : 0;

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
                    {formatCurrency(invoiceValueInCents / 100)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fatura Aberta:</span>
                  <span className="font-medium text-muted-foreground">
                    {formatCurrency(nextInvoiceValueInCents / 100)}
                  </span>
                </p>
                <p className="flex justify-between text-base font-semibold border-t pt-1 mt-1">
                  <span className="text-foreground">Saldo Devedor Total:</span>
                  <span className="balance-negative">
                    {formatCurrency(totalDebtInCents / 100)}
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
                        {formatCurrency(getAvailableBalance(account) / 100)}
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
                  {formatCurrency(invoiceValueInCents / 100)}
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
                  {formatCurrency(totalDebtInCents / 100)}
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
              <Label htmlFor="amount">Valor do Pagamento (R$)</Label>
              <CurrencyInput
                id="amount"
                value={formData.amountInCents}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    amountInCents: value,
                    // Se o usuário digitar, muda para pagamento parcial
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
                bancária cadastrada para pagar faturas de cartão.
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
              disabled={bankAccounts.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Realizando..." : "Realizar Pagamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}