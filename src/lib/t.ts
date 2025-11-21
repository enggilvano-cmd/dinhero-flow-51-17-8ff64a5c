/**
 * Função temporária de tradução - apenas retorna textos em português
 * TODO: Substituir todas as chamadas t() por texto direto em português
 */
export function t(key: string, _params?: Record<string, any>): string {
  // Mapeamento básico de chaves comuns
  const translations: Record<string, string> = {
    'common.add': 'Adicionar',
    'common.edit': 'Editar',
    'common.delete': 'Excluir',
    'common.cancel': 'Cancelar',
    'common.save': 'Salvar',
    'common.ok': 'OK',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.all': 'Todos',
    'common.import': 'Importar',
    'common.export': 'Exportar',
    'common.total': 'Total',
    'common.actions': 'Ações',
    'dashboard.revenues': 'Receitas',
    'dashboard.expenses': 'Despesas',
    'dashboard.balance': 'Saldo',
    'transactions.title': 'Transações',
    'transactions.subtitle': 'Gerencie todas as suas transações',
    'transactions.income': 'Receita',
    'transactions.expense': 'Despesa',
    'transactions.transfer': 'Transferência',
    'transactions.type': 'Tipo',
    'transactions.status': 'Status',
    'transactions.completed': 'Concluída',
    'transactions.pending': 'Pendente',
    'transactions.account': 'Conta',
    'transactions.category': 'Categoria',
    'transactions.date': 'Data',
    'transactions.description': 'Descrição',
    'transactions.amount': 'Valor',
    'transactions.installments': 'Parcelas',
    'transactions.markAsPaid': 'Marcar como Pago',
    'transactions.unknownAccount': 'Conta Desconhecida',
    'transactions.exportSuccess': 'Exportado com sucesso',
  };

  // Retorna a tradução ou a própria chave se não encontrar
  return translations[key] || key;
}

/**
 * Hook temporário de tradução
 */
export function useT() {
  return { t };
}
