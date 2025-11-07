import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  Tag,
  BarChart,
  Settings,
  Menu,
  CreditCard,
  Plus,
  ArrowRightLeft,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { UserProfile } from './UserProfile'
import { AddTransactionModal } from './AddTransactionModal'
import { TransferModal } from './TransferModal'
import { useAccountStore } from '@/stores/AccountStore' // Importa o novo store unificado
import { useAuth } from '@/hooks/useAuth'

const NavItem: React.FC<{
  to: string
  icon: React.ElementType
  label: string
  onClose?: () => void
}> = ({ to, icon: Icon, label, onClose }) => {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      onClick={onClose}
      className={cn(
        'flex items-center p-2 rounded-md transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </Link>
  )
}

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Contas' },
  { to: '/transactions', icon: ArrowRightLeft, label: 'Transações' },
  { to: '/categories', icon: Tag, label: 'Categorias' },
  { to: '/credit-bills', icon: CreditCard, label: 'Faturas' },
  { to: '/analytics', icon: BarChart, label: 'Análises' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export const Layout: React.FC = () => {
  const { session } = useAuth()

  //
  // === CORREÇÃO DE LÓGICA (TELA BRANCA) ===
  //
  // Antes, usava `useAccountActions`.
  // Agora, pegamos as ações de carregamento do hook `useAccountStore` unificado.
  //
  const { loadAccounts, loadCategories } = useAccountStore()

  // Carrega os dados essenciais (contas, categorias) quando o layout é montado
  // e o usuário está logado.
  React.useEffect(() => {
    if (session) {
      loadAccounts()
      loadCategories()
    }
  }, [session, loadAccounts, loadCategories]) // Adiciona as funções ao array de dependência

  // Se não houver sessão, não renderiza o layout principal
  if (!session) {
    return <Outlet />
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">DinheroFlow</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onClose={onClose} />
        ))}
      </nav>
      <div className="p-4 border-t">
        <UserProfile />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 flex-col border-r">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header (Mobile) */}
        <header className="md:hidden flex items-center justify-between p-4 border-b">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent onClose={() => document.dispatchEvent(new Event('close-sheet'))} />
            </SheetContent>
          </Sheet>
          <span className="text-lg font-bold">DinheroFlow</span>
          <div className="flex items-center gap-2">
            <TransferModal />
            <AddTransactionModal />
          </div>
        </header>

        {/* Header (Desktop) */}
        <header className="hidden md:flex items-center justify-end p-4 border-b min-h-[65px]">
          <div className="flex items-center gap-2">
            <TransferModal />
            <AddTransactionModal />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Pequena função 'cn' auxiliar (se não estiver global)
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}