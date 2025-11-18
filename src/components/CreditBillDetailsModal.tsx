import { Account, Transaction, CreditBill } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { format, isPast } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTranslation } from 'react-i18next'
import { logger } from '@/lib/logger'

interface CreditBillDetailsModalProps {
  bill: (CreditBill & { account: Account } & { transactions: Transaction[] }) | null
  onClose: () => void
}

export function CreditBillDetailsModal({ bill, onClose }: CreditBillDetailsModalProps) {
  const { t } = useTranslation();
  
  if (!bill) return null

  const paidAmount = bill.paid_amount
  const remainingAmount = bill.total_amount - paidAmount
  
  // Calcular se está fechada baseado no mês da fatura
  // billing_cycle pode estar em formato "MM/yyyy" ou "yyyy-MM"
  let billMonth = bill.billing_cycle;
  if (billMonth.includes('/')) {
    // Converter "11/2025" para "2025-11"
    const [m, y] = billMonth.split('/');
    billMonth = `${y}-${m.padStart(2, '0')}`;
  }
  
  const [year, month] = billMonth.split('-').map(Number);
  const closingDay = new Date(bill.closing_date).getDate();
  const closingDateOfBill = new Date(year, month - 1, closingDay);
  const isClosed = isPast(closingDateOfBill);
  
  const amountDue = Math.max(0, bill.total_amount)
  // Uma fatura está "Paga" se não há valor a pagar OU se está fechada e foi paga
  const isPaid = amountDue <= 0 || (isClosed && paidAmount >= amountDue);

  logger.debug("[CreditBillDetailsModal] Status", {
    billMonth,
    closingDateOfBill: format(closingDateOfBill, 'dd/MM/yyyy'),
    isClosed,
    totalAmount: bill.total_amount,
    paidAmount,
    amountDue,
    isPaid,
  });

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
                  {isClosed ? t('creditBills.closed') : t('creditBills.open')}
                </Badge>
                <Badge variant={isPaid ? 'default' : 'destructive'}>
                  {isPaid ? t('creditBills.paid') : t('creditBills.pending')}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            {t('creditBills.dueOn')} {format(new Date(bill.due_date), 'dd/MM/yyyy', { locale: ptBR })} | {t('creditBills.closingOn')} {format(new Date(bill.closing_date), 'dd/MM/yyyy', { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg border">
          <div>
            <div className="text-sm text-muted-foreground">{t('creditBills.totalAmount')}</div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(bill.total_amount)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-green-600 dark:text-green-500">{t('creditBills.paidAmount')}: {formatCurrency(paidAmount)}</div>
            <div className="text-sm font-medium text-red-600 dark:text-red-500">{t('creditBills.remaining')}: {formatCurrency(remainingAmount)}</div>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('transactions.date')}</TableHead>
                <TableHead>{t('transactions.description')}</TableHead>
                <TableHead className="text-right">{t('transactions.amount')}</TableHead>
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