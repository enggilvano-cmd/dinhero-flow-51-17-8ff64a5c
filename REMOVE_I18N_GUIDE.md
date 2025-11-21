# Guia de Remoção de I18N

## Status da Migração

Arquivos já migrados (sem useTranslation):
- ✅ src/components/Dashboard.tsx
- ✅ src/components/dashboard/DashboardHeader.tsx
- ✅ src/components/dashboard/BalanceCards.tsx
- ✅ src/components/dashboard/FilterCard.tsx  
- ✅ src/components/dashboard/FinancialEvolutionChart.tsx
- ✅ src/components/dashboard/AccountsSummary.tsx
- ✅ src/components/dashboard/RecentTransactions.tsx
- ✅ src/hooks/useDashboardCalculations.tsx
- ✅ src/components/transactions/TransactionActions.tsx
- ✅ src/components/UserManagement.tsx
- ✅ src/components/transactions/InfiniteTransactionList.tsx
- ✅ src/components/transactions/TransactionList.tsx

Arquivos pendentes:
- ⏳ src/components/Layout.tsx
- ⏳ src/components/AccountsPage.tsx
- ⏳ src/components/CategoriesPage.tsx
- ⏳ src/components/AddAccountModal.tsx
- ⏳ src/components/AddCategoryModal.tsx
- ⏳ src/components/EditAccountModal.tsx
- ⏳ src/components/EditCategoryModal.tsx
- ⏳ src/components/AnalyticsPage.tsx
- ⏳ src/components/BankReconciliationPage.tsx
- ⏳ src/components/CreditBillsPage.tsx
- ⏳ src/components/CreditCardBillCard.tsx
- ⏳ src/components/CreditBillDetailsModal.tsx
- ⏳ src/components/CreditPaymentModal.tsx
- ⏳ src/components/EditRecurringTransactionModal.tsx
- ⏳ src/components/EditTransactionModal.tsx
- ⏳ src/components/ImportAccountsModal.tsx
- ⏳ src/components/ImportCategoriesModal.tsx
- ⏳ src/components/ImportTransactionsModal.tsx
- ⏳ src/components/InstallmentEditScopeDialog.tsx
- ⏳ src/components/MarkAsPaidModal.tsx
- ⏳ src/components/RecurringTransactionsPage.tsx
- ⏳ src/components/TransferModal.tsx
- ⏳ src/components/TwoFactorSetup.tsx
- ⏳ src/components/TwoFactorVerify.tsx
- ⏳ src/components/UserProfile.tsx
- ⏳ src/components/AccountBalanceDetails.tsx

## Próximos Passos

1. Remover import de react-i18next
2. Remover const { t } = useTranslation()
3. Substituir todas as chamadas t('key') por texto direto em português
4. Remover o arquivo src/lib/t.ts após migração completa
5. Remover dependência react-i18next e i18next do package.json
