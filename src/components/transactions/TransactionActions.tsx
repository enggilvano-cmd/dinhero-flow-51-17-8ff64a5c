import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreVertical, CheckCircle } from "lucide-react";
import { EditScope } from "../InstallmentEditScopeDialog";

interface TransactionActionsProps {
  transaction: any;
  onEdit: (transaction: any) => void;
  onDelete: (transactionId: string, scope?: EditScope) => void;
  onMarkAsPaid?: (transaction: any) => void;
}

export function TransactionActions({
  transaction,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: TransactionActionsProps) {
  const handleDelete = () => {
    if (transaction.installments && transaction.installments > 1) {
      onDelete(transaction.id, 'current');
    } else {
      onDelete(transaction.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(transaction)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        {transaction.status === "pending" && onMarkAsPaid && (
          <DropdownMenuItem onClick={() => onMarkAsPaid(transaction)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Marcar como Pago
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
