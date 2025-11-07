import React from 'react'
import { useAccountStore } from '@/stores/AccountStore' // Importa o hook 'create' padrão
import { formatCurrency } from '@/lib/formatters' // Importa o formatador de centavos
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './ui/card'
import { Skeleton } from './ui/skeleton'
import { AddAccountModal } from './AddAccountModal'
import { EditAccountModal } from './EditAccountModal'

/**
 * Componente de esqueleto para carregamento
 */
const AccountsLoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Página principal de Contas
 */
export const AccountsPage: React.FC = () => {
  // NOTA DO PROGRAMADOR:
  // O uso do store agora é idiomático e simples.
  // 'useSyncExternalStore' foi removido.
  const { accounts, loading, loadAccounts } = useAccountStore()

  React.useEffect(() => {
    // Carrega os dados na montagem do componente
    loadAccounts()
  }, [loadAccounts])

  if (loading && accounts.length === 0) {
    return <AccountsLoadingSkeleton />
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Contas</h1>
        <AddAccountModal onSuccess={loadAccounts} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="flex flex-col">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>{account.name}</CardTitle>
              {/* Exibe a cor da conta */}
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: account.color || '#ccc' }}
              />
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground capitalize">
                {account.type.replace('_', ' ')}
              </p>
              <p className="text-2xl font-bold">
                {/* NOTA DO CONTADOR: 
                  O valor 'account.balance' vem do banco como um inteiro (ex: 1050).
                  'formatCurrency' o converte para a string "R$ 10,50".
                */}
                {formatCurrency(account.balance)}
              </p>
            </CardContent>
            <CardFooter>
              {/* O modal de edição recebe a conta como prop */}
              <EditAccountModal account={account} onSuccess={loadAccounts} />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}