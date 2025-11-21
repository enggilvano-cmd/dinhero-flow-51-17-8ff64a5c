/**
 * Lazy-loaded route components for aggressive code splitting
 * Each major feature is loaded on-demand to reduce initial bundle size
 */

import { lazy } from 'react';

// Auth routes
export const AuthPage = lazy(() => import('@/pages/Auth'));

// Main dashboard
export const IndexPage = lazy(() => import('@/pages/Index'));

// Transaction routes
export const TransactionsPage = lazy(() => import('@/components/TransactionsPage'));
export const AddTransactionModal = lazy(() => import('@/components/AddTransactionModal'));
export const EditTransactionModal = lazy(() => import('@/components/EditTransactionModal'));

// Account routes
export const AccountsPage = lazy(() => import('@/components/AccountsPage'));
export const AddAccountModal = lazy(() => import('@/components/AddAccountModal'));
export const EditAccountModal = lazy(() => import('@/components/EditAccountModal'));

// Category routes
export const CategoriesPage = lazy(() => import('@/components/CategoriesPage'));
export const AddCategoryModal = lazy(() => import('@/components/AddCategoryModal'));
export const EditCategoryModal = lazy(() => import('@/components/EditCategoryModal'));

// Financial routes
export const FixedTransactionsPage = lazy(() => import('@/components/FixedTransactionsPage'));
export const RecurringTransactionsPage = lazy(() => import('@/components/RecurringTransactionsPage'));
export const CreditBillsPage = lazy(() => import('@/components/CreditBillsPage'));

// Accounting routes
export const AccountingPage = lazy(() => import('@/components/AccountingPage'));
export const AccountingReportsPage = lazy(() => import('@/components/AccountingReportsPage'));
export const LedgerPage = lazy(() => import('@/components/LedgerPage'));
export const BankReconciliationPage = lazy(() => import('@/components/BankReconciliationPage'));
export const PeriodClosurePage = lazy(() => import('@/components/PeriodClosurePage'));

// Analytics & Reports
export const AnalyticsPage = lazy(() => import('@/components/AnalyticsPage'));
export const Dashboard = lazy(() => import('@/components/Dashboard'));

// Settings & Admin
export const SettingsPage = lazy(() => import('@/components/SettingsPage'));
export const SystemSettings = lazy(() => import('@/components/SystemSettings'));
export const UserManagement = lazy(() => import('@/components/UserManagement'));
export const UserProfile = lazy(() => import('@/components/UserProfile'));

// Not found
export const NotFoundPage = lazy(() => import('@/pages/NotFound'));

/**
 * Preload critical routes
 * Call this function to preload routes that the user is likely to navigate to
 */
export function preloadCriticalRoutes() {
  // Preload dashboard and transactions (most common routes)
  const criticalImports = [
    import('@/components/Dashboard'),
    import('@/components/TransactionsPage'),
    import('@/components/AccountsPage'),
  ];

  return Promise.all(criticalImports);
}

/**
 * Preload route by name
 * Useful for hover intent or navigation hints
 */
export function preloadRoute(routeName: string) {
  const routeMap: Record<string, () => Promise<any>> = {
    transactions: () => import('@/components/TransactionsPage'),
    accounts: () => import('@/components/AccountsPage'),
    categories: () => import('@/components/CategoriesPage'),
    analytics: () => import('@/components/AnalyticsPage'),
    accounting: () => import('@/components/AccountingPage'),
    settings: () => import('@/components/SettingsPage'),
  };

  const loader = routeMap[routeName];
  if (loader) {
    return loader();
  }

  return Promise.resolve();
}
