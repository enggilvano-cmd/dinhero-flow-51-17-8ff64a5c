import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getTodayString } from "@/lib/dateUtils";

interface RecurringOptionsProps {
  isRecurring: boolean;
  recurrenceType: "daily" | "weekly" | "monthly" | "yearly";
  recurrenceEndDate: string;
  isInstallment: boolean;
  isFixed: boolean;
  onRecurringChange: (checked: boolean) => void;
  onRecurrenceTypeChange: (value: "daily" | "weekly" | "monthly" | "yearly") => void;
  onRecurrenceEndDateChange: (value: string) => void;
}

export function RecurringOptions({
  isRecurring,
  recurrenceType,
  recurrenceEndDate,
  isInstallment,
  isFixed,
  onRecurringChange,
  onRecurrenceTypeChange,
  onRecurrenceEndDateChange,
}: RecurringOptionsProps) {
  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="recurring" className="text-headline cursor-pointer">
              Transação Recorrente
            </Label>
          </div>
          <p className="text-body text-muted-foreground">
            Crie transações que se repetem automaticamente
          </p>
        </div>
        <Switch
          id="recurring"
          checked={isRecurring}
          disabled={isInstallment || isFixed}
          onCheckedChange={onRecurringChange}
          className="mt-1 data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
        />
      </div>

      {isRecurring && (
        <div className="space-y-4 pt-2 animate-fade-in">
          <div className="space-y-2">
            <Label htmlFor="recurrenceType" className="text-caption">Frequência</Label>
            <Select
              value={recurrenceType}
              onValueChange={onRecurrenceTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrenceEndDate" className="text-caption">Data de Término</Label>
            <Input
              id="recurrenceEndDate"
              type="date"
              value={recurrenceEndDate}
              onChange={(e) => onRecurrenceEndDateChange(e.target.value)}
              min={getTodayString()}
            />
            <p className="text-caption text-muted-foreground">
              Opcional - deixe em branco para recorrência indefinida
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
