import { useState, useMemo } from "react";
import { useSettings } from "@/context/SettingsContext";
import { logger } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTransactions } from "@/hooks/queries/useTransactions";
import { useAccounts } from "@/hooks/queries/useAccounts";
import { AppTransaction, Account } from "@/types";
import { calculateBillDetails, calculateInvoiceMonthByDue } from "@/lib/dateUtils";
import { CreditCardBillCard } from "@/components/CreditCardBillCard";
import { CreditBillDetailsModal } from "@/components/CreditBillDetailsModal";
import { cn } from "@/lib/utils";
import { format, addMonths, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

// This will be replaced with a method inside the component

interface CreditBillsPageProps {
  onPayCreditCard: (
    account: Account,
    currentBillAmount: number,
    nextBillAmount: number,
    totalBalance: number 
  ) => void;
  // Prop para o estorno (será adicionada no Index.tsx)
  onReversePayment: (paymentsToReverse: AppTransaction[]) => void;
}

export function CreditBillsPage({ onPayCreditCard, onReversePayment }: CreditBillsPageProps) {
  const { accounts: allAccounts = [] } = useAccounts();
  const { transactions: allTransactions = [] } = useTransactions({ 
    page: 0, 
    pageSize: 10000, // Carrega todas as transações de cartão
    type: 'all',
    accountType: 'credit'
  });
  const { settings } = useSettings();
  
  // Força atualização quando contas ou transações mudam
  const updateKey = useMemo(() => {
    const key = `${allAccounts.length}-${allTransactions.length}-${allAccounts.map(a => a.balance).join(',').substring(0, 50)}`;
    logger.debug('CreditBillsPage updateKey:', key, { accounts: allAccounts.length, transactions: allTransactions.length });
    return key;
  }, [allAccounts, allTransactions]);

  // Helper para formatar moeda
  const formatCents = (valueInCents: number) => {
    return new Intl.NumberFormat(settings.language === 'pt-BR' ? 'pt-BR' : settings.language === 'es-ES' ? 'es-ES' : 'en-US', {
      style: "currency",
      currency: settings.currency,
    }).format(valueInCents / 100);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = mês atual (pré-selecionado)
  const [filterBillStatus, setFilterBillStatus] = useState<"all" | "open" | "closed">("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<"all" | "paid" | "pending">("all");
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<{
    account: Account;
    transactions: AppTransaction[];
    billDetails: ReturnType<typeof calculateBillDetails>;
  } | null>(null);

  const creditAccounts = useMemo(() => {
    return allAccounts
      .filter((acc) => acc.type === "credit")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAccounts]);

  const filteredCreditAccounts = useMemo(() => {
    return creditAccounts.filter((account) => {
      const matchesSearch = account.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesId =
        selectedAccountId === "all" || account.id === selectedAccountId;
      return matchesSearch && matchesId;
    });
  }, [creditAccounts, searchTerm, selectedAccountId]);

  // Calcula a data base para o mês selecionado (sempre navegação por mês)
  const selectedMonthDate = useMemo(() => {
    return addMonths(new Date(), selectedMonthOffset);
  }, [selectedMonthOffset]);

  // Memo para calcular os detalhes da fatura do mês selecionado (alinhado ao mês exibido)
  const allBillDetails = useMemo(() => {
    logger.debug('Recalculando faturas...', updateKey);
    
    console.log('🔍 [CreditBillsPage] Debug:', {
      creditAccounts: filteredCreditAccounts.length,
      allTransactions: allTransactions.length,
      selectedMonthOffset,
      sampleTransaction: allTransactions[0],
    });

    return filteredCreditAccounts.map((account) => {
      const accountTransactions = allTransactions
        .filter((t) => t.account_id === account.id)
        .map((t) => ({
          ...t,
          date:
            typeof t.date === "string"
              ? new Date(t.date + "T00:00:00")
              : t.date,
        })) as AppTransaction[];

      console.log(`🔍 [CreditBillsPage] Conta ${account.name}:`, {
        accountId: account.id,
        transactionsCount: accountTransactions.length,
        closingDate: account.closing_date,
        dueDate: account.due_date,
      });

      // Base (limite, saldo total, meses de referência)
      const base = calculateBillDetails(
        accountTransactions,
        account,
        selectedMonthOffset
      );

      console.log(`🔍 [CreditBillsPage] Bill details base:`, {
        account: account.name,
        currentInvoiceMonth: base.currentInvoiceMonth,
        nextInvoiceMonth: base.nextInvoiceMonth,
        currentBillAmount: base.currentBillAmount,
        nextBillAmount: base.nextBillAmount,
      });

      // Usar SEMPRE os meses calculados pela função base, com fallback seguro
      const targetMonth = base.currentInvoiceMonth ?? format(selectedMonthDate, "yyyy-MM");
      const nextMonth = base.nextInvoiceMonth ?? format(addMonths(selectedMonthDate, 1), "yyyy-MM");

      // Usa invoice_month salvo apenas se for override manual; senão calcula pela data
      const effectiveMonth = (
        d: Date,
        savedInvoiceMonth?: string | null,
        overridden?: boolean | null
      ) =>
        overridden && savedInvoiceMonth
          ? savedInvoiceMonth
          : account.closing_date
          ? calculateInvoiceMonthByDue(
              d,
              account.closing_date,
              account.due_date || 1
            )
          : format(d, "yyyy-MM");

      let currentBillAmount = 0;
      let nextBillAmount = 0;
      const paymentTransactions: AppTransaction[] = [];

      for (const t of accountTransactions) {
        const d =
          typeof t.date === "string" ? new Date(t.date) : (t.date as Date);
        if (!d || isNaN(d.getTime())) continue;

        // APENAS transações concluídas devem ser contabilizadas
        if (t.status !== "completed") continue;

        const eff = effectiveMonth(d, t.invoice_month, t.invoice_month_overridden);
        
        console.log(`🔍 [CreditBillsPage] Transação ${t.description}:`, {
          date: format(d, 'yyyy-MM-dd'),
          amount: t.amount,
          type: t.type,
          invoiceMonth: t.invoice_month,
          invoiceMonthOverridden: t.invoice_month_overridden,
          effectiveMonth: eff,
          targetMonth,
          matchesTarget: eff === targetMonth,
        });
        
        if (eff === targetMonth) {
          if (t.type === "expense") currentBillAmount += Math.abs(t.amount);
          else if (t.type === "income") {
            currentBillAmount -= Math.abs(t.amount);
            paymentTransactions.push(t as AppTransaction);
          }
        } else if (eff === nextMonth && t.type === "expense") {
          nextBillAmount += Math.abs(t.amount);
        }
      }

      console.log(`🔍 [CreditBillsPage] Valores finais ${account.name}:`, {
        currentBillAmount,
        nextBillAmount,
        targetMonth,
        nextMonth,
      });

      return {
        account,
        ...base,
        currentBillAmount,
        nextBillAmount,
        paymentTransactions,
        currentInvoiceMonth: targetMonth,
        nextInvoiceMonth: nextMonth,
      };
    });
  }, [
    filteredCreditAccounts,
    allTransactions,
    selectedMonthDate,
    selectedMonthOffset,
    updateKey,
  ]);

  // Memo para aplicar os filtros de status
  const billDetails = useMemo(() => {
    return allBillDetails.filter((details) => {
      // Calcula se a fatura está fechada baseado no mês da fatura (não no mês selecionado)
      // Ex: Se estamos vendo a fatura de nov/2025 e hoje é dez/2025, precisa verificar se 08/nov já passou
      const targetMonth = details.currentInvoiceMonth || format(selectedMonthDate, 'yyyy-MM'); // Ex: "2025-11"
      const [year, month] = targetMonth.split('-').map(Number);
      
      const closingDate = details.account.closing_date 
        ? new Date(year, month - 1, details.account.closing_date) 
        : new Date(year, month - 1, 1);
      
      const isClosed = isPast(closingDate);

      // Filtro de status da fatura (aberta/fechada)
      if (filterBillStatus === "open" && isClosed) return false;
      if (filterBillStatus === "closed" && !isClosed) return false;

      // Calcula se está paga
      const paidAmount = details.paymentTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const amountDue = Math.max(0, details.currentBillAmount);
      // Uma fatura está "Paga" se:
      // 1. Não há valor a pagar (amountDue <= 0) - conta tem crédito
      // 2. OU o valor pago é igual ou maior que o valor devido (com margem de 1 centavo)
      const isPaid = amountDue <= 0 || paidAmount >= (amountDue - 1);

      logger.debug("[CreditBillsPage] Status check", {
        account: details.account.name,
        targetMonth,
        closingDate: format(closingDate, 'dd/MM/yyyy'),
        isClosed,
        currentBillAmount: details.currentBillAmount,
        paidAmount,
        amountDue,
        isPaid,
      });

      // Filtro de status de pagamento
      if (filterPaymentStatus === "paid" && !isPaid) return false;
      if (filterPaymentStatus === "pending" && isPaid) return false;

      return true;
    });
  }, [allBillDetails, filterBillStatus, filterPaymentStatus, updateKey]);

  // Memo para os TOTAIS (baseado nos cartões filtrados)
  const totalSummary = useMemo(() => {
    return billDetails.reduce(
      (acc, details) => {
        acc.currentBill += details.currentBillAmount;
        acc.nextBill += details.nextBillAmount;
        acc.availableLimit += details.availableLimit;
        return acc;
      },
      { currentBill: 0, nextBill: 0, availableLimit: 0 }
    );
  }, [billDetails]);

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-system-h1 leading-tight">Faturas de Cartão</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            Gerencie as faturas dos seus cartões de crédito
          </p>
        </div>
      </div>

      {/* CARDS DE TOTAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {/* Card Fatura Atual */}
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Fatura Atual
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-negative leading-tight">
                  {/* BUGFIX: Corrigido para mostrar o valor correto, mesmo se for crédito (negativo) */}
                  {formatCents(Math.max(0, totalSummary.currentBill))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Próxima Fatura */}
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Próxima Fatura
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold text-muted-foreground leading-tight">
                  {formatCents(totalSummary.nextBill)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Limite Disponível */}
        <Card className="financial-card sm:col-span-2 xl:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Disponível
                </p>
                <div
                  className={cn(
                    "text-base sm:text-lg lg:text-xl font-bold leading-tight",
                    totalSummary.availableLimit >= 0
                      ? "balance-positive"
                      : "balance-negative"
                  )}
                >
                  {formatCents(totalSummary.availableLimit)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO DE FILTROS */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Cartão */}
            <div className="lg:col-span-1">
              <Label htmlFor="filterCard" className="text-caption">Cartão de Crédito</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="touch-target mt-2" id="filterCard">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {creditAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: account.color || "#6b7280",
                          }}
                        />
                        <span className="truncate">{account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status da Fatura (Aberta/Fechada) */}
            <div className="lg:col-span-1">
              <Label htmlFor="filterBillStatus" className="text-caption">Status da Fatura</Label>
              <Select value={filterBillStatus} onValueChange={(value: any) => setFilterBillStatus(value)}>
                <SelectTrigger className="touch-target mt-2" id="filterBillStatus">
                  <SelectValue placeholder="Status da Fatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="closed">Fechada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status de Pagamento */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="filterPaymentStatus" className="text-caption">Pagamento</Label>
              <Select value={filterPaymentStatus} onValueChange={(value: any) => setFilterPaymentStatus(value)}>
                <SelectTrigger className="touch-target mt-2" id="filterPaymentStatus">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {/* Busca */}
            <div className="lg:col-span-1">
              <Label htmlFor="search" className="text-caption">Buscar</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>

            {/* Navegação de Mês */}
            <div className="lg:col-span-1">
              <Label className="text-caption">Período</Label>
              <div className="flex items-center gap-1 px-3 border border-input rounded-md bg-background touch-target mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonthOffset(selectedMonthOffset - 1)}
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="flex-1 text-center text-system-body">
                  {format(selectedMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonthOffset(selectedMonthOffset + 1)}
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RENDERIZAÇÃO DOS CARDS */}
      {billDetails.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm font-medium">
            {searchTerm
              ? "Nenhum resultado encontrado"
              : "Nenhuma fatura de cartão encontrada"}
          </p>
          <p className="text-xs">
            {searchTerm
              ? "Tente novamente com outros termos"
              : "Adicione sua primeira conta para começar"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {billDetails.map((details) => {
            const accountTransactions = allTransactions.filter(
              (t) => t.account_id === details.account.id
            ).map(t => ({
              ...t,
              date: typeof t.date === 'string' ? new Date(t.date + 'T00:00:00') : t.date
            })) as AppTransaction[];

            // Calcula a dívida total real (soma das faturas atual e próxima)
            const totalDebt = Math.max(0, details.currentBillAmount) + Math.max(0, details.nextBillAmount);
            
            return (
              <CreditCardBillCard
                key={`${details.account.id}-${updateKey}`}
                account={details.account} 
                billDetails={details}
                selectedMonth={selectedMonthDate}
                onPayBill={() =>
                  onPayCreditCard(
                    details.account,
                    details.currentBillAmount,
                    details.nextBillAmount,
                    totalDebt // Passa a dívida total correta (soma das faturas)
                  )
                }
                onReversePayment={() => onReversePayment(details.paymentTransactions)}
                onViewDetails={() => {
                  // Filtrar transações apenas da fatura corrente calculada (YYYY-MM)
                  const currentMonth = details.currentInvoiceMonth || '';
                  const filtered = accountTransactions.filter((t) => {
                    // APENAS transações concluídas devem aparecer nos detalhes
                    if (t.status !== 'completed') return false;
                    
                    const tDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
                    if (!tDate || isNaN(tDate.getTime())) return false;
                    const eff = (t.invoice_month_overridden && t.invoice_month)
                      ? t.invoice_month
                      : (details.account.closing_date
                          ? calculateInvoiceMonthByDue(
                              tDate,
                              details.account.closing_date,
                              details.account.due_date || 1
                            )
                          : format(tDate, 'yyyy-MM'));
                    return t.type === 'expense' && eff === currentMonth;
                  });

                  setSelectedBillForDetails({
                    account: details.account,
                    transactions: filtered.map(t => ({
                      ...t,
                      date: typeof t.date === 'string' ? new Date(t.date + 'T00:00:00') : t.date
                    })) as AppTransaction[],
                    billDetails: details,
                  });
                }}
              />
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes da Fatura */}
      {selectedBillForDetails && (
        <CreditBillDetailsModal
          bill={{
            id: selectedBillForDetails.account.id,
            account_id: selectedBillForDetails.account.id,
            billing_cycle: selectedBillForDetails.billDetails.currentInvoiceMonth || format(selectedMonthDate, "yyyy-MM"),
            due_date: (() => {
              // Calcular a data de vencimento correta baseada no mês da fatura
              const invoiceMonth = selectedBillForDetails.billDetails.currentInvoiceMonth || format(selectedMonthDate, "yyyy-MM");
              const [year, month] = invoiceMonth.split('-').map(Number);
              return new Date(year, month - 1, selectedBillForDetails.account.due_date || 1);
            })(),
            closing_date: (() => {
              // Calcular a data de fechamento correta baseada no mês da fatura
              const invoiceMonth = selectedBillForDetails.billDetails.currentInvoiceMonth || format(selectedMonthDate, "yyyy-MM");
              const [year, month] = invoiceMonth.split('-').map(Number);
              return new Date(year, month - 1, selectedBillForDetails.account.closing_date || 1);
            })(),
            total_amount: selectedBillForDetails.billDetails.currentBillAmount,
            paid_amount: selectedBillForDetails.billDetails.paymentTransactions.reduce(
              (sum, t) => sum + Math.abs(t.amount),
              0
            ),
            status: (() => {
              // Recalcular status correto baseado na data de fechamento do mês da fatura
              const invoiceMonth = selectedBillForDetails.billDetails.currentInvoiceMonth || format(selectedMonthDate, "yyyy-MM");
              const [year, month] = invoiceMonth.split('-').map(Number);
              const closingDateOfBill = new Date(year, month - 1, selectedBillForDetails.account.closing_date || 1);
              const isClosed = isPast(closingDateOfBill);
              
              const due = Math.max(0, selectedBillForDetails.billDetails.currentBillAmount);
              const paid = selectedBillForDetails.billDetails.paymentTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);
              
              // Pago se não há valor a pagar OU se está fechada e foi paga
              return due <= 0 || (isClosed && paid >= due) ? "paid" : "pending";
            })(),
            minimum_payment: selectedBillForDetails.billDetails.currentBillAmount * 0.15,
            late_fee: 0,
            // CORREÇÃO: As transações já foram filtradas corretamente no onViewDetails
            transactions: selectedBillForDetails.transactions.filter((t) => {
              // Garante que são apenas despesas (compras) - pagamentos não aparecem aqui
              return t.type === 'expense' && t.category_id;
            }),
            account: selectedBillForDetails.account,
          }}
          onClose={() => setSelectedBillForDetails(null)}
        />
      )}
    </div>
  );
}