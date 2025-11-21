import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { transaction_id, scope }: DeleteInput = await req.json();

    console.log('[atomic-delete] INFO: Deleting transaction:', transaction_id, 'scope:', scope);
    console.log('[atomic-delete] INFO: User ID:', user.id);

    // Buscar transação original
    const { data: targetTx, error: fetchError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('[atomic-delete] ERROR: Failed to fetch transaction:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found',
          details: fetchError.message,
          code: fetchError.code
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetTx) {
      console.error('[atomic-delete] ERROR: Transaction not found for id:', transaction_id);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o período está fechado
    const { data: isLocked } = await supabaseClient
      .rpc('is_period_locked', { 
        p_user_id: user.id, 
        p_date: targetTx.date 
      });

    if (isLocked) {
      console.error('[atomic-delete] ERROR: Period is locked:', targetTx.date);
      return new Response(
        JSON.stringify({ 
          error: 'Period is locked',
          message: 'Cannot delete transactions in a locked period. Please unlock the period first.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const affectedAccounts = new Set<string>([targetTx.account_id]);
    let transactionsToDelete = [transaction_id];

    // Se é transferência, incluir transação vinculada
    if (targetTx.linked_transaction_id) {
      transactionsToDelete.push(targetTx.linked_transaction_id);

      const { data: linkedTx } = await supabaseClient
        .from('transactions')
        .select('account_id')
        .eq('id', targetTx.linked_transaction_id)
        .single();

      if (linkedTx) {
        affectedAccounts.add(linkedTx.account_id);
      }
    }

    // Se é parcela, buscar outras conforme escopo
    const isInstallment = targetTx.parent_transaction_id || targetTx.installments > 1;
    if (isInstallment) {
      const groupParentId = targetTx.parent_transaction_id || targetTx.id;

      let query = supabaseClient
        .from('transactions')
        .select('id, account_id')
        .eq('user_id', user.id);

      if (!scope || scope === 'all') {
        // Deletar todas as parcelas
        query = query.or(`id.eq.${groupParentId},parent_transaction_id.eq.${groupParentId}`);
      } else if (scope === 'current-and-remaining') {
        // Deletar parcela atual e próximas
        query = query
          .eq('parent_transaction_id', groupParentId)
          .gte('current_installment', targetTx.current_installment);
      }
      // scope === 'current': já está em transactionsToDelete

      if (scope !== 'current') {
        const { data: installments, error: instError } = await query;

        if (instError) {
          console.error('[atomic-delete] ERROR:', instError);
          throw instError;
        }

        if (installments && installments.length > 0) {
          for (const inst of installments) {
            if (!transactionsToDelete.includes(inst.id)) {
              transactionsToDelete.push(inst.id);
              affectedAccounts.add(inst.account_id);
            }
          }
        }
      }
    }

    console.log('[atomic-delete] INFO: Deleting', transactionsToDelete.length, 'transactions');

    // DELETAR TODAS AS TRANSAÇÕES ATOMICAMENTE
    const { error: deleteError } = await supabaseClient
      .from('transactions')
      .delete()
      .in('id', transactionsToDelete)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[atomic-delete] ERROR:', deleteError);
      throw deleteError;
    }

    // RECALCULAR SALDOS DAS CONTAS AFETADAS
    const balanceResults = [];
    for (const accountId of affectedAccounts) {
      const { data: balData, error: balError } = await supabaseClient
        .rpc('recalculate_account_balance', { p_account_id: accountId });

        if (balError) {
          console.error('[atomic-delete] ERROR: Balance recalc failed:', balError);
        throw balError;
      }
      balanceResults.push({ accountId, ...balData[0] });
    }

    return new Response(
      JSON.stringify({
        deleted: transactionsToDelete.length,
        balances: balanceResults,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-delete] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});