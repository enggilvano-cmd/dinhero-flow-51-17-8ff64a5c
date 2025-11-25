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
      <div className="flex items-center justify-end">
        <Switch
          id="fixed"
          checked={isFixed}
          disabled={isInstallment || isRecurring}
          onCheckedChange={onFixedChange}
          className="data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
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
