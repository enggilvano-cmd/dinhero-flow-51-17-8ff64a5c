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
import { useCategories } from "@/hooks/useCategories";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import { TransactionScopeDialog, EditScope } from "./TransactionScopeDialog";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  category_id: string | null;
  account_id: string;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_end_date: string | null;
}

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  color: string;
}

interface EditRecurringTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: RecurringTransaction, scope?: EditScope) => void;
  transaction: RecurringTransaction | null;
  accounts: Account[];
}

export function EditRecurringTransactionModal({
  open,
  onOpenChange,
  onEditTransaction,
  transaction,
  accounts
}: EditRecurringTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amountInCents: 0,
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    recurrence_type: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    recurrence_end_date: null as Date | null,
  });
  const [originalData, setOriginalData] = useState(formData);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  useEffect(() => {
    if (open && transaction) {
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      const initialData = {
        description: transaction.description,
        amountInCents: Math.abs(transaction.amount),
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id || "",
        account_id: transaction.account_id,
        recurrence_type: transaction.recurrence_type || "monthly",
        recurrence_end_date: transaction.recurrence_end_date ? new Date(transaction.recurrence_end_date) : null,
      };
      
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [open, transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    if (!formData.description.trim() || formData.amountInCents <= 0 || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria para a transação",
        variant: "destructive",
      });
      return;
    }

    // Verificar se há mudanças
    const hasChanges = 
      formData.description.trim() !== originalData.description.trim() ||
      formData.amountInCents !== originalData.amountInCents ||
      formData.type !== originalData.type ||
      formData.category_id !== originalData.category_id ||
      formData.account_id !== originalData.account_id ||
      formData.recurrence_type !== originalData.recurrence_type ||
      formData.recurrence_end_date?.getTime() !== originalData.recurrence_end_date?.getTime();

    if (!hasChanges) {
      toast({
        title: "Aviso",
        description: "Nenhuma alteração foi detectada",
        variant: "default",
      });
      onOpenChange(false);
      return;
    }

    // Abrir diálogo de escopo para transações recorrentes
    setScopeDialogOpen(true);
  };

  const processEdit = (scope: EditScope) => {
    if (!transaction) return;

    // Detectar apenas os campos que foram modificados
    const updates: Partial<RecurringTransaction> = {
      id: transaction.id,
      date: transaction.date,
    };
    
    if (formData.description.trim() !== originalData.description.trim()) {
      updates.description = formData.description.trim();
    }
    
    if (formData.amountInCents !== originalData.amountInCents || formData.type !== originalData.type) {
      const finalAmount = formData.type === 'income' 
        ? formData.amountInCents 
        : -Math.abs(formData.amountInCents);
      updates.amount = finalAmount;
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
    
    if (formData.recurrence_type !== originalData.recurrence_type) {
      updates.recurrence_type = formData.recurrence_type;
    }
    
    if (formData.recurrence_end_date?.getTime() !== originalData.recurrence_end_date?.getTime()) {
      updates.recurrence_end_date = formData.recurrence_end_date ? format(formData.recurrence_end_date, 'yyyy-MM-dd') : null;
    }

    onEditTransaction(updates as RecurringTransaction, scope);
    
    const scopeDescription = scope === "current" ? "Transação recorrente atualizada com sucesso" : 
                             scope === "all" ? "Todas as ocorrências atualizadas com sucesso" :
                             "Ocorrências selecionadas atualizadas com sucesso";
    
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

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Transação Recorrente</DialogTitle>
          <DialogDescription>
            Atualize as informações da transação recorrente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Aluguel, Salário..."
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
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color || "#6b7280" }}
                        />
                        <span>{account.name}</span>
                      </div>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_type">Frequência</Label>
            <Select
              value={formData.recurrence_type}
              onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") => 
                setFormData({ ...formData, recurrence_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_end_date">
              Data de Término (opcional)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.recurrence_end_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.recurrence_end_date ? (
                    format(formData.recurrence_end_date, "PPP", { locale: ptBR })
                  ) : (
                    <span>Sem data de término</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.recurrence_end_date || undefined}
                  onSelect={(date) => setFormData({ ...formData, recurrence_end_date: date || null })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para recorrência indefinida
            </p>
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

    <TransactionScopeDialog
      open={scopeDialogOpen}
      onOpenChange={setScopeDialogOpen}
      onScopeSelected={processEdit}
      isRecurring={true}
      mode="edit"
    />
    </>
  );
}
