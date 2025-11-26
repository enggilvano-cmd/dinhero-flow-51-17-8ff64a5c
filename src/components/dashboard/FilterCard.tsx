import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import type { DateFilterType } from '@/types';

interface FilterCardProps {
  dateFilter: DateFilterType;
  setDateFilter: (value: DateFilterType) => void;
  selectedMonth: Date;
  customStartDate: Date | undefined;
  setCustomStartDate: (date: Date | undefined) => void;
  customEndDate: Date | undefined;
  setCustomEndDate: (date: Date | undefined) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
}

export function FilterCard({
  dateFilter,
  setDateFilter,
  selectedMonth,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  goToPreviousMonth,
  goToNextMonth,
}: FilterCardProps) {
  return (
    <Card className="financial-card">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <label id="period-filter-label" className="text-caption font-medium mb-2 block text-foreground">
              Período
            </label>
            <Select value={dateFilter} onValueChange={(value: DateFilterType) => setDateFilter(value)}>
              <SelectTrigger className="h-9 text-body" aria-labelledby="period-filter-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Transações</SelectItem>
                <SelectItem value="current_month">Mês Atual</SelectItem>
                <SelectItem value="month_picker">Navegar por Mês</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === 'month_picker' && (
            <div>
              <label id="month-navigation-label" className="text-caption font-medium mb-2 block text-foreground">
                Mês
              </label>
              <div className="flex items-center gap-2 h-9 px-3 border border-input rounded-md bg-background hover:bg-accent/5 transition-colors">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="h-6 w-6 p-0 hover:bg-accent"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="flex-1 text-center text-body font-medium" aria-live="polite">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMonth}
                  className="h-6 w-6 p-0 hover:bg-accent"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {dateFilter === 'custom' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label id="start-date-label" className="text-caption font-medium block text-foreground">
                    Início
                  </label>
                  <DatePicker
                    date={customStartDate}
                    onDateChange={setCustomStartDate}
                    placeholder="Inicial"
                    className="h-9 text-body w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label id="end-date-label" className="text-caption font-medium block text-foreground">
                    Final
                  </label>
                  <DatePicker
                    date={customEndDate}
                    onDateChange={setCustomEndDate}
                    placeholder="Final"
                    className="h-9 text-body w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
