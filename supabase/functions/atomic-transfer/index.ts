import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { transfer }: { transfer: TransferInput } = await req.json();

    console.log('[atomic-transfer] Processing transfer for user:', user.id);

    // Validações
    if (!transfer.from_account_id || !transfer.to_account_id || !transfer.amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transfer.from_account_id === transfer.to_account_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot transfer to the same account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar contas
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('accounts')
      .select('*')
      .in('id', [transfer.from_account_id, transfer.to_account_id])
      .eq('user_id', user.id);

    if (accountsError || accounts.length !== 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid accounts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromAccount = accounts.find(a => a.id === transfer.from_account_id);
    const toAccount = accounts.find(a => a.id === transfer.to_account_id);

    // Validar limite
    if (fromAccount.type === 'checking' && fromAccount.limit_amount) {
      const futureBalance = fromAccount.balance - transfer.amount;
      if (futureBalance < 0 && Math.abs(futureBalance) > fromAccount.limit_amount) {
        return new Response(
          JSON.stringify({
            error: `Transfer exceeds limit of ${fromAccount.name}`,
            limit: fromAccount.limit_amount,
            futureBalance,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // TRANSAÇÃO ATÔMICA: Criar AMBAS as transações vinculadas
    // 1. Saída
    const { data: outgoingTx, error: outError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transfer.description || `Transferência para ${toAccount.name}`,
        amount: -Math.abs(transfer.amount),
        date: transfer.date,
        type: 'expense',
        category_id: null, // Transferências não têm categoria
        account_id: transfer.from_account_id,
        to_account_id: transfer.to_account_id,
        status: 'completed',
      })
      .select()
      .single();

    if (outError) {
      console.error('[atomic-transfer] Outgoing transaction error:', outError);
      throw outError;
    }

    // 2. Entrada (vincular à saída)
    const { data: incomingTx, error: inError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transfer.description || `Transferência de ${fromAccount.name}`,
        amount: Math.abs(transfer.amount),
        date: transfer.date,
        type: 'income',
        category_id: null,
        account_id: transfer.to_account_id,
        linked_transaction_id: outgoingTx.id,
        status: 'completed',
      })
      .select()
      .single();

    if (inError) {
      console.error('[atomic-transfer] Incoming transaction error:', inError);
      // Reverter transação de saída
      await supabaseClient.from('transactions').delete().eq('id', outgoingTx.id);
      throw inError;
    }

    // 3. Vincular a transação de saída à de entrada
    await supabaseClient
      .from('transactions')
      .update({ linked_transaction_id: incomingTx.id })
      .eq('id', outgoingTx.id);

    // 4. Recalcular saldos de AMBAS as contas atomicamente
    const { data: fromBalance, error: fromBalError } = await supabaseClient
      .rpc('recalculate_account_balance', { p_account_id: transfer.from_account_id });

    if (fromBalError) {
      console.error('[atomic-transfer] From balance error:', fromBalError);
      // Reverter ambas transações
      await supabaseClient.from('transactions').delete().in('id', [outgoingTx.id, incomingTx.id]);
      throw fromBalError;
    }

    const { data: toBalance, error: toBalError } = await supabaseClient
      .rpc('recalculate_account_balance', { p_account_id: transfer.to_account_id });

    if (toBalError) {
      console.error('[atomic-transfer] To balance error:', toBalError);
      // Reverter tudo
      await supabaseClient.from('transactions').delete().in('id', [outgoingTx.id, incomingTx.id]);
      await supabaseClient.rpc('recalculate_account_balance', { p_account_id: transfer.from_account_id });
      throw toBalError;
    }

    console.log('[atomic-transfer] Transfer completed successfully');

    return new Response(
      JSON.stringify({
        outgoing: outgoingTx,
        incoming: incomingTx,
        from_balance: fromBalance[0],
        to_balance: toBalance[0],
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-transfer] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});