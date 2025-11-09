import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Search,
} from "lucide-react";
import { useAccountStore } from "@/stores/AccountStore";
// CORREÇÃO: Importar AppTransaction
import { useTransactionStore, AppTransaction } from "@/stores/TransactionStore"; 
import { calculateBillDetails } from "@/lib/dateUtils";
import { CreditCardBillCard } from "./CreditCardBillCard";
import { Account } from "@/types";
import { cn } from "@/lib/utils";

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
    // BUGFIX: Adicionar totalBalance ao handler
    totalBalance: number 
  ) => void;
}

export function CreditBillsPage({ onPayCreditCard }: CreditBillsPageProps) {
  const allAccounts = useAccountStore((state) => state.accounts);
  // allTransactions agora é do tipo AppTransaction[]
  const allTransactions = useTransactionStore((state) => state.transactions); 

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");

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

  // Memo para calcular os detalhes da fatura
  const billDetails = useMemo(() => {
    return filteredCreditAccounts.map((account) => {
      const accountTransactions = allTransactions.filter(
        (t) => t.account_id === account.id
      );

      // --- CORREÇÃO: Passar o tipo correto ---
      // Passa AppTransaction[] (com 'date' como objeto Date)
      const details = calculateBillDetails(
        accountTransactions as AppTransaction[], // Passa o tipo correto
        account
      );
      // --- FIM DA CORREÇÃO ---

      return {
        account,
        ...details,
      };
    });
  }, [filteredCreditAccounts, allTransactions]);

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
      <h1 className="text-title-1">Faturas de Cartão</h1>
      <p className="text-body text-muted-foreground">
        Acompanhe o vencimento e o limite dos seus cartões de crédito.
      </p>

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
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cartão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-2">
          <Button
            key="all"
            variant={selectedAccountId === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAccountId("all")}
            className="apple-interaction h-10 whitespace-nowrap"
          >
            Todos
          </Button>
          {creditAccounts.map((account) => (
            <Button
              key={account.id}
              variant={selectedAccountId === account.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedAccountId(account.id)}
              className="apple-interaction h-10 whitespace-nowrap"
            >
              {account.name}
            </Button>
          ))}
        </div>
      </div>

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
          {billDetails.map((details) => (
            <CreditCardBillCard
              key={details.account.id}
              account={details.account}
              billDetails={details}
              onPayBill={() =>
                // BUGFIX: Passar o details.totalBalance (dívida total)
                onPayCreditCard(
                  details.account,
                  details.currentBillAmount,
                  details.nextBillAmount,
                  details.totalBalance // Passa o saldo devedor total calculado
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}