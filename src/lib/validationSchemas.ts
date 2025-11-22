import { z } from "zod";
import { MAX_DESCRIPTION_LENGTH, MAX_TRANSACTION_AMOUNT } from "./constants";

// Schema para AddTransactionModal
export const addTransactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: "A descrição é obrigatória" })
    .max(MAX_DESCRIPTION_LENGTH, { 
      message: `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres` 
    }),
  
  amount: z
    .number({ invalid_type_error: "O valor deve ser um número" })
    .positive({ message: "O valor deve ser maior que zero" })
    .max(MAX_TRANSACTION_AMOUNT, { 
      message: `O valor não pode ser maior que ${(MAX_TRANSACTION_AMOUNT / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` 
    }),
  
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida. Use o formato AAAA-MM-DD" })
    .refine((dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      return !isNaN(date.getTime());
    }, { message: "Data inválida" }),
  
  type: z.enum(["income", "expense", "transfer"], {
    required_error: "Selecione o tipo da transação",
    invalid_type_error: "Tipo de transação inválido",
  }),
  
  category_id: z
    .string()
    .uuid({ message: "Categoria inválida" })
    .min(1, { message: "Selecione uma categoria" }),
  
  account_id: z
    .string()
    .uuid({ message: "Conta inválida" })
    .min(1, { message: "Selecione uma conta" }),
  
  status: z.enum(["pending", "completed"], {
    invalid_type_error: "Status inválido",
  }),
  
  isInstallment: z.boolean().optional(),
  
  installments: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      if (val === "custom") return true; // "custom" é válido aqui
      const num = parseInt(val);
      return !isNaN(num) && num >= 2 && num <= 360;
    }, { message: "O número de parcelas deve estar entre 2 e 360" }),
  
  customInstallments: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const num = parseInt(val);
      return !isNaN(num) && num >= 2 && num <= 360;
    }, { message: "O número de parcelas deve estar entre 2 e 360" }),
  
  invoiceMonth: z.string().optional(),
  
  isRecurring: z.boolean().optional(),
  
  recurrenceType: z
    .enum(["daily", "weekly", "monthly", "yearly"])
    .optional(),
  
  recurrenceEndDate: z.string().optional(),
  
  isFixed: z.boolean().optional(),
});

export type AddTransactionFormData = z.infer<typeof addTransactionSchema>;

// Schema para EditTransactionModal
export const editTransactionSchema = addTransactionSchema.extend({
  id: z.string().uuid({ message: "ID da transação inválido" }),
});

export type EditTransactionFormData = z.infer<typeof editTransactionSchema>;

// Schema para transferências
export const transferSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: "A descrição é obrigatória" })
    .max(MAX_DESCRIPTION_LENGTH, { 
      message: `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres` 
    }),
  
  amount: z
    .number({ invalid_type_error: "O valor deve ser um número" })
    .positive({ message: "O valor deve ser maior que zero" })
    .max(MAX_TRANSACTION_AMOUNT, { 
      message: `O valor não pode ser maior que ${(MAX_TRANSACTION_AMOUNT / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` 
    }),
  
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida. Use o formato AAAA-MM-DD" })
    .refine((dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      return !isNaN(date.getTime());
    }, { message: "Data inválida" }),
  
  from_account_id: z
    .string()
    .uuid({ message: "Conta de origem inválida" })
    .min(1, { message: "Selecione a conta de origem" }),
  
  to_account_id: z
    .string()
    .uuid({ message: "Conta de destino inválida" })
    .min(1, { message: "Selecione a conta de destino" }),
}).refine((data) => data.from_account_id !== data.to_account_id, {
  message: "A conta de origem não pode ser igual à conta de destino",
  path: ["to_account_id"],
});

export type TransferFormData = z.infer<typeof transferSchema>;
