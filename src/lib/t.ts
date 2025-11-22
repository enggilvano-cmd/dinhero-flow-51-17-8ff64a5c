/**
 * Função temporária de tradução - DEPRECATED
 * Retorna textos em português diretamente
 * TODO: Remover após migração completa
 */

const TRANSLATIONS: Record<string, string> = {
  // Common
  'common.error': 'Erro',
  'common.success': 'Sucesso',
  'common.cancel': 'Cancelar',
  'common.save': 'Salvar',
  'common.saving': 'Salvando...',
  'common.all': 'Todos',
  'common.filters': 'Filtros',
  'common.search': 'Buscar',
  'common.export': 'Exportar',
  'common.noResults': 'Nenhum resultado encontrado',
  'common.startDate': 'Data Inicial',
  'common.endDate': 'Data Final',
  
  // Transactions
  'transactions.date': 'Data',
  'transactions.description': 'Descrição',
  'transactions.category': 'Categoria',
  'transactions.type': 'Tipo',
  'transactions.account': 'Conta',
  'transactions.amount': 'Valor',
  'transactions.status': 'Status',
  'transactions.installments': 'Parcelas',
  'transactions.income': 'Receita',
  'transactions.expense': 'Despesa',
  'transactions.pending': 'Pendente',
  'transactions.completed': 'Concluída',
  'transactions.selectAccount': 'Selecione uma conta',
  'transactions.noTransactions': 'Nenhuma transação encontrada',
  
  // Accounts
  'accounts.credit': 'Cartão de Crédito',
  'accounts.searchPlaceholder': 'Buscar contas...',
  'accounts.available': 'Disponível',
  
  // Reconciliation
  'reconciliation.totalTransactions': 'Total de Transações',
  'reconciliation.reconciled': 'Reconciliadas',
  'reconciliation.notReconciled': 'Não Reconciliadas',
  'reconciliation.reconciledAmount': 'Valor Reconciliado',
  'reconciliation.status': 'Status',
  'reconciliation.reconciledAt': 'Reconciliado em',
  
  // Dashboard
  'dashboard.period': 'Período',
  
  // Modals Import
  'modals.import.errors.nameRequired': 'Nome é obrigatório',
  'modals.import.errors.typeRequired': 'Tipo é obrigatório',
  'modals.import.errors.colorRequired': 'Cor é obrigatória',
  'modals.import.errors.invalidAccountType': 'Tipo de conta inválido',
  'modals.import.errors.invalidColorFormat': 'Formato de cor inválido',
  'modals.import.errors.closingDateRange': 'Data de fechamento deve estar entre 1 e 31',
  'modals.import.errors.dueDateRange': 'Data de vencimento deve estar entre 1 e 31',
  'modals.import.errors.dateRequired': 'Data é obrigatória',
  'modals.import.errors.descriptionRequired': 'Descrição é obrigatória',
  'modals.import.errors.categoryRequired': 'Categoria é obrigatória',
  'modals.import.errors.accountRequired': 'Conta é obrigatória',
  'modals.import.errors.invalidAmount': 'Valor inválido',
  'modals.import.errors.invalidDateFormat': 'Formato de data inválido',
  'modals.import.errors.invalidTransactionType': 'Tipo de transação inválido',
  'modals.import.errors.accountNotFound': 'Conta não encontrada',
  'modals.import.errors.invalidStatus': 'Status inválido',
  'modals.import.errors.invalidCategoryType': 'Tipo de categoria inválido',
  'modals.import.errorInvalidFile': 'Arquivo inválido. Apenas arquivos Excel (.xlsx, .xls) são permitidos',
  'modals.import.errorEmpty': 'Arquivo vazio ou sem dados válidos',
  'modals.import.errorReadFile': 'Erro ao ler arquivo Excel',
  'modals.import.fileProcessed': 'Arquivo Processado',
  'modals.import.summaryDesc': '{{new}} nova(s), {{duplicates}} duplicada(s), {{errors}} erro(s)',
  'modals.import.noItemsToImport': 'Nenhum item válido para importar',
  'modals.import.accountsImported': '{{count}} conta(s) importada(s) com sucesso',
  'modals.import.categoriesImported': '{{count}} categoria(s) importada(s) com sucesso',
  'modals.import.transactionsImported': '{{count}} transação(ões) importada(s) com sucesso',
  'modals.import.templateDownloaded': 'Modelo baixado com sucesso',
  'modals.import.titleAccounts': 'Importar Contas',
  'modals.import.subtitleAccounts': 'Importe contas de um arquivo Excel',
  'modals.import.titleCategories': 'Importar Categorias',
  'modals.import.subtitleCategories': 'Importe categorias de um arquivo Excel',
  'modals.import.titleTransactions': 'Importar Transações',
  'modals.import.subtitleTransactions': 'Importe transações de um arquivo Excel',
  'modals.import.selectFile': 'Selecione o Arquivo',
  'modals.import.expectedFormat': 'Formato Esperado',
  'modals.import.fileColumns': 'Colunas do Arquivo',
  'modals.import.fields.name': 'Nome',
  'modals.import.fields.type': 'Tipo',
  'modals.import.fields.balance': 'Saldo',
  'modals.import.fields.limit': 'Limite',
  'modals.import.fields.closingDate': 'Data de Fechamento',
  'modals.import.fields.dueDate': 'Data de Vencimento',
  'modals.import.fields.color': 'Cor',
  'modals.import.accountNameDesc': 'Nome da conta',
  'modals.import.accountTypeDesc': 'Corrente, Poupança, Crédito ou Investimento',
  'modals.import.accountBalanceDesc': 'Saldo inicial em reais',
  'modals.import.accountLimitDesc': 'Limite do cartão (apenas para cartões de crédito)',
  'modals.import.accountClosingDesc': 'Dia do fechamento (1-31, apenas para cartões)',
  'modals.import.accountDueDesc': 'Dia do vencimento (1-31, apenas para cartões)',
  'modals.import.colorDesc': 'Cor no formato hexadecimal',
  'modals.import.downloadTemplate': 'Baixar Modelo',
  'modals.import.newAccounts': 'Novas',
  'modals.import.duplicatesFound': 'Duplicadas',
  'modals.import.withErrors': 'Com Erros',
  'modals.import.excluded': 'Excluídas',
  'modals.import.typeAccounts': 'contas',
  'modals.import.typeCategories': 'categorias',
  'modals.import.typeTransactions': 'transações',
  'modals.import.previewAccounts': 'Pré-visualização ({{count}} contas)',
  'modals.import.status': 'Status',
  'modals.import.action': 'Ação',
  'modals.import.badges.excluded': 'Excluída',
  'modals.import.badges.error': 'Erro',
  'modals.import.badges.duplicate': 'Duplicada',
  'modals.import.badges.new': 'Nova',
  'modals.import.include': 'Incluir',
  'modals.import.exclude': 'Excluir',
  'modals.import.resolutions.skip': 'Pular',
  'modals.import.resolutions.add': 'Adicionar Nova',
  'modals.import.resolutions.replace': 'Substituir Existente',
  'modals.import.importButton': 'Importar {{count}} {{type}}',
  
  // Categories
  'categories.categoryName': 'Nome da Categoria',
  'categories.categoryType': 'Tipo da Categoria',
  'categories.categoryColor': 'Cor da Categoria',
  
  // Profile
  'profile.mfaNotFound': 'Autenticação de dois fatores não encontrada',
  'profile.mfaDisabled': '2FA Desabilitado',
  'profile.mfaDisabledDescription': 'A autenticação de dois fatores foi desabilitada',
  'profile.mfaDisableError': 'Erro ao desabilitar 2FA',
  'profile.noName': 'Sem Nome',
  'profile.fullName': 'Nome Completo',
  'profile.fullNamePlaceholder': 'Digite seu nome completo',
  'profile.emailPlaceholder': 'Digite seu email',
  'profile.saveChanges': 'Salvar Alterações',
  'profile.security': 'Segurança',
  'profile.securityDescription': 'Gerencie a segurança da sua conta',
  'profile.changePassword': 'Alterar Senha',
  'profile.changePasswordDescription': 'Enviaremos um email para você redefinir sua senha',
  'profile.resetPassword': 'Redefinir Senha',
  'profile.twoFactorAuth': 'Autenticação de Dois Fatores',
  'profile.enabled': 'Ativado',
  'profile.disabled': 'Desativado',
  'profile.mfaProtected': 'Sua conta está protegida com autenticação de dois fatores',
  'profile.mfaAddLayer': 'Adicione uma camada extra de segurança à sua conta',
  'profile.disable': 'Desativar',
  'profile.enable2FA': 'Ativar 2FA',
  'profile.accountStatus': 'Status da Conta',
  'profile.active': 'Ativa',
  'profile.inactive': 'Inativa',
  'profile.role': 'Função',
  'profile.memberSince': 'Membro desde',
  'profile.recentActivity': 'Atividade Recente',
  'profile.recentActivityDescription': 'Últimas ações realizadas na sua conta',
  'profile.noRecentActivity': 'Nenhuma atividade recente',
  'profile.dangerZone': 'Zona de Perigo',
  'profile.dangerZoneDescription': 'Ações irreversíveis',
  'profile.signOut': 'Sair',
  'profile.disableMfaTitle': 'Desativar 2FA',
  'profile.disableMfaDescription': 'Tem certeza que deseja desativar a autenticação de dois fatores?',
  'profile.disablingMfa': 'Desativando...',
  'profile.disableMfa': 'Desativar 2FA',
  
  // Auth
  'auth.email': 'Email',
  
  // Settings
  'settings.title': 'Configurações',
  'settings.subtitle': 'Gerencie as configurações da aplicação',
  
  // Add Transaction Modal
  'transactions.addTransaction': 'Adicionar Transação',
  'transactions.editTransaction': 'Editar Transação',
  'transactions.transactionDetails': 'Detalhes da Transação',
  'transactions.basicInfo': 'Informações Básicas',
  'transactions.additionalInfo': 'Informações Adicionais',
  'transactions.selectCategory': 'Selecione uma categoria',
  'transactions.selectType': 'Selecione o tipo',
  'transactions.transfer': 'Transferência',
  'transactions.fromAccount': 'Da Conta',
  'transactions.toAccount': 'Para Conta',
  'transactions.selectDate': 'Selecione a data',
  'transactions.recurrenceSettings': 'Configurações de Recorrência',
  'transactions.makeRecurring': 'Tornar Recorrente',
  'transactions.recurrenceType': 'Tipo de Recorrência',
  'transactions.selectRecurrence': 'Selecione o tipo',
  'transactions.daily': 'Diário',
  'transactions.weekly': 'Semanal',
  'transactions.monthly': 'Mensal',
  'transactions.yearly': 'Anual',
  'transactions.endDate': 'Data de Término',
  'transactions.optional': 'Opcional',
  'transactions.installmentSettings': 'Parcelamento',
  'transactions.installmentCount': 'Número de Parcelas',
  'transactions.invoiceOverride': 'Sobrescrever Mês da Fatura',
  'transactions.overrideInvoiceMonth': 'Sobrescrever mês da fatura',
  'transactions.invoiceMonth': 'Mês da Fatura',
  'transactions.transactionSaved': 'Transação salva com sucesso',
  'transactions.transactionUpdated': 'Transação atualizada com sucesso',
  'transactions.errorSaving': 'Erro ao salvar transação',
  'transactions.errorUpdating': 'Erro ao atualizar transação',
  'transactions.validationError': 'Erro de validação',
  'transactions.missingFields': 'Preencha todos os campos obrigatórios',
};

export function t(key: string, params?: Record<string, any>): string {
  let text = TRANSLATIONS[key] || key;
  
  // Replace parameters like {{count}}, {{name}}, etc.
  if (params) {
    Object.keys(params).forEach(paramKey => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      text = text.replace(regex, String(params[paramKey]));
    });
  }
  
  return text;
}

/**
 * Hook temporário de tradução
 */
export function useT() {
  return { t };
}
