import { Account, Transaction, CreditBill } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { format, isPast } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface CreditBillDetailsModalProps {
  bill: (CreditBill & { account: Account } & { transactions: Transaction[] }) | null
  onClose: () => void
}

export function CreditBillDetailsModal({ bill, onClose }: CreditBillDetailsModalProps) {
  if (!bill) return null

  const paidAmount = bill.paid_amount
  const remainingAmount = bill.total_amount - paidAmount
  const isClosed = isPast(new Date(bill.closing_date))
  const isPaid = remainingAmount <= 0

  return (
    <Dialog open={!!bill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <div className="flex justify-between items-center">
              <span>
                {bill.account.name} - {format(new Date(bill.due_date), 'MMMM/yyyy', { locale: ptBR })}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <Badge variant={isClosed ? 'secondary' : 'outline'}>
                  {isClosed ? 'Fechada' : 'Aberta'}
                </Badge>
                <Badge variant={isPaid ? 'default' : 'destructive'}>
                  {isPaid ? 'Paga' : 'Pendente'}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Vencimento em {format(new Date(bill.due_date), 'dd/MM/yyyy', { locale: ptBR })} | Fechamento em {format(new Date(bill.closing_date), 'dd/MM/yyyy', { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-500">Valor Total</div>
            <div className="text-2xl font-bold">{formatCurrency(bill.total_amount)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-green-600">Pago: {formatCurrency(paidAmount)}</div>
            <div className="text-sm text-red-600">Restante: {formatCurrency(remainingAmount)}</div>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.transactions
                .filter(t => t.type === 'expense' && t.category_id) // Apenas despesas categorizadas (compras)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(new Date(transaction.date), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}