import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from './ui/button'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Account, CreditBill } from '@/integrations/supabase/types'
import { useAccountStore } from '@/stores/AccountStore'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
// CORREÇÃO: Importa de './CurrencyInput' (sem '/forms/')
import { CurrencyInput } from './CurrencyInput'

interface CreditPaymentModalProps {
  creditAccount: Account | null 
  bill: CreditBill | null 
  onPaymentSuccess: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Schema de validação
const formSchema = z.object({
  accountId: z.string().uuid('Deve ser um ID de conta válido.'),
  amount: z
    .number({ required_error: 'O valor é obrigatório.' })
    .min(1, 'O valor deve ser maior que R$ 0,00'),
  date: z.date({ required_error: 'A data é obrigatória.' }),
})

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  creditAccount,
  bill,
  onPaymentSuccess,
  open,
  onOpenChange,
}) => {
  const { accounts, loadAccounts } = useAccountStore()

  // Filtra contas que podem pagar
  const payingAccounts = React.useMemo(() => {
    return accounts.filter((acc) => acc.type !== 'credit_card')
  }, [accounts])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // CORREÇÃO: 'defaultValues' estático para evitar erro na inicialização
    defaultValues: {
      accountId: undefined,
      amount: undefined,
      date: new Date(),
    },
  })

  // Efeito para preencher o formulário quando o modal abre com uma fatura
  React.useEffect(() => {
    if (open && bill) {
      form.reset({
        accountId: undefined,
        amount: Math.abs(bill.total_amount),
        date: new Date(),
      })
    } else if (!open) {
      form.reset({
        accountId: undefined,
        amount: undefined,
        date: new Date(),
      })
    }
  }, [bill, open, form])

  // Função chamada no submit
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!creditAccount) {
      toast.error('Erro: Conta de crédito não selecionada.')
      return
    }

    try {
      const amountInCents = values.amount
      const dateString = format(values.date, 'yyyy-MM-dd')

      // 1. Cria a DESPESA na conta de origem
      const { error: paymentError } = await supabase.from('transactions').insert({
        account_id: values.accountId,
        description: `Pagamento Fatura ${creditAccount.name}`,
        amount: -Math.abs(amountInCents),
        date: dateString,
        category_id: null,
        include_in_reports: false,
        is_paid: true,
      })

      if (paymentError) throw paymentError

      // 2. Cria a RECEITA na conta de destino
      const { error: creditError } = await supabase.from('transactions').insert({
        account_id: creditAccount.id,
        description: `Pagamento Recebido`,
        amount: Math.abs(amountInCents),
        date: dateString,
        category_id: null,
        include_in_reports: false,
        is_paid: true,
      })

      if (creditError) throw creditError

      toast.success('Pagamento da fatura registrado!')
      onOpenChange(false)
      loadAccounts()
      onPaymentSuccess()
    } catch (error: any) {
      console.error('Erro ao pagar fatura:', error)
      toast.error('Erro ao registrar pagamento.', {
        description: error.message,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pagar Fatura - {creditAccount?.name || 'Carregando...'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo: Conta de Origem */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagar com</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta de origem" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payingAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Valor (CORRIGIDO) */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  name="amount"
                  label="Valor do Pagamento"
                  placeholder="R$ 0,00"
                  field={field}
                />
              )}
            />

            {/* Campo: Data */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do Pagamento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon
                            className="ml-auto h-4 w-4 opacity-50"
                          />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit">Confirmar Pagamento</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}