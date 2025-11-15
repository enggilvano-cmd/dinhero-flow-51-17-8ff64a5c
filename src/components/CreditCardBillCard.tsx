import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Account, AppTransaction } from "@/types";
import { CreditCard, RotateCcw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPast } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/context/SettingsContext";

// Helper para formatar moeda
const formatCentsHelper = (valueInCents: number, currency: string, language: string) => {
  return new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : language === 'es-ES' ? 'es-ES' : 'en-US', {
    style: "currency",
    currency: currency,
  }).format(valueInCents / 100);
};

interface CreditCardBillCardProps {
  account: Account;
  billDetails: {
    currentBillAmount: number;
    nextBillAmount: number;
    totalBalance: number; 
    availableLimit: number;
    paymentTransactions: AppTransaction[];
  };
  selectedMonth: Date; // <-- Prop ADICIONADA para o mês selecionado
  onPayBill: () => void;
  onReversePayment: () => void;
  onViewDetails: () => void;
}

export function CreditCardBillCard({ 
  account, 
  billDetails,
  selectedMonth,
  onPayBill, 
  onReversePayment,
  onViewDetails
}: CreditCardBillCardProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  
  const formatCents = (valueInCents: number) => {
    return formatCentsHelper(valueInCents, settings.currency, settings.language);
  };
  
  if (!account || !billDetails) {
    return null
  }

  const { limit_amount = 0, closing_date, due_date } = account;
  const { 
    currentBillAmount, 
    nextBillAmount, 
    totalBalance, 
    availableLimit,
    paymentTransactions // <-- Prop ADICIONADA
  } = billDetails;

  // Calcula o percentual de limite usado
  const limitUsedPercentage = limit_amount > 0 ? (totalBalance / limit_amount) * 100 : 0;
  
  // Lógica de Status - calcula a data de fechamento do mês da fatura
  // billDetails já vem filtrado pelo mês correto (currentInvoiceMonth)
  // Precisamos usar esse mês para calcular se está fechada
  // selectedMonth é o mês que o usuário está visualizando (pode ser passado, atual, futuro)
  const closingDate = closing_date 
    ? new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), closing_date) 
    : selectedMonth;
  const isClosed = isPast(closingDate);
  
  // --- LÓGICA DE PAGO ATUALIZADA ---
  const paidAmount = (paymentTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0)) || 0;
  const amountDue = Math.max(0, currentBillAmount);
  
  // Uma fatura está "Paga" se:
  // 1. Não há valor a pagar (amountDue <= 0, ou seja, crédito ou zero)
  // 2. OU está fechada E o valor pago >= valor devido
  const isPaid = amountDue <= 0 || (isClosed && paidAmount >= amountDue);
  const isBillPaid = isPaid;
  const isFullyPaid = isPaid && totalBalance <= 0;
  
  // Botão de estorno só aparece quando a fatura está PAGA e há pagamentos
  const canReverse = isPaid && paymentTransactions && paymentTransactions.length > 0;
  
  console.info("[CreditCardBillCard] Status", {
    account: account.name,
    selectedMonth: selectedMonth.toISOString().split('T')[0],
    closingDate: closingDate.toISOString().split('T')[0],
    isClosed,
    currentBillAmount,
    paidAmount,
    amountDue,
    isPaid,
  });
  // --- FIM DA LÓGICA ---

  const billAmountColor = currentBillAmount > 0 
    ? "balance-negative" 
    : currentBillAmount < 0 
    ? "balance-negative" 
    : "text-muted-foreground";
  
  const billLabel = currentBillAmount < 0 
    ? t("creditBills.currentBill")
    : `${t("creditBills.currentBill")} (${t("creditBills.dueDate")} ${due_date || 'N/A'})`;

  return (
    <Card className="financial-card flex flex-col shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: account.color || "#6b7280" }}
          >
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="truncate" title={account.name}>{account.name}</span>
        </CardTitle>
        <div className="flex gap-2 flex-shrink-0">
          <Badge variant={isClosed ? 'secondary' : 'outline'}>
            {isClosed ? t("transactions.completed") : t("transactions.pending")}
          </Badge>
          {/* Badge de Pago/Pendente baseado no fechamento + pagamentos */}
          <Badge variant={isPaid ? 'default' : 'destructive'}>
            {isPaid ? t("transactions.completed") : t("transactions.pending")}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1">
        {/* Saldo da Fatura Atual */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{billLabel}</p>
          <p className={cn("text-2xl font-bold", billAmountColor)}>
            {formatCents(currentBillAmount)}
          </p>
        </div>
        
        {/* Detalhes de Limite */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("accounts.used")}</span>
            <span>{formatCents(totalBalance)} / {formatCents(limit_amount)}</span>
          </div>
          <Progress value={limitUsedPercentage} className="h-2" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("creditBills.nextBill")}</span>
            <span className="font-medium text-muted-foreground">{formatCents(nextBillAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("accounts.available")}</span>
            <span className={cn("font-medium", availableLimit >= 0 ? "balance-positive" : "balance-negative")}>
              {formatCents(availableLimit)}
            </span>
          </div>
          <div className="flex justify-between text-xs border-t pt-2 mt-2">
            <span className="text-muted-foreground">{t("creditBills.closingDate")}</span>
            <span className="font-medium">{t("dashboard.daily")} {closing_date || 'N/A'}</span>
          </div>
        </div>
      </CardContent>
      
      {/* --- NOVO: Botões de Ação --- */}
      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          {canReverse && (
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onReversePayment}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("common.cancel")}
            </Button>
          )}
          
        <Button 
          type="button"
          className="flex-1" 
          onClick={onPayBill} 
        >
          {isBillPaid && !isFullyPaid ? t("accounts.payBill") : t("accounts.payBill")}
        </Button>
        </div>
        
        <Button 
          variant="secondary" 
          className="w-full" 
          onClick={onViewDetails}
        >
          <FileText className="h-4 w-4 mr-2" />
          {t("creditBills.viewDetails")}
        </Button>
      </CardFooter>
      {/* --- FIM DO NOVO --- */}
    </Card>
  );
}