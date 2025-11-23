import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface FixedTransactionOptionsProps {
  isFixed: boolean;
  date: string;
  isInstallment: boolean;
  isRecurring: boolean;
  onFixedChange: (checked: boolean) => void;
}

export function FixedTransactionOptions({
  isFixed,
  date,
  isInstallment,
  isRecurring,
  onFixedChange,
}: FixedTransactionOptionsProps) {
  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="fixed" className="text-headline cursor-pointer">
              Transação Fixa
            </Label>
          </div>
          <p className="text-body text-muted-foreground">
            Receitas ou despesas que se repetem todo mês, sem data de término (ex: salário, aluguel)
          </p>
        </div>
        <Switch
          id="fixed"
          checked={isFixed}
          disabled={isInstallment || isRecurring}
          onCheckedChange={onFixedChange}
          className="mt-1 data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
        />
      </div>

      {isFixed && (
        <div className="space-y-2 pt-2 animate-fade-in">
          <p className="text-body text-muted-foreground">
            Esta transação será criada automaticamente todo dia {new Date(date).getDate()} de cada mês.
          </p>
        </div>
      )}
    </div>
  );
}
