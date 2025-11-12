import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Account, AppTransaction } from "@/types"; // Importa AppTransaction
import { CreditCard, RotateCcw, FileText } from "lucide-react"; // Importa RotateCcw e FileText
import { cn } from "@/lib/utils";
import { isPast } from 'date-fns';
import { Badge } from "@/components/ui/badge";

// Helper para formatar moeda
const formatCents = (valueInCents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
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
  selectedMonth, // <-- Prop ADICIONADA
  onPayBill, 
  onReversePayment,
  onViewDetails
}: CreditCardBillCardProps) {
  
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
  
  // Lógica de Status - usa o mês selecionado para determinar se a fatura está fechada
  const closingDate = closing_date 
    ? new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), closing_date) 
    : selectedMonth;
  const isClosed = isPast(closingDate);
  
  // --- LÓGICA DE PAGO ATUALIZADA ---
  const paidAmount = (paymentTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0)) || 0;
  const amountDue = Math.max(0, currentBillAmount);
  const isPaid = paidAmount >= amountDue || amountDue === 0;
  const isBillPaid = isPaid;
  const isFullyPaid = isPaid && totalBalance <= 0;
  const canReverse = paymentTransactions && paymentTransactions.length > 0;
  // --- FIM DA LÓGICA ---

  const billAmountColor = currentBillAmount > 0 
    ? "balance-negative" 
    : currentBillAmount < 0 
    ? "balance-negative" 
    : "text-muted-foreground";
  
  const billLabel = currentBillAmount < 0 
    ? "Crédito na Fatura" 
    : `Fatura Atual (Vence dia ${due_date || 'N/A'})`;

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
            {isClosed ? 'Fechada' : 'Aberta'}
          </Badge>
          {/* Badge de Pago/Pendente baseado no fechamento + pagamentos */}
          <Badge variant={isClosed && isPaid ? 'default' : 'destructive'}>
            {isClosed && isPaid ? 'Pago' : 'Pendente'}
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
            <span>Limite Utilizado</span>
            <span>{formatCents(totalBalance)} / {formatCents(limit_amount)}</span>
          </div>
          <Progress value={limitUsedPercentage} className="h-2" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Próxima Fatura (Parcial)</span>
            <span className="font-medium text-muted-foreground">{formatCents(nextBillAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Limite Disponível</span>
            <span className={cn("font-medium", availableLimit >= 0 ? "balance-positive" : "balance-negative")}>
              {formatCents(availableLimit)}
            </span>
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
              Estornar
            </Button>
          )}
          
        <Button 
          type="button"
          className="flex-1" 
          onClick={onPayBill} 
        >
          {isBillPaid && !isFullyPaid ? "Pagar Avulso" : "Pagar Fatura"}
        </Button>
        </div>
        
        <Button 
          variant="secondary" 
          className="w-full" 
          onClick={onViewDetails}
        >
          <FileText className="h-4 w-4 mr-2" />
          Ver Detalhes da Fatura
        </Button>
      </CardFooter>
      {/* --- FIM DO NOVO --- */}
    </Card>
  );
}