import { loadXLSX } from './lazyImports';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Exporta contas para Excel
 */
export async function exportAccountsToExcel(accounts: any[]) {
  const XLSX = await loadXLSX();
  
  const exportData = accounts.map(account => ({
    'Nome': account.name,
    'Tipo': getAccountTypeLabel(account.type),
    'Saldo': (account.balance / 100).toFixed(2),
    'Limite': account.limit_amount ? (account.limit_amount / 100).toFixed(2) : '',
    'Fechamento': account.closing_date || '',
    'Vencimento': account.due_date || '',
    'Cor': account.color,
    'Criado em': format(new Date(account.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contas');

  // Configurar largura das colunas
  const colWidths = [
    { wch: 30 }, // Nome
    { wch: 20 }, // Tipo
    { wch: 15 }, // Saldo
    { wch: 15 }, // Limite
    { wch: 12 }, // Fechamento
    { wch: 12 }, // Vencimento
    { wch: 12 }, // Cor
    { wch: 18 }, // Criado em
  ];
  ws['!cols'] = colWidths;

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  XLSX.writeFile(wb, `contas_${timestamp}.xlsx`);
}

/**
 * Exporta categorias para Excel
 */
export async function exportCategoriesToExcel(categories: any[]) {
  const XLSX = await loadXLSX();
  
  const exportData = categories.map(category => ({
    'Nome': category.name,
    'Tipo': getCategoryTypeLabel(category.type),
    'Cor': category.color,
    'Criado em': format(new Date(category.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Categorias');

  // Configurar largura das colunas
  const colWidths = [
    { wch: 30 }, // Nome
    { wch: 15 }, // Tipo
    { wch: 12 }, // Cor
    { wch: 18 }, // Criado em
  ];
  ws['!cols'] = colWidths;

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  XLSX.writeFile(wb, `categorias_${timestamp}.xlsx`);
}

/**
 * Exporta transações para Excel
 */
export async function exportTransactionsToExcel(
  transactions: any[],
  accounts: any[],
  categories: any[]
) {
  const XLSX = await loadXLSX();
  
  const exportData = transactions.map(transaction => {
    const account = accounts.find(a => a.id === transaction.account_id);
    const category = categories.find(c => c.id === transaction.category_id);
    const toAccount = transaction.to_account_id 
      ? accounts.find(a => a.id === transaction.to_account_id)
      : null;

    return {
      'Data': format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR }),
      'Descrição': transaction.description,
      'Categoria': category?.name || '-',
      'Tipo': getTransactionTypeLabel(transaction.type),
      'Conta': account?.name || 'Desconhecida',
      'Conta Destino': toAccount?.name || '',
      'Valor': (Math.abs(transaction.amount) / 100).toFixed(2),
      'Status': transaction.status === 'completed' ? 'Concluída' : 'Pendente',
      'Parcelas': transaction.installments 
        ? `${transaction.current_installment}/${transaction.installments}`
        : '',
      'Mês Fatura': transaction.invoice_month || '',
      'Recorrente': transaction.is_recurring ? 'Sim' : 'Não',
      'Fixa': transaction.is_fixed ? 'Sim' : 'Não',
      'Reconciliada': transaction.reconciled ? 'Sim' : 'Não',
      'Criado em': format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transações');

  // Configurar largura das colunas
  const colWidths = [
    { wch: 12 },  // Data
    { wch: 30 },  // Descrição
    { wch: 20 },  // Categoria
    { wch: 15 },  // Tipo
    { wch: 25 },  // Conta
    { wch: 25 },  // Conta Destino
    { wch: 15 },  // Valor
    { wch: 12 },  // Status
    { wch: 12 },  // Parcelas
    { wch: 12 },  // Mês Fatura
    { wch: 12 },  // Recorrente
    { wch: 12 },  // Fixa
    { wch: 12 },  // Reconciliada
    { wch: 18 },  // Criado em
  ];
  ws['!cols'] = colWidths;

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  XLSX.writeFile(wb, `transacoes_${timestamp}.xlsx`);
}

/**
 * Exporta todos os dados para Excel (backup completo)
 */
export async function exportAllDataToExcel(
  accounts: any[],
  categories: any[],
  transactions: any[]
) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // Sheet de Contas
  const accountsData = accounts.map(account => ({
    'Nome': account.name,
    'Tipo': getAccountTypeLabel(account.type),
    'Saldo': (account.balance / 100).toFixed(2),
    'Limite': account.limit_amount ? (account.limit_amount / 100).toFixed(2) : '',
    'Fechamento': account.closing_date || '',
    'Vencimento': account.due_date || '',
    'Cor': account.color,
    'Criado em': format(new Date(account.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  }));
  const wsAccounts = XLSX.utils.json_to_sheet(accountsData);
  wsAccounts['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAccounts, 'Contas');

  // Sheet de Categorias
  const categoriesData = categories.map(category => ({
    'Nome': category.name,
    'Tipo': getCategoryTypeLabel(category.type),
    'Cor': category.color,
    'Criado em': format(new Date(category.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  }));
  const wsCategories = XLSX.utils.json_to_sheet(categoriesData);
  wsCategories['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Categorias');

  // Sheet de Transações
  const transactionsData = transactions.map(transaction => {
    const account = accounts.find(a => a.id === transaction.account_id);
    const category = categories.find(c => c.id === transaction.category_id);
    const toAccount = transaction.to_account_id 
      ? accounts.find(a => a.id === transaction.to_account_id)
      : null;

    return {
      'Data': format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR }),
      'Descrição': transaction.description,
      'Categoria': category?.name || '-',
      'Tipo': getTransactionTypeLabel(transaction.type),
      'Conta': account?.name || 'Desconhecida',
      'Conta Destino': toAccount?.name || '',
      'Valor': (Math.abs(transaction.amount) / 100).toFixed(2),
      'Status': transaction.status === 'completed' ? 'Concluída' : 'Pendente',
      'Parcelas': transaction.installments 
        ? `${transaction.current_installment}/${transaction.installments}`
        : '',
      'Mês Fatura': transaction.invoice_month || '',
      'Recorrente': transaction.is_recurring ? 'Sim' : 'Não',
      'Fixa': transaction.is_fixed ? 'Sim' : 'Não',
      'Reconciliada': transaction.reconciled ? 'Sim' : 'Não',
      'Criado em': format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    };
  });
  const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
  wsTransactions['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 15 },
    { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações');

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  XLSX.writeFile(wb, `backup_completo_${timestamp}.xlsx`);
}

// Funções auxiliares de formatação
function getAccountTypeLabel(type: string): string {
  switch (type) {
    case 'checking': return 'Conta Corrente';
    case 'savings': return 'Poupança';
    case 'credit': return 'Cartão de Crédito';
    case 'investment': return 'Investimento';
    default: return type;
  }
}

function getCategoryTypeLabel(type: string): string {
  switch (type) {
    case 'income': return 'Receita';
    case 'expense': return 'Despesa';
    case 'both': return 'Ambos';
    default: return type;
  }
}

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'income': return 'Receita';
    case 'expense': return 'Despesa';
    case 'transfer': return 'Transferência';
    default: return type;
  }
}
