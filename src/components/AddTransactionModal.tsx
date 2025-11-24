import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvailableBalanceIndicator } from "@/components/forms/AvailableBalanceIndicator";
import { AddTransactionModalProps } from "@/types/formProps";
import { useAddTransactionForm } from "@/hooks/useAddTransactionForm";
import { TransactionFormFields } from "./add-transaction/TransactionFormFields";
import { AccountCategoryFields } from "./add-transaction/AccountCategoryFields";
import { InvoiceMonthSelector } from "./add-transaction/InvoiceMonthSelector";
import { InstallmentOptions } from "./add-transaction/InstallmentOptions";
import { FixedTransactionOptions } from "./add-transaction/FixedTransactionOptions";

export function AddTransactionModal({
  open,
  onOpenChange,
  onAddTransaction,
  onAddInstallmentTransactions,
  onSuccess,
  accounts,
  initialType = "",
  initialAccountType = "",
  lockType = false,
}: AddTransactionModalProps) {
  const filteredAccounts = initialAccountType === "credit"
    ? accounts.filter((acc) => acc.type === "credit")
    : initialAccountType === "checking"
    ? accounts.filter((acc) => acc.type !== "credit")
    : accounts;

  const {
    formData,
    setFormData,
    customInstallments,
    setCustomInstallments,
    validationErrors,
    filteredCategories,
    selectedAccount,
    handleSubmit,
  } = useAddTransactionForm({
    open,
    initialType,
    accounts: filteredAccounts,
    onAddTransaction,
    onAddInstallmentTransactions,
    onSuccess,
    onClose: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-headline">
            {initialType === "income" 
              ? "Adicionar Receita"
              : initialType === "expense" 
              ? "Adicionar Despesa"
              : "Adicionar Transação"}
          </DialogTitle>
          <DialogDescription className="text-body">
            {initialType === "income" 
              ? "Registre uma nova receita"
              : initialType === "expense" 
              ? "Registre uma nova despesa"
              : "Preencha os dados da nova transação"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <TransactionFormFields
            description={formData.description}
            type={formData.type}
            amount={formData.amount}
            date={formData.date}
            lockType={lockType}
            validationErrors={validationErrors}
            onDescriptionChange={(value) =>
              setFormData((prev) => ({ ...prev, description: value }))
            }
            onTypeChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                type: value,
                category_id: "",
              }))
            }
            onAmountChange={(value) =>
              setFormData((prev) => ({ ...prev, amount: value }))
            }
            onDateChange={(value) =>
              setFormData((prev) => ({ ...prev, date: value }))
            }
          />

          {formData.account_id && formData.type && (
            <AvailableBalanceIndicator
              account={selectedAccount}
              transactionType={formData.type as "income" | "expense"}
              amountInCents={formData.amount}
            />
          )}

          <AccountCategoryFields
            accountId={formData.account_id}
            categoryId={formData.category_id}
            status={formData.status}
            type={formData.type}
            accounts={filteredAccounts}
            categories={filteredCategories}
            validationErrors={validationErrors}
            onAccountChange={(value) =>
              setFormData((prev) => ({ ...prev, account_id: value }))
            }
            onCategoryChange={(value) =>
              setFormData((prev) => ({ ...prev, category_id: value }))
            }
            onStatusChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                status: value as "pending" | "completed",
              }))
            }
          />

          {formData.account_id && selectedAccount?.type === "credit" && (
            <InvoiceMonthSelector
              invoiceMonth={formData.invoiceMonth}
              onInvoiceMonthChange={(value) =>
                setFormData((prev) => ({ ...prev, invoiceMonth: value }))
              }
            />
          )}

          <InstallmentOptions
            isInstallment={formData.isInstallment}
            installments={formData.installments}
            customInstallments={customInstallments}
            amount={formData.amount}
            accountType={selectedAccount?.type}
            isRecurring={formData.isRecurring}
            isFixed={formData.isFixed}
            onInstallmentChange={(checked: boolean) =>
              setFormData((prev) => ({
                ...prev,
                isInstallment: checked,
              }))
            }
            onInstallmentsChange={(value) => {
              setFormData((prev) => ({ ...prev, installments: value }));
            }}
            onCustomInstallmentsChange={setCustomInstallments}
          />

          <FixedTransactionOptions
            isFixed={formData.isFixed}
            date={formData.date}
            isInstallment={formData.isInstallment}
            isRecurring={formData.isRecurring}
            onFixedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                isFixed: checked,
              }))
            }
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 text-body"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 text-body">
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
