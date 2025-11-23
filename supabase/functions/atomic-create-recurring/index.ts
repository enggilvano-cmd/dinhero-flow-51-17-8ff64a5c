import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimiters } from '../_shared/rate-limiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecurringTransactionInput {
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category_id: string;
  account_id: string;
  status: 'pending' | 'completed';
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_end_date?: string;
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

    // Rate limiting
    const rateLimitResponse = rateLimiters.standard.middleware(req, user.id);
    if (rateLimitResponse) {
      return new Response(
        rateLimitResponse.body,
        { 
          status: rateLimitResponse.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(rateLimitResponse.headers.entries()) } 
        }
      );
    }

    const body: RecurringTransactionInput = await req.json();

    console.log('[atomic-create-recurring] INFO: Creating recurring transaction for user:', user.id);

    // Call atomic SQL function
    const { data: result, error: functionError } = await supabaseClient
      .rpc('atomic_create_recurring_transaction', {
        p_user_id: user.id,
        p_description: body.description,
        p_amount: Math.abs(body.amount),
        p_date: body.date,
        p_type: body.type,
        p_category_id: body.category_id,
        p_account_id: body.account_id,
        p_status: body.status,
        p_recurrence_type: body.recurrence_type,
        p_recurrence_end_date: body.recurrence_end_date || null,
      });

    if (functionError) {
      console.error('[atomic-create-recurring] ERROR: Function failed:', functionError);
      throw functionError;
    }

    const record = result[0];
    
    if (!record.success) {
      console.error('[atomic-create-recurring] ERROR:', record.error_message);
      return new Response(
        JSON.stringify({ 
          error: record.error_message,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[atomic-create-recurring] INFO: Created', record.created_count, 'recurring transaction(s)');

    return new Response(
      JSON.stringify({
        created_count: record.created_count,
        parent_id: record.parent_id,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-create-recurring] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
