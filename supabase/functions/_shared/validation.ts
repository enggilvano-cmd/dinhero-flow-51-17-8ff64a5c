/**
 * Validação centralizada usando Zod para Edge Functions
 */

// Tipos básicos
export const uuidSchema = {
  parse: (value: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('Invalid UUID format');
    }
    return value;
  }
};

export const dateSchema = {
  parse: (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return value;
  }
};

export const stringSchema = (options?: { min?: number; max?: number; trim?: boolean }) => ({
  parse: (value: string) => {
    let str = value;
    if (options?.trim !== false) {
      str = str.trim();
    }
    if (options?.min && str.length < options.min) {
      throw new Error(`String must be at least ${options.min} characters`);
    }
    if (options?.max && str.length > options.max) {
      throw new Error(`String must be less than ${options.max} characters`);
    }
    return str;
  }
});

export const numberSchema = (options?: { min?: number; max?: number; positive?: boolean }) => ({
  parse: (value: number) => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      throw new Error('Must be a valid number');
    }
    if (options?.positive && value <= 0) {
      throw new Error('Must be a positive number');
    }
    if (options?.min !== undefined && value < options.min) {
      throw new Error(`Must be greater than or equal to ${options.min}`);
    }
    if (options?.max !== undefined && value > options.max) {
      throw new Error(`Must be less than or equal to ${options.max}`);
    }
    return value;
  }
});

export const enumSchema = <T extends string>(values: readonly T[]) => ({
  parse: (value: string): T => {
    if (!values.includes(value as T)) {
      throw new Error(`Must be one of: ${values.join(', ')}`);
    }
    return value as T;
  }
});

// Schemas para transações
export const transactionSchema = {
  description: stringSchema({ min: 1, max: 200 }),
  amount: numberSchema({ positive: true, max: 1_000_000_000 }),
  date: dateSchema,
  type: enumSchema(['income', 'expense'] as const),
  status: enumSchema(['pending', 'completed'] as const),
  account_id: uuidSchema,
  category_id: uuidSchema,
  to_account_id: uuidSchema, // opcional
  invoice_month: {
    parse: (value?: string) => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}$/.test(value)) {
        throw new Error('Invoice month must be in YYYY-MM format');
      }
      return value;
    }
  }
};

// Validação de objeto completo
export function validateTransaction(data: any) {
  const errors: Record<string, string> = {};

  try {
    transactionSchema.description.parse(data.description);
  } catch (e) {
    errors.description = e.message;
  }

  try {
    transactionSchema.amount.parse(data.amount);
  } catch (e) {
    errors.amount = e.message;
  }

  try {
    transactionSchema.date.parse(data.date);
  } catch (e) {
    errors.date = e.message;
  }

  try {
    transactionSchema.type.parse(data.type);
  } catch (e) {
    errors.type = e.message;
  }

  try {
    transactionSchema.status.parse(data.status);
  } catch (e) {
    errors.status = e.message;
  }

  try {
    transactionSchema.account_id.parse(data.account_id);
  } catch (e) {
    errors.account_id = e.message;
  }

  try {
    transactionSchema.category_id.parse(data.category_id);
  } catch (e) {
    errors.category_id = e.message;
  }

  if (data.invoice_month) {
    try {
      transactionSchema.invoice_month.parse(data.invoice_month);
    } catch (e) {
      errors.invoice_month = e.message;
    }
  }

  if (data.to_account_id) {
    try {
      transactionSchema.to_account_id.parse(data.to_account_id);
    } catch (e) {
      errors.to_account_id = e.message;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Helper para resposta de erro de validação
export function validationErrorResponse(errors: Record<string, string>, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: errors
    }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
