import { useState, useMemo } from "react";
import { useSettings } from "@/context/SettingsContext";
import { logger } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CreditBillFilterDialog } from "@/components/creditbills/CreditBillFilterDialog";
import { CreditBillFilterChips } from "@/components/creditbills/CreditBillFilterChips";

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
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
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

  // Generate filter chips
  const filterChips = useMemo(() => {
    const chips = [];

    // Account filter
    if (selectedAccountId !== "all") {
      const account = creditAccounts.find((a) => a.id === selectedAccountId);
      if (account) {
        chips.push({
          id: "account",
          label: `Cartão: ${account.name}`,
          value: selectedAccountId,
          color: account.color,
          onRemove: () => setSelectedAccountId("all"),
        });
      }
    }

    // Bill status filter
    if (filterBillStatus !== "all") {
      const billStatusLabels = {
        open: "Aberta",
        closed: "Fechada",
      };
      chips.push({
        id: "billStatus",
        label: `Status: ${billStatusLabels[filterBillStatus as keyof typeof billStatusLabels]}`,
        value: filterBillStatus,
        onRemove: () => setFilterBillStatus("all"),
      });
    }

    // Payment status filter
    if (filterPaymentStatus !== "all") {
      const paymentStatusLabels = {
        paid: "Pago",
        pending: "Pendente",
      };
      chips.push({
        id: "paymentStatus",
        label: `Pagamento: ${paymentStatusLabels[filterPaymentStatus as keyof typeof paymentStatusLabels]}`,
        value: filterPaymentStatus,
        onRemove: () => setFilterPaymentStatus("all"),
      });
    }

    return chips;
  }, [
    selectedAccountId,
    filterBillStatus,
    filterPaymentStatus,
    creditAccounts,
    setSelectedAccountId,
    setFilterBillStatus,
    setFilterPaymentStatus,
  ]);

  const clearAllFilters = () => {
    setSelectedAccountId("all");
    setFilterBillStatus("all");
    setFilterPaymentStatus("all");
  };

  // Memo para calcular os detalhes da fatura do mês selecionado (alinhado ao mês exibido)
  const allBillDetails = useMemo(() => {
    logger.debug('Recalculando faturas...', updateKey);

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

      // Base (limite, saldo total, meses de referência)
      const base = calculateBillDetails(
        accountTransactions,
        account,
        selectedMonthOffset
      );

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
        // Calcula o limite usado: limite total - limite disponível
        const limitAmount = details.account.limit_amount || 0;
        acc.usedLimit += limitAmount - details.availableLimit;
        return acc;
      },
      { currentBill: 0, nextBill: 0, availableLimit: 0, usedLimit: 0 }
    );
  }, [billDetails]);

  // Mês de fatura selecionado (baseado no mês da fatura, não no mês corrente do calendário)
  const selectedInvoiceMonthDate = useMemo(() => {
    const baseMonth = billDetails[0]?.currentInvoiceMonth;
    if (!baseMonth) return selectedMonthDate;

    const [year, month] = baseMonth.split("-").map(Number);
    if (!year || !month) return selectedMonthDate;

    return new Date(year, month - 1, 1);
  }, [billDetails, selectedMonthDate]);

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">

      {/* CARDS DE TOTAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Card Fatura Atual */}
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-caption font-medium">
                  Fatura Atual
                </p>
                <div className="balance-text balance-negative">
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
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-caption font-medium">
                  Próxima Fatura
                </p>
                <div className="balance-text text-muted-foreground">
                  {formatCents(totalSummary.nextBill)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Limite Usado */}
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-caption font-medium">
                  Limite Usado
                </p>
                <div className="balance-text text-warning">
                  {formatCents(totalSummary.usedLimit)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Limite Disponível */}
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-caption font-medium">
                  Disponível
                </p>
                <div
                  className={cn(
                    "balance-text",
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

      {/* SEÇÃO DE FILTROS - ESTILO CHIPS */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Top bar: Filter button, chips, and search */}
          <div className="flex flex-col gap-4">
            {/* Filter button and active chips */}
            <div className="flex flex-wrap items-center gap-3">
              <CreditBillFilterDialog
                open={filterDialogOpen}
                onOpenChange={setFilterDialogOpen}
                selectedAccountId={selectedAccountId}
                onAccountChange={setSelectedAccountId}
                filterBillStatus={filterBillStatus}
                onBillStatusChange={(value) => setFilterBillStatus(value as any)}
                filterPaymentStatus={filterPaymentStatus}
                onPaymentStatusChange={(value) => setFilterPaymentStatus(value as any)}
                creditAccounts={creditAccounts}
                activeFiltersCount={filterChips.length}
              />
              
              <CreditBillFilterChips
                chips={filterChips}
                onClearAll={clearAllFilters}
              />
            </div>

            {/* Search and Period Navigation */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cartões..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Period Navigation */}
              <div className="flex items-center gap-2 px-3 border border-input rounded-md bg-background min-w-[220px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonthOffset(selectedMonthOffset - 1)}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center text-sm font-medium">
                  {format(selectedInvoiceMonthDate, "MMM/yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonthOffset(selectedMonthOffset + 1)}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
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