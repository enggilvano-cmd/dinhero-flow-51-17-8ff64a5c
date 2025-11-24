import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, TrendingUp, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TrialBalanceReport } from './accounting/TrialBalanceReport';
import { IncomeStatementReport } from './accounting/IncomeStatementReport';
import { BalanceSheetReport } from './accounting/BalanceSheetReport';

export default function AccountingReportsEnhancedPage() {
  const { user } = useAuth();
  const [periodStart, setPeriodStart] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());

  // Buscar journal entries
  const { data: journalEntries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['journal-entries', user?.id, periodStart, periodEnd],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(periodEnd, 'yyyy-MM-dd'))
        .order('entry_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Buscar plano de contas
  const { data: chartAccounts = [], isLoading: isLoadingChart } = useQuery({
    queryKey: ['chart-of-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = isLoadingEntries || isLoadingChart;

  return (
    <div className="spacing-responsive-md fade-in pb-6 sm:pb-8">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div>
          <h1 className="text-title font-bold mb-2">Relatórios Contábeis</h1>
          <p className="text-body text-muted-foreground">
            Balancete de Verificação, DRE e Balanço Patrimonial
          </p>
        </div>

        {/* Filtros de Período */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="text-caption font-medium mb-2 block">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[200px] justify-start text-left font-normal',
                        !periodStart && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodStart ? format(periodStart, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodStart}
                      onSelect={(date) => date && setPeriodStart(date)}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-caption font-medium mb-2 block">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[200px] justify-start text-left font-normal',
                        !periodEnd && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodEnd ? format(periodEnd, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodEnd}
                      onSelect={(date) => date && setPeriodEnd(date)}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Relatórios */}
        <Tabs defaultValue="trial-balance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trial-balance" className="gap-2">
              <Scale className="h-4 w-4" />
              Balancete
            </TabsTrigger>
            <TabsTrigger value="income-statement" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              DRE
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" className="gap-2">
              <FileText className="h-4 w-4" />
              Balanço
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance" className="mt-6">
            <TrialBalanceReport
              journalEntries={journalEntries}
              chartAccounts={chartAccounts}
              isLoading={isLoading}
              periodStart={format(periodStart, 'yyyy-MM-dd')}
              periodEnd={format(periodEnd, 'yyyy-MM-dd')}
            />
          </TabsContent>

          <TabsContent value="income-statement" className="mt-6">
            <IncomeStatementReport
              journalEntries={journalEntries}
              chartAccounts={chartAccounts}
              isLoading={isLoading}
              periodStart={format(periodStart, 'yyyy-MM-dd')}
              periodEnd={format(periodEnd, 'yyyy-MM-dd')}
            />
          </TabsContent>

          <TabsContent value="balance-sheet" className="mt-6">
            <BalanceSheetReport
              journalEntries={journalEntries}
              chartAccounts={chartAccounts}
              isLoading={isLoading}
              referenceDate={format(periodEnd, 'yyyy-MM-dd')}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
