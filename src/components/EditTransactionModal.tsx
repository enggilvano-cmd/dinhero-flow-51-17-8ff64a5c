import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CurrencyInput } from "@/components/forms/CurrencyInput";

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: Transaction, editScope?: EditScope) => void;
  transaction: Transaction | null;
  accounts: Account[]; // Adicionado para receber a lista de contas
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
    amountInCents: 0,
    date: new Date(),
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed"
  });
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  useEffect(() => {
    // Apenas atualize o formulário quando o modal for aberto ou a transação real mudar.
    // Depender de `transaction.id` previne re-execuções desnecessárias.
    if (open && transaction) {
      // Use createDateFromString para evitar problemas de fuso horário
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      // Only allow income/expense types in edit modal, transfers should be handled separately
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      setFormData({
        description: transaction.description,
        amountInCents: Math.abs(transaction.amount),
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        status: transaction.status
      });
    }
  }, [open, transaction?.id]); // Depende de `open` e `transaction.id`

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

    // Category is required for income/expense transactions
    if (!formData.category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }

    // Check if this is an installment transaction
    const isInstallment = transaction.installments && transaction.installments > 1;
    
    if (isInstallment) {
      // Open scope selection dialog for installment transactions
      setScopeDialogOpen(true);
      return;
    }

    // Process single transaction edit immediately
    processEdit("current");
  };

  const processEdit = (editScope: EditScope) => {
    if (!transaction) return;

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description.trim(),
      amount: formData.type === 'income' ? formData.amountInCents : -Math.abs(formData.amountInCents),
      // A data da transação não deve ser alterada automaticamente. 
      // A fatura a que pertence é uma consequência da data, e não o contrário.
      // A seleção de fatura deve servir apenas para mover a transação para outra fatura,
      // o que implica em alterar sua data, mas isso deve ser uma ação explícita do usuário.
      // Por agora, vamos manter a data que o usuário definiu no formulário.
      date: formData.date, // A data já é um objeto Date, o backend deve formatá-la corretamente.
      type: formData.type,
      category_id: formData.category_id,
      account_id: formData.account_id,
      status: formData.status
    };

    onEditTransaction(updatedTransaction, editScope);
    
    const scopeDescription = editScope === "current" ? "A transação" : 
                           editScope === "all" ? "Todas as parcelas" :
                           editScope === "current-and-previous" ? "As parcelas selecionadas" :
                           "As parcelas restantes";
    
    toast({
      title: "Transação atualizada",
      description: `${scopeDescription} foi atualizada com sucesso.`,
    });

    onOpenChange(false);
    setScopeDialogOpen(false); // Garante que o diálogo de escopo seja fechado
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = transaction?.installments && transaction.installments > 1;
  const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
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