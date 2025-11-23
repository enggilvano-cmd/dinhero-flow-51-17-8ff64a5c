import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateFilterType } from '@/hooks/useDashboardFilters';

interface FilterCardProps {
  dateFilter: DateFilterType;
  setDateFilter: (value: DateFilterType) => void;
  selectedMonth: Date;
  customStartDate: Date | undefined;
  setCustomStartDate: (date: Date | undefined) => void;
  customEndDate: Date | undefined;
  setCustomEndDate: (date: Date | undefined) => void;
  startDatePickerOpen: boolean;
  setStartDatePickerOpen: (open: boolean) => void;
  endDatePickerOpen: boolean;
  setEndDatePickerOpen: (open: boolean) => void;
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
  startDatePickerOpen,
  setStartDatePickerOpen,
  endDatePickerOpen,
  setEndDatePickerOpen,
  goToPreviousMonth,
  goToNextMonth,
}: FilterCardProps) {
  return (
    <Card className="financial-card">
      <CardContent className="p-3">
        <div className="space-y-3">
          <div>
            <label id="period-filter-label" className="text-caption mb-1 block">
              Período
            </label>
            <Select value={dateFilter} onValueChange={(value: DateFilterType) => setDateFilter(value)}>
              <SelectTrigger className="h-8 text-body" aria-labelledby="period-filter-label">
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
              <label id="month-navigation-label" className="text-caption mb-1 block">
                Mês
              </label>
              <div className="flex items-center gap-1 h-8 px-2 border border-input rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="h-5 w-5 p-0"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                </Button>
                <span className="flex-1 text-center text-caption" aria-live="polite">
                  {format(selectedMonth, 'MMM/yy', { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMonth}
                  className="h-5 w-5 p-0"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label id="start-date-label" className="text-caption mb-1 block">
                  Início
                </label>
                <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full h-8 justify-start text-left font-normal text-body',
                        !customStartDate && 'text-muted-foreground'
                      )}
                      aria-labelledby="start-date-label"
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" aria-hidden="true" />
                      <span className="truncate">
                        {customStartDate
                          ? format(customStartDate, 'dd/MM', { locale: ptBR })
                          : 'Inicial'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => {
                        setCustomStartDate(date);
                        setStartDatePickerOpen(false);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label id="end-date-label" className="text-caption mb-1 block">
                  Final
                </label>
                <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full h-8 justify-start text-left font-normal text-body',
                        !customEndDate && 'text-muted-foreground'
                      )}
                      aria-labelledby="end-date-label"
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" aria-hidden="true" />
                      <span className="truncate">
                        {customEndDate
                          ? format(customEndDate, 'dd/MM', { locale: ptBR })
                          : 'Final'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => {
                        setCustomEndDate(date);
                        setEndDatePickerOpen(false);
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
