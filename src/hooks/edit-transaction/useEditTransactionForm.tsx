import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Transaction, Account } from '@/types';
import { createDateFromString } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { editTransactionSchema } from '@/lib/validationSchemas';
import { z } from 'zod';
import { validateBalanceForEdit } from '@/hooks/useBalanceValidation';


interface FormData {
  description: string;
  amountInCents: number;
  date: Date;
  type: "income" | "expense";
  category_id: string;
  account_id: string;
  status: "pending" | "completed";
  invoiceMonth: string;
}

export function useEditTransactionForm(
  transaction: Transaction | null,
  accounts: Account[],
  open: boolean
) {
  const [formData, setFormData] = useState<FormData>({
    description: "",
    amountInCents: 0,
    date: new Date(),
    type: "expense",
    category_id: "",
    account_id: "",
    status: "completed",
    invoiceMonth: "",
  });
  const [originalData, setOriginalData] = useState(formData);
  const { toast } = useToast();

  useEffect(() => {
    if (open && transaction) {
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      const initialData: FormData = {
        description: transaction.description || "",
        amountInCents: Math.abs(transaction.amount),
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id || "",
        account_id: transaction.account_id || "",
        status: transaction.status || "completed",
        invoiceMonth: transaction.invoice_month_overridden ? (transaction.invoice_month || "") : "",
      };
      
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [open, transaction, accounts]);

  const validateForm = async (): Promise<boolean> => {
    if (!transaction) return false;

    try {
      const validationData = {
        id: transaction.id,
        description: formData.description,
        amount: formData.amountInCents,
        date: formData.date.toISOString().split('T')[0],
        type: formData.type,
        category_id: formData.category_id,
        account_id: formData.account_id,
        status: formData.status,
        invoiceMonth: formData.invoiceMonth,
      };

      editTransactionSchema.parse(validationData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive",
        });
        logger.error("Validation errors:", error.errors);
        return false;
      }
    }

    return true;
  };

  const validateBalance = async (): Promise<boolean> => {
    if (!transaction) return false;

    const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
    const newAmount = Math.abs(formData.amountInCents);
    const oldAmount = Math.abs(transaction.amount);

    if (selectedAccount && formData.type === 'expense') {
      try {
        if (transaction.type !== 'transfer') {
          const validation = await validateBalanceForEdit(
            selectedAccount,
            newAmount,
            oldAmount,
            formData.type,
            transaction.type,
            transaction.id,
            transaction.status
          );

          if (!validation.isValid) {
            toast({
              title: selectedAccount.type === 'credit' ? "Limite de crédito excedido" : "Saldo insuficiente",
              description: validation.errorMessage || validation.message,
              variant: "destructive",
            });
            return false;
          }
        }
      } catch (error) {
        logger.error('Error validating balance/credit limit:', error);
        toast({
          title: "Erro ao validar",
          description: "Não foi possível validar o saldo. Por favor, tente novamente.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const getUpdates = (): Partial<Transaction> | null => {
    const updates: Partial<Transaction> = {};
    
    if (formData.description.trim() !== originalData.description.trim()) {
      updates.description = formData.description.trim();
    }
    
    if (formData.amountInCents !== originalData.amountInCents || formData.type !== originalData.type) {
      updates.amount = Math.abs(formData.amountInCents);
    }
    
    if (formData.date.getTime() !== originalData.date.getTime()) {
      updates.date = formData.date;
    }
    
    if (formData.type !== originalData.type) {
      updates.type = formData.type;
    }
    
    if (formData.category_id !== originalData.category_id) {
      updates.category_id = formData.category_id;
    }
    
    if (formData.account_id !== originalData.account_id) {
      updates.account_id = formData.account_id;
    }
    
    if (formData.status !== originalData.status) {
      updates.status = formData.status;
    }
    
    if (formData.invoiceMonth !== originalData.invoiceMonth) {
      updates.invoice_month = formData.invoiceMonth || undefined;
      updates.invoice_month_overridden = Boolean(formData.invoiceMonth);
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhuma alteração foi detectada",
        variant: "default",
      });
      return null;
    }

    return updates;
  };

  return {
    formData,
    setFormData,
    validateForm,
    validateBalance,
    getUpdates,
  };
}
