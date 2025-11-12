import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAccountStore } from "@/stores/AccountStore";
import { useTransactionStore, AppTransaction } from "@/stores/TransactionStore"; 
import { calculateBillDetails } from "@/lib/dateUtils";
import { CreditCardBillCard } from "@/components/CreditCardBillCard";
import { CreditBillDetailsModal } from "@/components/CreditBillDetailsModal";
import { Account } from "@/types";
import { cn } from "@/lib/utils";
import { format, addMonths, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

// Helper para formatar moeda
const formatCents = (valueInCents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
};

interface CreditBillsPageProps {
  onPayCreditCard: (
    account: Account,
    currentBillAmount: number,
    nextBillAmount: number,
    totalBalance: number 
  ) => void;
  // Prop para o estorno (será adicionada no Index.tsx)
  onReversePayment: (paymentsToReverse: AppTransaction[]) => void; // <-- ADICIONADO
}

export function CreditBillsPage({ onPayCreditCard, onReversePayment }: CreditBillsPageProps) {
  const allAccounts = useAccountStore((state) => state.accounts);
  const allTransactions = useTransactionStore((state) => state.transactions); 

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = mês atual, 1 = próximo, -1 = anterior
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

  // Calcula a data base para o mês selecionado
  const selectedMonthDate = useMemo(() => {
    return addMonths(new Date(), selectedMonthOffset);
  }, [selectedMonthOffset]);

  // Formata o nome do mês para exibição
  const selectedMonthLabel = useMemo(() => {
    return format(selectedMonthDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [selectedMonthDate]);

  // Memo para calcular os detalhes da fatura do mês selecionado
  const billDetails = useMemo(() => {
    return filteredCreditAccounts.map((account) => {
      const accountTransactions = allTransactions.filter(
        (t) => t.account_id === account.id
      );

      const details = calculateBillDetails(
        accountTransactions as AppTransaction[],
        account,
        selectedMonthOffset // Passa o offset do mês selecionado
      );

      return {
        account,
        ...details,
      };
    });
  }, [filteredCreditAccounts, allTransactions, selectedMonthOffset]);

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
    <div className="spacing-responsive-lg fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-title-1">Faturas de Cartão</h1>
          <p className="text-body text-muted-foreground">
            Acompanhe o vencimento e o limite dos seus cartões de crédito.
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
                  Fatura Atual (Total)
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
                  Próxima Fatura (Total)
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
                  Limite Disponível (Total)
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
      <Card className="financial-card">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="py-4 sm:pt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cartão */}
              <div className="space-y-1.5">
                <Label htmlFor="filterCard">Cartão</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm" id="filterCard">
                    <SelectValue placeholder="Selecione um cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Cartões</SelectItem>
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

              {/* Período/Mês */}
              <div className="space-y-1.5">
                <Label>Período</Label>
                <div className="flex items-center gap-1 h-9 px-3 border border-input rounded-md bg-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMonthOffset(selectedMonthOffset - 1)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center">
                    <p className="text-xs sm:text-sm font-medium capitalize truncate">
                      {selectedMonthLabel}
                    </p>
                  </div>
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

              {/* Busca */}
              <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar cartão..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
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
              ? "Nenhum cartão encontrado"
              : "Nenhum cartão de crédito cadastrado"}
          </p>
          <p className="text-xs">
            {searchTerm
              ? "Tente ajustar sua busca."
              : 'Adicione um cartão na página "Contas" para vê-lo aqui.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {billDetails.map((details) => {
            const accountTransactions = allTransactions.filter(
              (t) => t.account_id === details.account.id
            ) as AppTransaction[];

            return (
              <CreditCardBillCard
                key={details.account.id}
                account={details.account} 
                billDetails={details}
                selectedMonth={selectedMonthDate}
                onPayBill={() =>
                  onPayCreditCard(
                    details.account,
                    details.currentBillAmount,
                    details.nextBillAmount,
                    details.totalBalance 
                  )
                }
                onReversePayment={() => onReversePayment(details.paymentTransactions)}
                onViewDetails={() =>
                  setSelectedBillForDetails({
                    account: details.account,
                    transactions: accountTransactions,
                    billDetails: details,
                  })
                }
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
            billing_cycle: format(selectedMonthDate, "MM/yyyy", { locale: ptBR }),
            due_date: new Date(
              selectedMonthDate.getFullYear(),
              selectedMonthDate.getMonth(),
              selectedBillForDetails.account.due_date || 1
            ),
            closing_date: new Date(
              selectedMonthDate.getFullYear(),
              selectedMonthDate.getMonth(),
              selectedBillForDetails.account.closing_date || 1
            ),
            total_amount: selectedBillForDetails.billDetails.currentBillAmount,
            paid_amount: selectedBillForDetails.billDetails.paymentTransactions.reduce(
              (sum, t) => sum + Math.abs(t.amount),
              0
            ),
            status: (() => {
              const due = Math.max(0, selectedBillForDetails.billDetails.currentBillAmount);
              const paid = selectedBillForDetails.billDetails.paymentTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);
              const closed = isPast(new Date(
                selectedMonthDate.getFullYear(),
                selectedMonthDate.getMonth(),
                selectedBillForDetails.account.closing_date || 1
              ));
              return closed && paid >= due ? "paid" : "pending";
            })(),
            minimum_payment: selectedBillForDetails.billDetails.currentBillAmount * 0.15,
            late_fee: 0,
            transactions: selectedBillForDetails.transactions.filter((t) => {
              const billStart = new Date(
                selectedMonthDate.getFullYear(),
                selectedMonthDate.getMonth() - 1,
                (selectedBillForDetails.account.closing_date || 1) + 1
              );
              const billEnd = new Date(
                selectedMonthDate.getFullYear(),
                selectedMonthDate.getMonth(),
                selectedBillForDetails.account.closing_date || 1
              );
              return t.type === "expense" && t.date >= billStart && t.date <= billEnd;
            }),
            account: selectedBillForDetails.account,
          }}
          onClose={() => setSelectedBillForDetails(null)}
        />
      )}
    </div>
  );
}