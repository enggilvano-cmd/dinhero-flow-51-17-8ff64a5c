// Re-export all handlers from refactored modules
export { useTransactionMutations } from './transactions/useTransactionMutations';
export { useInstallmentMutations } from './transactions/useInstallmentMutations';
export { useTransferMutations } from './transactions/useTransferMutations';
export { useImportMutations } from './transactions/useImportMutations';
export { useCreditPaymentMutations } from './transactions/useCreditPaymentMutations';

// Wrapper hook that combines all handlers (for backward compatibility)
import { useTransactionMutations } from './transactions/useTransactionMutations';
import { useInstallmentMutations } from './transactions/useInstallmentMutations';
import { useTransferMutations } from './transactions/useTransferMutations';
import { useImportMutations } from './transactions/useImportMutations';
import { useCreditPaymentMutations } from './transactions/useCreditPaymentMutations';

export function useTransactionHandlers() {
  const transactionMutations = useTransactionMutations();
  const installmentMutations = useInstallmentMutations();
  const transferMutations = useTransferMutations();
  const importMutations = useImportMutations();
  const creditPaymentMutations = useCreditPaymentMutations();

  return {
    ...transactionMutations,
    ...installmentMutations,
    ...transferMutations,
    ...importMutations,
    ...creditPaymentMutations,
  };
}
