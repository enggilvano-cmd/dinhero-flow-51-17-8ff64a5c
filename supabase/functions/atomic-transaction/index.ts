import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimiters } from '../_shared/rate-limiter.ts';
import { TransactionInputSchema, validateWithZod, validationErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants
const MAX_TRANSACTION_AMOUNT = 1_000_000_000; // 1 billion cents
const MAX_DESCRIPTION_LENGTH = 200;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TransactionInput {
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category_id: string;
  account_id: string;
  status: 'pending' | 'completed';
  invoice_month?: string;
  invoice_month_overridden?: boolean;
}

// Validação de inputs
function validateTransactionInput(input: TransactionInput): { valid: boolean; error?: string } {
  if (!input.description || input.description.trim().length === 0) {
    return { valid: false, error: 'Description is required and cannot be empty' };
  }
  if (input.description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  if (input.amount > MAX_TRANSACTION_AMOUNT) {
    return { valid: false, error: 'Amount exceeds maximum allowed value' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }
  if (!['income', 'expense'].includes(input.type)) {
    return { valid: false, error: 'Type must be either income or expense' };
  }
  if (!['pending', 'completed'].includes(input.status)) {
    return { valid: false, error: 'Status must be either pending or completed' };
  }
  if (!UUID_REGEX.test(input.account_id)) {
    return { valid: false, error: 'Invalid account_id format' };
  }
  if (!UUID_REGEX.test(input.category_id)) {
    return { valid: false, error: 'Invalid category_id format' };
  }
  if (input.invoice_month && !/^\d{4}-\d{2}$/.test(input.invoice_month)) {
    return { valid: false, error: 'Invoice month must be in YYYY-MM format' };
  }
  
  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[atomic-transaction] ERROR: Auth failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting - Moderado para criação de transações
    const rateLimitResponse = rateLimiters.moderate.middleware(req, user.id);
    if (rateLimitResponse) {
      console.warn('[atomic-transaction] WARN: Rate limit exceeded for user:', user.id);
      return new Response(
        rateLimitResponse.body,
        { 
          status: rateLimitResponse.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(rateLimitResponse.headers.entries()) } 
        }
      );
    }

    const body = await req.json();

    console.log('[atomic-transaction] INFO: Creating transaction for user:', user.id);

    // Validação Zod
    const validation = validateWithZod(TransactionInputSchema, body.transaction);
    if (!validation.success) {
      console.error('[atomic-transaction] ERROR: Validation failed:', validation.errors);
      return validationErrorResponse(validation.errors, corsHeaders);
    }

    const transaction = validation.data;

    // Usar função PL/pgSQL atômica
    const { data: result, error: functionError } = await supabaseClient
      .rpc('atomic_create_transaction', {
        p_user_id: user.id,
        p_description: transaction.description,
        p_amount: transaction.amount,
        p_date: transaction.date,
        p_type: transaction.type,
        p_category_id: transaction.category_id,
        p_account_id: transaction.account_id,
        p_status: transaction.status,
        p_invoice_month: transaction.invoice_month || null,
        p_invoice_month_overridden: transaction.invoice_month_overridden || false,
      });

    if (functionError) {
      console.error('[atomic-transaction] ERROR: Function failed:', functionError);
      throw functionError;
    }

    const record = result[0];
    
    if (!record.success) {
      console.error('[atomic-transaction] ERROR:', record.error_message);
      return new Response(
        JSON.stringify({ 
          error: record.error_message,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atomic-transaction] INFO: Transaction created successfully:', record.transaction_id);

    return new Response(
      JSON.stringify({
        transaction: {
          id: record.transaction_id,
          ...transaction
        },
        balance: record.new_balance,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-transaction] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});