import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { transaction_id, updates, scope }: EditInput = await req.json();

    console.log('[atomic-edit] INFO: Editing transaction:', transaction_id, 'scope:', scope);

    // Buscar transação original
    const { data: oldTransaction, error: fetchError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !oldTransaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o período original está fechado
    const { data: isOldPeriodLocked } = await supabaseClient
      .rpc('is_period_locked', { 
        p_user_id: user.id, 
        p_date: oldTransaction.date 
      });

    if (isOldPeriodLocked) {
      console.error('[atomic-edit] ERROR: Original period is locked:', oldTransaction.date);
      return new Response(
        JSON.stringify({ 
          error: 'Period is locked',
          message: 'Cannot edit transactions in a locked period. Please unlock the period first.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se está mudando a data, verificar se o novo período também está fechado
    if (updates.date && updates.date !== oldTransaction.date) {
      const { data: isNewPeriodLocked } = await supabaseClient
        .rpc('is_period_locked', { 
          p_user_id: user.id, 
          p_date: updates.date 
        });

      if (isNewPeriodLocked) {
        console.error('[atomic-edit] ERROR: New period is locked:', updates.date);
        return new Response(
          JSON.stringify({ 
            error: 'Period is locked',
            message: 'Cannot move transactions to a locked period. Please unlock the period first.' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const affectedAccounts = new Set<string>([oldTransaction.account_id]);
    if (updates.account_id && updates.account_id !== oldTransaction.account_id) {
      affectedAccounts.add(updates.account_id);
    }

    // Verificar se é conta de crédito para ajustar o sinal do amount
    const accountsToCheck = Array.from(affectedAccounts);
    const { data: accountsData } = await supabaseClient
      .from('accounts')
      .select('id, type')
      .in('id', accountsToCheck);

    // Preparar dados de atualização
    const updateData: any = {};
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.amount !== undefined) {
      const type = updates.type || oldTransaction.type;
      const targetAccountId = updates.account_id || oldTransaction.account_id;
      const targetAccount = accountsData?.find(a => a.id === targetAccountId);
      const isCreditCard = targetAccount?.type === 'credit';
      
      // Para cartões: expense = negativo (dívida), income = positivo (pagamento)
      // Para outras contas: mesmo comportamento
      updateData.amount = type === 'expense' ? -Math.abs(updates.amount) : Math.abs(updates.amount);
    }
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.account_id !== undefined) updateData.account_id = updates.account_id;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.invoice_month !== undefined) {
      updateData.invoice_month = updates.invoice_month || null;
      updateData.invoice_month_overridden = !!updates.invoice_month;
    }

    // Determinar se é parcela
    const isInstallment = oldTransaction.parent_transaction_id || oldTransaction.installments > 1;

    if (!isInstallment || scope === 'current') {
      // Edição única
      const { error: updateError } = await supabaseClient
        .from('transactions')
        .update(updateData)
        .eq('id', transaction_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[atomic-edit] ERROR:', updateError);
        throw updateError;
      }

      // Recalcular saldos das contas afetadas
      const balanceResults = [];
      for (const accountId of affectedAccounts) {
        const { data: balData, error: balError } = await supabaseClient
          .rpc('recalculate_account_balance', { p_account_id: accountId });

        if (balError) {
          console.error('[atomic-edit] ERROR: Balance recalc failed:', balError);
          throw balError;
        }
        balanceResults.push({ accountId, ...balData[0] });
      }

      return new Response(
        JSON.stringify({
          updated: 1,
          balances: balanceResults,
          success: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Edição em lote de parcelas
    const groupParentId = oldTransaction.parent_transaction_id || oldTransaction.id;

    let query = supabaseClient
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);

    if (oldTransaction.parent_transaction_id) {
      // É parcela filha
      query = query.eq('parent_transaction_id', groupParentId);

      if (scope === 'current-and-remaining') {
        query = query.gte('current_installment', oldTransaction.current_installment);
      }
    } else {
      // É parcela mãe
      if (scope === 'all') {
        query = query.or(`id.eq.${oldTransaction.id},parent_transaction_id.eq.${groupParentId}`);
      } else {
        query = query.eq('parent_transaction_id', groupParentId)
          .gte('current_installment', oldTransaction.current_installment);
      }
    }

    const { data: targetTransactions, error: targetsError } = await query;

    if (targetsError || !targetTransactions || targetTransactions.length === 0) {
      console.error('[atomic-edit] ERROR: Failed to fetch target transactions:', targetsError);
      throw targetsError || new Error('No transactions found');
    }

    console.log('[atomic-edit] INFO: Updating', targetTransactions.length, 'transactions');

    // Atualizar todas as transações alvo
    const updatePromises = targetTransactions.map(tx =>
      supabaseClient
        .from('transactions')
        .update(updateData)
        .eq('id', tx.id)
        .eq('user_id', user.id)
    );

    await Promise.all(updatePromises);

    // Recalcular saldos
    const balanceResults = [];
    for (const accountId of affectedAccounts) {
      const { data: balData, error: balError } = await supabaseClient
        .rpc('recalculate_account_balance', { p_account_id: accountId });

        if (balError) {
          console.error('[atomic-edit] ERROR: Balance recalc failed:', balError);
        throw balError;
      }
      balanceResults.push({ accountId, ...balData[0] });
    }

    return new Response(
      JSON.stringify({
        updated: targetTransactions.length,
        balances: balanceResults,
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