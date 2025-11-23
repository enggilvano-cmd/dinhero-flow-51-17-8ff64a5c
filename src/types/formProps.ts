/**
 * Tipos dedicados para props de componentes de formulário
 * Garante type safety e consistência nas interfaces dos modais
 */

import { Account, Category, Transaction } from "./index";
import {
  AddAccountFormData,
  EditAccountFormData,
  AddCategoryFormData,
  EditCategoryFormData,
  AddTransactionFormData,
  EditTransactionFormData,
  TransferFormData,
  MarkAsPaidFormData,
} from "@/lib/validationSchemas";

// ============= Base Modal Props =============

export interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============= Account Modal Props =============

export interface AddAccountModalProps extends BaseModalProps {}

export interface EditAccountModalProps extends BaseModalProps {
  account: Account | null;
  onEditAccount: (account: Account) => Promise<void>;
}

// ============= Category Modal Props =============

export interface AddCategoryModalProps extends BaseModalProps {
  onAddCategory: (category: Omit<Category, "id">) => void;
}

export interface EditCategoryModalProps extends BaseModalProps {
  category: Category | null;
  onEditCategory: (category: Category) => void;
}

// ============= Transaction Modal Props =============

export interface AddTransactionModalProps extends BaseModalProps {
  accounts: Account[];
  categories: Category[];
}

export interface EditTransactionModalProps extends BaseModalProps {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onEditTransaction: (
    id: string,
    updates: Partial<Transaction>,
    scope?: "current" | "current-and-remaining" | "all"
  ) => Promise<void>;
}

export interface TransferModalProps extends BaseModalProps {
  accounts: Account[];
  onAddTransfer: (transfer: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    description: string;
    date: Date;
    status: "pending" | "completed";
  }) => Promise<void>;
}

// ============= Mark as Paid Modal Props =============

export interface MarkAsPaidModalProps extends BaseModalProps {
  transaction: Transaction | null;
  accounts: Account[];
  onConfirm: (
    transactionId: string,
    date: Date,
    amount: number,
    accountId: string
  ) => void;
}

// ============= Re-export Form Data Types =============

export type {
  AddAccountFormData,
  EditAccountFormData,
  AddCategoryFormData,
  EditCategoryFormData,
  AddTransactionFormData,
  EditTransactionFormData,
  TransferFormData,
  MarkAsPaidFormData,
};
