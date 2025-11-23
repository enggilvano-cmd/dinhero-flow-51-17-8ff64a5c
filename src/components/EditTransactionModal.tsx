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
import { Transaction, ACCOUNT_TYPE_LABELS } from "@/types";
import { useCategories } from "@/hooks/useCategories";
import { createDateFromString } from "@/lib/dateUtils";
import { TransactionScopeDialog, EditScope } from "./TransactionScopeDialog";
import { FixedTransactionScopeDialog, FixedScope } from "./FixedTransactionScopeDialog";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { AvailableBalanceIndicator } from "@/components/forms/AvailableBalanceIndicator";
import { logger } from "@/lib/logger";
import { editTransactionSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { EditTransactionModalProps } from "@/types/formProps";
import { validateCreditLimitForEdit } from "@/hooks/useBalanceValidation";

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
  const [originalData, setOriginalData] = useState(formData);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasCompletedTransactions, setHasCompletedTransactions] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  useEffect(() => {
    if (open && transaction) {
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      const initialData = {
        description: transaction.description || "",
        amountInCents: Math.abs(transaction.amount),
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id || "",
        account_id: transaction.account_id || "",
        status: transaction.status || "completed",
        invoiceMonth: transaction.invoice_month_overridden ? (transaction.invoice_month || "") : "",
      };
      
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [open, transaction, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    // Validação com Zod
    try {
      const validationData = {
        id: transaction.id,
        description: formData.description,
        amount: formData.amountInCents,
        date: formData.date.toISOString().split('T')[0],
        type: formData.type,
        category_id: formData.category_id,
        account_id: formData.account_id,
        status: formData.status,
        invoiceMonth: formData.invoiceMonth,
      };

      editTransactionSchema.parse(validationData);
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

    const isInstallment = Boolean(transaction.installments && transaction.installments > 1);
    const isFixed = Boolean(transaction.is_fixed || transaction.parent_transaction_id);
    
    if (isInstallment || isFixed) {
      // Buscar informações sobre transações geradas (filhas)
      try {
        const parentId = transaction.parent_transaction_id || transaction.id;
        const { data: childTransactions } = await supabase
          .from("transactions")
          .select("id, status")
          .eq("parent_transaction_id", parentId);

        const pendingCount = childTransactions?.filter(t => t.status === "pending").length || 0;
        const hasCompleted = childTransactions?.some(t => t.status === "completed") || false;

        setPendingTransactionsCount(pendingCount);
        setHasCompletedTransactions(hasCompleted);
      } catch (error) {
        logger.error("Error fetching child transactions:", error);
        setPendingTransactionsCount(0);
        setHasCompletedTransactions(false);
      }
      
      setScopeDialogOpen(true);
      return;
    }

    processEdit("current");
  };

  const processEdit = async (editScope: EditScope) => {
    if (!transaction) return;

    // Detectar apenas os campos que foram modificados
    const updates: Partial<Transaction> = {};
    
    if (formData.description.trim() !== originalData.description.trim()) {
      updates.description = formData.description.trim();
    }
    
    // Verificar se o amount ou tipo mudou
    // Backend sempre espera valores positivos, o tipo determina débito/crédito
    if (formData.amountInCents !== originalData.amountInCents || formData.type !== originalData.type) {
      updates.amount = Math.abs(formData.amountInCents);
    }
    
    // Verificar data - usar getTime() para comparação precisa
    if (formData.date.getTime() !== originalData.date.getTime()) {
      updates.date = formData.date;
    }
    
    if (formData.type !== originalData.type) {
      updates.type = formData.type;
    }
    
    if (formData.category_id !== originalData.category_id) {
      updates.category_id = formData.category_id;
    }
    
    if (formData.account_id !== originalData.account_id) {
      updates.account_id = formData.account_id;
    }
    
    if (formData.status !== originalData.status) {
      updates.status = formData.status;
    }
    
    if (formData.invoiceMonth !== originalData.invoiceMonth) {
      updates.invoice_month = formData.invoiceMonth || undefined;
      updates.invoice_month_overridden = Boolean(formData.invoiceMonth);
    }

    // Se nenhum campo foi modificado, não fazer nada
    if (Object.keys(updates).length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhuma alteração foi detectada",
        variant: "default",
      });
      onOpenChange(false);
      return;
    }

    // ✅ Validação preventiva usando hook centralizado
    const selectedAccount = accounts.find(acc => acc.id === (updates.account_id || transaction.account_id));
    const newAmount = updates.amount ?? Math.abs(transaction.amount);
    const newType = updates.type ?? transaction.type;
    const oldAmount = Math.abs(transaction.amount);
    const oldType = transaction.type;

    if (selectedAccount && newType === 'expense') {
      if (selectedAccount.type === 'credit') {
        // Validação de limite de crédito com hook centralizado
        try {
          // Garantir que oldType não é 'transfer'
          if (oldType !== 'transfer') {
            const validation = await validateCreditLimitForEdit(
              selectedAccount,
              newAmount,
              oldAmount,
              newType,
              oldType,
              transaction.id,
              transaction.status
            );

            if (!validation.isValid) {
              toast({
                title: "Limite de crédito excedido",
                description: validation.errorMessage || validation.message,
                variant: "destructive",
              });
              return;
            }
          }
        } catch (error) {
          logger.error('Error validating credit limit:', error);
          // Continue mesmo se a validação falhar (deixar o backend validar)
        }
      } else {
        // Validação de saldo para contas normais usando hook centralizado
        try {
          // Calcular a diferença de impacto no saldo
          let amountDifference = 0;
          
          if (oldType === 'expense') {
            amountDifference = newAmount - oldAmount;
          } else if (oldType === 'income') {
            amountDifference = newAmount + oldAmount;
          }

          // Só validar se está aumentando o uso do saldo
          if (amountDifference > 0) {
            const currentBalance = selectedAccount.balance;
            
            // Adicionar o valor antigo de volta se era completed expense
            let adjustedBalance = currentBalance;
            if (transaction.status === 'completed' && oldType === 'expense') {
              adjustedBalance = adjustedBalance + oldAmount;
            }
            
            const availableWithLimit = adjustedBalance + (selectedAccount.limit_amount || 0);

            // Verificar se tem saldo suficiente
            if (amountDifference > availableWithLimit) {
              const balanceFormatted = (adjustedBalance / 100).toFixed(2);
              const limitFormatted = ((selectedAccount.limit_amount || 0) / 100).toFixed(2);
              const availableFormatted = (availableWithLimit / 100).toFixed(2);
              const differenceFormatted = (amountDifference / 100).toFixed(2);

              const message = selectedAccount.limit_amount 
                ? `Saldo insuficiente. Disponível: R$ ${availableFormatted} (Saldo: R$ ${balanceFormatted} + Limite: R$ ${limitFormatted}) | Aumento solicitado: R$ ${differenceFormatted}`
                : `Saldo insuficiente. Disponível: R$ ${balanceFormatted} | Aumento solicitado: R$ ${differenceFormatted}`;

              toast({
                title: "Saldo insuficiente",
                description: message,
                variant: "destructive",
              });
              return;
            }
          }
        } catch (error) {
          logger.error('Error validating balance:', error);
          // Continue mesmo se a validação falhar
        }
      }
    }

    // Passar apenas os campos modificados + ID da transação
    const transactionUpdate = {
      id: transaction.id,
      ...updates,
    };

    onEditTransaction(transactionUpdate as Transaction, editScope);
    
    const scopeDescription = editScope === "current" ? "Transação atual atualizada com sucesso" : 
                             editScope === "all" ? "Todas as parcelas atualizadas com sucesso" :
                             "Parcelas selecionadas atualizadas com sucesso";
    
    toast({
      title: "Sucesso",
      description: scopeDescription,
    });

    onOpenChange(false);
    setScopeDialogOpen(false);
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = Boolean(transaction?.installments && transaction.installments > 1);
  const isFixed = Boolean(transaction?.is_fixed || transaction?.parent_transaction_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-headline">
              Editar Transação
              {isInstallment && (
                <span className="text-body font-normal text-muted-foreground block">
                  Parcela {transaction?.current_installment} de {transaction?.installments}
                </span>
              )}
              <DialogDescription className="text-body">
                Atualize as informações da transação
              </DialogDescription>
            </DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-caption">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Supermercado, Salário..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-caption">Valor</Label>
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

          {/* Indicador de saldo disponível em tempo real */}
          {formData.account_id && formData.type && (
            <AvailableBalanceIndicator
              account={accounts.find(acc => acc.id === formData.account_id)}
              transactionType={formData.type}
              amountInCents={formData.amountInCents}
            />
          )}

          <div className="space-y-2">
            <Label className="text-caption">Data</Label>
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
                    <span>Selecione uma data</span>
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
            <Label htmlFor="type" className="text-caption">Tipo</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "income" | "expense") => 
                setFormData({ ...formData, type: value, category_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-caption">Categoria</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
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
            <Label htmlFor="account" className="text-caption">Conta</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color || "#6b7280" }}
                        />
                        <span>{account.name}</span>
                      </div>
                      <span className="ml-2 text-caption text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-caption">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "pending" | "completed") => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* Invoice Month Selection for Credit Cards */}
          {formData.account_id &&
           accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="invoiceMonth" className="text-caption">Mês da Fatura (opcional)</Label>
              <Select
                value={formData.invoiceMonth}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceMonth: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês da fatura" />
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
              <p className="text-caption text-muted-foreground">
                Deixe em branco para usar o mês calculado automaticamente
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 text-body">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 text-body">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {isFixed && (
      <FixedTransactionScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        onScopeSelected={(scope: FixedScope) => {
          // Converter FixedScope para EditScope
          const editScope: EditScope =
            scope === "current"
              ? "current"
              : scope === "current-and-remaining"
                ? "current-and-remaining"
                : "all";
          processEdit(editScope);
        }}
        mode="edit"
        hasCompleted={hasCompletedTransactions}
        pendingCount={pendingTransactionsCount}
      />
    )}

    {!isFixed && isInstallment && (
      <TransactionScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        onScopeSelected={processEdit}
        currentInstallment={transaction?.current_installment || 1}
        totalInstallments={transaction?.installments || 1}
        isRecurring={Boolean(transaction?.is_recurring)}
        mode="edit"
      />
    )}
  </>
  );
}