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
import { CurrencyInput } from "@/components/forms/CurrencyInput"; // Importa o CurrencyInput

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

  useEffect(() => {
    if (open && transaction) {
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      // Calcula o mês da fatura baseado na data de fechamento se for cartão de crédito
      let defaultInvoiceMonth = "";
      const currentAccount = accounts.find(acc => acc.id === transaction.account_id);
      if (currentAccount && currentAccount.type === "credit" && currentAccount.closing_date) {
        const today = new Date();
        const currentDay = today.getDate();
        const closingDay = currentAccount.closing_date;
        
        // Se hoje é depois do dia de fechamento, a fatura é do próximo mês
        let invoiceDate = new Date(today);
        if (currentDay > closingDay) {
          invoiceDate.setMonth(invoiceDate.getMonth() + 1);
        }
        
        defaultInvoiceMonth = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
      }
      
      setFormData({
        description: transaction.description,
        
        // =================================================================
        // CORREÇÃO CHAVE (que o seu código já tem):
        // Usar Math.abs() para garantir que o valor no formulário
        // seja sempre positivo, evitando o bug de sinal duplo.
        // =================================================================
        amountInCents: Math.abs(transaction.amount),
        
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        status: transaction.status,
        invoiceMonth: transaction.invoice_month || defaultInvoiceMonth,
      });
    }
  }, [open, transaction, accounts]); // Depender do objeto 'transaction' é seguro aqui

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    if (!formData.description.trim() || formData.amountInCents <= 0 || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }

    const isInstallment = transaction.installments && transaction.installments > 1;
    
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
    };

    onEditTransaction(updatedTransaction, editScope);
    
    const scopeDescription = editScope === "current" ? "A transação" : 
                             editScope === "all" ? "Todas as parcelas" :
                             "As parcelas selecionadas";
    
    toast({
      title: "Transação atualizada",
      description: `${scopeDescription} foi atualizada com sucesso.`,
    });

    onOpenChange(false);
    setScopeDialogOpen(false);
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = transaction?.installments && transaction.installments > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Editar Transação
              {isInstallment && (
                <span className="text-sm font-normal text-muted-foreground block">
                  Parcela {transaction.current_installment}/{transaction.installments}
                </span>
              )}
              <DialogDescription>
                Modifique os detalhes da sua transação.
              </DialogDescription>
            </DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Almoço no restaurante"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
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
            <Label>Data</Label>
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
            <Label htmlFor="type">Tipo</Label>
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
            <Label htmlFor="category">Categoria</Label>
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
            <Label htmlFor="account">Conta</Label>
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
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "pending" | "completed") => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Month Selection for Credit Cards */}
          {formData.account_id && 
           accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="invoiceMonth">Mês da Fatura</Label>
              <Select
                value={formData.invoiceMonth}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceMonth: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
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
                Selecione em qual fatura esta compra será lançada
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Salvar Alterações
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