import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DeleteTransactionInputSchema, validateWithZod, validationErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteInput {
  transaction_id: string;
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

    const body = await req.json();

    console.log('[atomic-delete] INFO: Deleting transaction for user:', user.id);

    // Validação Zod
    const validation = validateWithZod(DeleteTransactionInputSchema, body);
    if (!validation.success) {
      console.error('[atomic-delete] ERROR: Validation failed:', validation.errors);
      return validationErrorResponse(validation.errors, corsHeaders);
    }

    const { transaction_id, scope } = validation.data;

    // Usar função PL/pgSQL atômica
    const { data: result, error: functionError } = await supabaseClient
      .rpc('atomic_delete_transaction', {
        p_user_id: user.id,
        p_transaction_id: transaction_id,
        p_scope: scope || 'current',
      });

    if (functionError) {
      console.error('[atomic-delete-transaction] ERROR: Function failed:', functionError);
      throw functionError;
    }

    const record = result[0];
    
    if (!record.success) {
      console.error('[atomic-delete-transaction] ERROR:', record.error_message);
      return new Response(
        JSON.stringify({ 
          error: record.error_message,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atomic-delete-transaction] INFO: Deleted', record.deleted_count, 'transaction(s)');

    return new Response(
      JSON.stringify({
        deleted: record.deleted_count,
        affected_accounts: record.affected_accounts,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-delete] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});