import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";

interface ValidationResult {
  transactionId: string | null;
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  description: string;
  entryDate: string;
}

interface DoubleEntryAlertProps {
  validationResults: ValidationResult[];
  totalUnbalancedTransactions: number;
}

export function DoubleEntryAlert({ validationResults, totalUnbalancedTransactions }: DoubleEntryAlertProps) {
  if (totalUnbalancedTransactions === 0) {
    return null;
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-headline flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Partidas Dobradas Desbalanceadas Detectadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-body-large">Erro de Integridade Contábil</AlertTitle>
          <AlertDescription className="text-body">
            <strong>{totalUnbalancedTransactions}</strong> transação(ões) com lançamentos desbalanceados encontrada(s).
            O princípio contábil fundamental requer que <strong>Débitos = Créditos</strong> para cada transação.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="text-body-large font-semibold">Transações Desbalanceadas:</h4>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {validationResults.map((result, index) => (
              <div
                key={result.transactionId || `unbalanced-${index}`}
                className="p-3 border border-destructive/20 rounded-lg bg-destructive/5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-caption">
                        Desbalanceada
                      </Badge>
                      {result.entryDate && (
                        <span className="text-caption text-muted-foreground">
                          {format(new Date(result.entryDate), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                    <p className="text-caption font-medium">{result.description}</p>
                    {result.transactionId && (
                      <p className="text-caption text-muted-foreground font-mono">
                        ID: {result.transactionId.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-caption text-muted-foreground">Débitos:</span>
                      <span className="text-caption font-mono">{formatCurrency(result.totalDebits)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-caption text-muted-foreground">Créditos:</span>
                      <span className="text-caption font-mono">{formatCurrency(result.totalCredits)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-destructive/20">
                      <span className="text-caption font-semibold text-destructive">Diferença:</span>
                      <span className="text-caption font-mono font-semibold text-destructive">
                        {formatCurrency(result.difference)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-caption text-muted-foreground">
            <strong>Ação Recomendada:</strong> Revise e corrija os lançamentos contábeis das transações listadas acima.
            Cada transação deve ter débitos e créditos iguais para manter a integridade contábil do sistema.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
