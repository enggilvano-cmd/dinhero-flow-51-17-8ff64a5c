import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/forms/CurrencyInput";

interface TransactionFormFieldsProps {
  description: string;
  type: string;
  amount: number;
  date: string;
  lockType?: boolean;
  validationErrors: Record<string, string>;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: "income" | "expense" | "transfer") => void;
  onAmountChange: (value: number) => void;
  onDateChange: (value: string) => void;
}

export function TransactionFormFields({
  description,
  type,
  amount,
  date,
  lockType = false,
  validationErrors,
  onDescriptionChange,
  onTypeChange,
  onAmountChange,
  onDateChange,
}: TransactionFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description" className="text-caption">Descrição</Label>
        <Input
          id="description"
          placeholder="Ex: Compra no mercado, salário, etc."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
        {validationErrors.description && (
          <p className="text-body text-destructive">{validationErrors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type" className="text-caption">Tipo</Label>
          <Select
            value={type}
            onValueChange={onTypeChange}
            disabled={lockType}
          >
            <SelectTrigger disabled={lockType}>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.type && (
            <p className="text-body text-destructive">{validationErrors.type}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount" className="text-caption">Valor</Label>
          <CurrencyInput
            id="amount"
            value={amount}
            onValueChange={onAmountChange}
            className="h-10 sm:h-11"
          />
          {validationErrors.amount && (
            <p className="text-sm text-destructive">{validationErrors.amount}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date" className="text-caption">Data</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="[color-scheme:light] dark:[color-scheme:dark]"
        />
        {validationErrors.date && (
          <p className="text-body text-destructive">{validationErrors.date}</p>
        )}
      </div>
    </>
  );
}
