import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Account } from "@/types";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

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
    totalBalance: number; // Este é o saldo devedor total (limite utilizado)
    availableLimit: number;
  };
  onPayBill: () => void;
  // onDetails: () => void; // Removido por enquanto, pois CreditBillsPage não o usa
}

export function CreditCardBillCard({ account, billDetails, onPayBill }: CreditCardBillCardProps) {
  
  // A verificação de guarda agora está correta.
  if (!account || !billDetails) {
    return null
  }

  const { limit_amount = 0, closing_date, due_date } = account;
  const { currentBillAmount, nextBillAmount, totalBalance, availableLimit } = billDetails;

  // Calcula o percentual de limite usado
  const limitUsedPercentage = limit_amount > 0 ? (totalBalance / limit_amount) * 100 : 0;
  
  // Lógica de Status
  // Usa a data de fechamento da conta, se existir
  const closingDate = closing_date ? new Date().setUTCDate(closing_date) : new Date();
  const isClosed = isPast(closingDate); 
  const isPaid = currentBillAmount <= 0; // Se a fatura atual é 0 ou negativa (crédito), está paga

  // Determina a cor com base no valor da fatura (pode ser negativo/crédito)
  const billAmountColor = currentBillAmount > 0 
    ? "balance-negative" 
    : currentBillAmount < 0 
    ? "balance-positive" 
    : "text-muted-foreground";
  
  // Determina o rótulo com base no valor
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
          <Badge variant={isPaid ? 'default' : 'destructive'}>
            {isPaid ? 'Paga' : 'Pendente'}
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
      
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onPayBill} 
          // Desabilita apenas se não houver DÍVIDA TOTAL (Limite Utilizado)
          disabled={totalBalance <= 0}
        >
          {/* Muda o texto se a fatura atual for 0 ou paga, mas ainda houver dívida total */}
          {isPaid && totalBalance > 0 ? "Pagar Valor Avulso" : "Pagar Fatura"}
        </Button>
      </CardFooter>
    </Card>
  );
}