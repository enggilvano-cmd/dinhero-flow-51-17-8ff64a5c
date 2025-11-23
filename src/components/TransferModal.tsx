import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { CurrencyInput } from "./forms/CurrencyInput";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { ArrowRight } from "lucide-react";
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccounts } from "@/hooks/queries/useAccounts";
import { logger } from "@/lib/logger";
import { transferSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { TransferModalProps } from "@/types/formProps";
import { useBalanceValidation } from "@/hooks/useBalanceValidation";

export function TransferModal({ open, onOpenChange, onTransfer }: TransferModalProps) {
  const { accounts } = useAccounts();
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amountInCents: 0,
    date: getTodayString()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Contas de origem podem ser qualquer tipo, exceto crédito.
  const sourceAccounts = useMemo(() => accounts.filter(acc => acc.type !== "credit"), [accounts]);
  
  // Contas de destino também não podem ser de crédito para evitar ambiguidade com pagamento de fatura.
  const destinationAccounts = useMemo(() => 
    accounts.filter(acc => acc.type !== "credit" && acc.id !== formData.fromAccountId), 
    [accounts, formData.fromAccountId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação com Zod
    try {
      const validationData = {
        description: "Transferência",
        amount: formData.amountInCents,
        date: formData.date,
        from_account_id: formData.fromAccountId,
        to_account_id: formData.toAccountId,
      };

      transferSchema.parse(validationData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive",
        });
        logger.error("Validation errors:", error.errors);
        return;
      }
    }

    // ✅ Usar hook centralizado para validação de saldo da conta de origem
    const fromAccount = sourceAccounts.find(acc => acc.id === formData.fromAccountId);
    if (fromAccount) {
      const validation = useBalanceValidation({
        account: fromAccount,
        amountInCents: formData.amountInCents,
        transactionType: 'expense',
      });

      if (!validation.isValid) {
        const limitText = fromAccount.limit_amount 
          ? ` (incluindo limite de ${formatCurrency(fromAccount.limit_amount)})`
          : '';
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${fromAccount.name} não possui saldo suficiente${limitText}.`,
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
        title: "Sucesso",
        description: "Transferência realizada com sucesso",
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
        title: "Erro na Transferência",
        description: "Não foi possível realizar a transferência. Tente novamente.",
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
          <DialogTitle className="text-headline">Transferência entre Contas</DialogTitle>
          <DialogDescription className="text-body">
            Realize uma transferência entre suas contas
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromAccount" className="text-caption">Conta de Origem</Label>
              <Select value={formData.fromAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, fromAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((account) => {
                    const hasLimit = account.limit_amount && account.limit_amount > 0;
                    
                    return (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2 w-full">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: account.color || "#6b7280" }}
                          />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium truncate text-body">{account.name}</span>
                              <span className="text-caption text-muted-foreground">
                                {formatCurrency(account.balance)}
                                {hasLimit && (
                                  <span className="text-primary ml-1">
                                    + {formatCurrency(account.limit_amount || 0)} limite
                                  </span>
                                )}
                              </span>
                            </div>
                        </div>
                      </SelectItem>
                    );
                  })}
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
              <Label htmlFor="toAccount" className="text-caption">Conta de Destino</Label>
              <Select value={formData.toAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, toAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts
                    .map((account) => {
                      const hasLimit = account.limit_amount && account.limit_amount > 0;
                      
                      return (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2 w-full">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: account.color || "#6b7280" }}
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium truncate text-body">{account.name}</span>
                              <span className="text-caption text-muted-foreground">
                                {formatCurrency(account.balance)}
                                {hasLimit && (
                                  <span className="text-primary ml-1">
                                    + {formatCurrency(account.limit_amount || 0)} limite
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-caption">Valor</Label>
              <CurrencyInput
                id="amount"
                value={formData.amountInCents}
                onValueChange={(value) => setFormData(prev => ({ ...prev, amountInCents: value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-caption">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-caption text-center text-muted-foreground pt-2">
            Não é possível transferir para contas de crédito.
            <br />
            Para pagar uma fatura de cartão, use o botão "Pagar Fatura".
          </p>

          {sourceAccounts.length < 2 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-body text-muted-foreground">
                <strong>Atenção:</strong> Você precisa ter pelo menos 2 contas (exceto cartão de crédito) para fazer transferências.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 text-body">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 text-body"
              disabled={sourceAccounts.length < 2 || isSubmitting}
            >
              {isSubmitting ? "Processando..." : "Realizar Transferência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}