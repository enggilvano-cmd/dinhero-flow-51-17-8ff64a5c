import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimiters } from '../_shared/rate-limiter.ts';
import { TransferInputSchema, validateWithZod, validationErrorResponse } from '../_shared/validation.ts';
import { uuidSchema, numberSchema, dateSchema, stringSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  description?: string;
}

// Validação de inputs
function validateTransferInput(input: TransferInput): { valid: boolean; error?: string } {
  // Validar UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(input.from_account_id)) {
    return { valid: false, error: 'Invalid from_account_id format' };
  }
  if (!uuidRegex.test(input.to_account_id)) {
    return { valid: false, error: 'Invalid to_account_id format' };
  }
  
  // Validar amount
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  if (input.amount > 1000000000) {
    return { valid: false, error: 'Amount exceeds maximum allowed value' };
  }
  
  // Validar date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }
  
  // Validar description (opcional)
  if (input.description && input.description.length > 200) {
    return { valid: false, error: 'Description must be less than 200 characters' };
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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting - Strict para transferências (operação sensível)
    const rateLimitResponse = rateLimiters.strict.middleware(req, user.id);
    if (rateLimitResponse) {
      console.warn('[atomic-transfer] WARN: Rate limit exceeded for user:', user.id);
      return new Response(
        rateLimitResponse.body,
        { 
          status: rateLimitResponse.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(rateLimitResponse.headers.entries()) } 
        }
      );
    }

    const body = await req.json();

    console.log('[atomic-transfer] INFO: Processing transfer for user:', user.id);

    // Validação Zod
    const validation = validateWithZod(TransferInputSchema, body.transfer || body);
    if (!validation.success) {
      console.error('[atomic-transfer] ERROR: Validation failed:', validation.errors);
      return validationErrorResponse(validation.errors, corsHeaders);
    }

    const transfer = validation.data;

    // Usar função PL/pgSQL atômica
    const { data: result, error: functionError } = await supabaseClient
      .rpc('atomic_create_transfer', {
        p_user_id: user.id,
        p_from_account_id: transfer.from_account_id,
        p_to_account_id: transfer.to_account_id,
        p_amount: transfer.amount,
        p_description: transfer.description,
        p_date: transfer.date,
        p_status: transfer.status,
      });

    if (functionError) {
      console.error('[atomic-transfer] ERROR: Function failed:', functionError);
      throw functionError;
    }

    const record = result[0];
    
    if (!record.success) {
      console.error('[atomic-transfer] ERROR:', record.error_message);
      return new Response(
        JSON.stringify({ 
          error: record.error_message,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atomic-transfer] INFO: Transfer created successfully');

    return new Response(
      JSON.stringify({
        outgoing_transaction_id: record.outgoing_transaction_id,
        incoming_transaction_id: record.incoming_transaction_id,
        from_balance: record.from_balance,
        to_balance: record.to_balance,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-transfer] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});