import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimiters } from '../_shared/rate-limiter.ts';
import { EditTransactionInputSchema, validateWithZod, validationErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EditInput {
  transaction_id: string;
  updates: {
    description?: string;
    amount?: number;
    date?: string;
    type?: 'income' | 'expense';
    category_id?: string;
    account_id?: string;
    status?: 'pending' | 'completed';
    invoice_month?: string;
  };
  scope?: 'current' | 'current-and-remaining' | 'all';
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

    // Rate limiting - Strict para edições (mais sensível)
    const rateLimitResponse = rateLimiters.strict.middleware(req, user.id);
    if (rateLimitResponse) {
      console.warn('[atomic-edit] WARN: Rate limit exceeded for user:', user.id);
      return new Response(
        rateLimitResponse.body,
        { 
          status: rateLimitResponse.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(rateLimitResponse.headers.entries()) } 
        }
      );
    }

    const body = await req.json();

    console.log('[atomic-edit] INFO: Editing transaction for user:', user.id);

    // Validação Zod
    const validation = validateWithZod(EditTransactionInputSchema, body);
    if (!validation.success) {
      console.error('[atomic-edit] ERROR: Validation failed:', validation.errors);
      return validationErrorResponse(validation.errors, corsHeaders);
    }

    const { transaction_id, updates, scope } = validation.data;

    // Usar função PL/pgSQL atômica
    const { data: result, error: functionError } = await supabaseClient
      .rpc('atomic_update_transaction', {
        p_user_id: user.id,
        p_transaction_id: transaction_id,
        p_updates: updates,
        p_scope: scope || 'current',
      });

    if (functionError) {
      console.error('[atomic-edit-transaction] ERROR: Function failed:', functionError);
      throw functionError;
    }

    const record = result[0];
    
    if (!record.success) {
      console.error('[atomic-edit-transaction] ERROR:', record.error_message);
      return new Response(
        JSON.stringify({ 
          error: record.error_message,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atomic-edit-transaction] INFO: Updated', record.updated_count, 'transaction(s)');

    return new Response(
      JSON.stringify({
        updated: record.updated_count,
        affected_accounts: record.affected_accounts,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-edit] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});