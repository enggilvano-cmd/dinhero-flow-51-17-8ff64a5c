import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      console.error('[atomic-transaction] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transaction }: { transaction: TransactionInput } = await req.json();

    console.log('[atomic-transaction] Creating transaction for user:', user.id);

    // Validações
    if (!transaction.description || !transaction.amount || !transaction.account_id || !transaction.category_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INICIAR TRANSAÇÃO ATÔMICA
    // Verificar se é conta de crédito
    const { data: accountData, error: accountError } = await supabaseClient
      .from('accounts')
      .select('type')
      .eq('id', transaction.account_id)
      .single();

    if (accountError) {
      console.error('[atomic-transaction] Account fetch error:', accountError);
      throw accountError;
    }

    const isCreditCard = accountData.type === 'credit';
    
    // Para cartões de crédito, inverter a lógica:
    // - Despesa: saldo fica mais negativo (aumenta dívida)
    // - Receita/Pagamento: saldo fica menos negativo (diminui dívida)
    let amount: number;
    if (isCreditCard) {
      // Cartão: expense aumenta dívida (negativo), income diminui (positivo)
      amount = transaction.type === 'expense' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);
    } else {
      // Outras contas: comportamento normal
      amount = transaction.type === 'expense' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);
    }

    // 1. Inserir transação
    const { data: newTransaction, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transaction.description,
        amount: amount,
        date: transaction.date,
        type: transaction.type,
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        status: transaction.status,
        invoice_month: transaction.invoice_month || null,
        invoice_month_overridden: transaction.invoice_month_overridden || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[atomic-transaction] Insert error:', insertError);
      throw insertError;
    }

    // 2. Recalcular saldo APENAS se status = 'completed' usando função atômica
    if (transaction.status === 'completed') {
      const { data: recalcResult, error: recalcError } = await supabaseClient
        .rpc('recalculate_account_balance', {
          p_account_id: transaction.account_id,
        });

      if (recalcError) {
        console.error('[atomic-transaction] Balance recalc error:', recalcError);
        // Tentar reverter a transação
        await supabaseClient
          .from('transactions')
          .delete()
          .eq('id', newTransaction.id);
        throw recalcError;
      }

      console.log('[atomic-transaction] Balance recalculated:', recalcResult[0]);

      return new Response(
        JSON.stringify({
          transaction: newTransaction,
          balance: recalcResult[0],
          success: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Status pending - não recalcula saldo
    return new Response(
      JSON.stringify({
        transaction: newTransaction,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[atomic-transaction] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});