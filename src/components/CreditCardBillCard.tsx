import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Account } from "@/types";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

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
  };
  onPayBill: () => void;
}

export function CreditCardBillCard({ account, billDetails, onPayBill }: CreditCardBillCardProps) {
  const { limit_amount = 0 } = account;
  
  // Usa billDetails.totalBalance (calculado em dateUtils)
  const limitUsedPercentage = limit_amount > 0 ? (billDetails.totalBalance / limit_amount) * 100 : 0;

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
        <span className="text-xs text-muted-foreground text-right whitespace-nowrap pl-2">
          Fecha dia {account.closing_date} <br/> Vence dia {account.due_date}
        </span>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1">
        {/* Saldo da Fatura Atual */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Fatura Atual (Vence dia {account.due_date})</p>
          <p className="text-2xl font-bold balance-negative">
            {/* Deve mostrar R$ 200,00 (ou o valor correto) */}
            {formatCents(billDetails.currentBillAmount)}
          </p>
        </div>
        
        {/* Detalhes de Limite */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Limite Utilizado</span>
            {/* Deve mostrar R$ 200,00 / R$ 2.000,00 */}
            <span>{formatCents(billDetails.totalBalance)} / {formatCents(limit_amount)}</span>
          </div>
          <Progress value={limitUsedPercentage} className="h-2" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Próxima Fatura (Parcial)</span>
            <span className="font-medium text-muted-foreground">{formatCents(billDetails.nextBillAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Limite Disponível</span>
            {/* Deve mostrar R$ 1.800,00 */}
            <span className={cn("font-medium", billDetails.availableLimit >= 0 ? "balance-positive" : "balance-negative")}>
              {formatCents(billDetails.availableLimit)}
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onPayBill} 
          // --- CORREÇÃO: Lógica do Botão ---
          // Desabilita apenas se não houver DÍVIDA TOTAL (Limite Utilizado)
          disabled={billDetails.totalBalance <= 0}
        >
          {/* Muda o texto se a fatura atual for 0, mas ainda houver dívida */}
          {billDetails.currentBillAmount <= 0 && billDetails.totalBalance > 0 ? "Pagar Valor Avulso" : "Pagar Fatura"}
        </Button>
      </CardFooter>
    </Card>
  );
}