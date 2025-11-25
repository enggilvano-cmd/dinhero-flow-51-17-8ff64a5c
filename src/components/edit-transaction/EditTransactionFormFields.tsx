import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { AvailableBalanceIndicator } from "@/components/forms/AvailableBalanceIndicator";
import { Account, Category, ACCOUNT_TYPE_LABELS } from "@/types";

interface EditTransactionFormFieldsProps {
  formData: {
    description: string;
    amountInCents: number;
    date: Date;
    type: "income" | "expense";
    category_id: string;
    account_id: string;
    status: "pending" | "completed";
    invoiceMonth: string;
  };
  onFormDataChange: (updates: Partial<EditTransactionFormFieldsProps['formData']>) => void;
  accounts: Account[];
  filteredCategories: Category[];
}

export function EditTransactionFormFields({
  formData,
  onFormDataChange,
  accounts,
  filteredCategories,
}: EditTransactionFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description" className="text-caption">Descrição</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => onFormDataChange({ description: e.target.value })}
          placeholder="Ex: Supermercado, Salário..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount" className="text-caption">Valor</Label>
        <CurrencyInput
          id="amount"
          value={formData.amountInCents}
          onValueChange={(value) => onFormDataChange({ amountInCents: value })}
        />
      </div>

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
              onSelect={(date) => date && onFormDataChange({ date })}
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
            onFormDataChange({ type: value, category_id: "" })
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
          onValueChange={(value) => onFormDataChange({ category_id: value })}
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
          onValueChange={(value) => onFormDataChange({ account_id: value })}
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
          onValueChange={(value: "pending" | "completed") => onFormDataChange({ status: value })}
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

      {formData.account_id &&
       accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="invoiceMonth" className="text-caption">Mês da Fatura (opcional)</Label>
          <Select
            value={formData.invoiceMonth}
            onValueChange={(value) =>
              onFormDataChange({ invoiceMonth: value })
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
    </>
  );
}
