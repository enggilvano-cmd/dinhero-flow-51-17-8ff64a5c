import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayBillInput {
  credit_account_id: string; // Cartão de crédito (liability)
  debit_account_id: string;  // Conta bancária (asset)
  amount: number;            // Valor POSITIVO
  payment_date: string;      // YYYY-MM-DD
  description?: string;
}

// Validação de inputs
function validatePayBillInput(input: PayBillInput): { valid: boolean; error?: string } {
  // Validar UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(input.credit_account_id)) {
    return { valid: false, error: 'Invalid credit_account_id format' };
  }
  if (!uuidRegex.test(input.debit_account_id)) {
    return { valid: false, error: 'Invalid debit_account_id format' };
  }
  
  // Validar contas diferentes
  if (input.credit_account_id === input.debit_account_id) {
    return { valid: false, error: 'Credit and debit accounts must be different' };
  }
  
  // Validar amount
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  if (input.amount > 1000000000) {
    return { valid: false, error: 'Amount exceeds maximum allowed value' };
  }
  
  // Validar date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payment_date)) {
    return { valid: false, error: 'Payment date must be in YYYY-MM-DD format' };
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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payBillInput: PayBillInput = await req.json();
    const { credit_account_id, debit_account_id, amount, payment_date, description } = payBillInput;

    // Validações básicas
    if (!credit_account_id || !debit_account_id || !amount || !payment_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validação detalhada de inputs
    const validation = validatePayBillInput(payBillInput);
    if (!validation.valid) {
      console.error('[atomic-pay-bill] ERROR: Invalid input:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar contas
    const { data: accounts, error: accError } = await supabaseClient
      .from('accounts')
      .select('id, type, name')
      .in('id', [credit_account_id, debit_account_id])
      .eq('user_id', user.id);

    if (accError || !accounts || accounts.length !== 2) {
      return new Response(JSON.stringify({ error: 'Invalid accounts' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creditAcc = accounts.find(a => a.id === credit_account_id)!;
    const debitAcc = accounts.find(a => a.id === debit_account_id)!;

    // Inserir as duas transações vinculadas
    // 1) Saída da conta bancária (expense, negativo)
    const { data: debitTx, error: debitErr } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        description: description || `Pagamento Fatura ${creditAcc.name}`,
        amount: -Math.abs(amount),
        date: payment_date,
        type: 'expense',
        category_id: null,
        account_id: debit_account_id,
        status: 'completed',
      })
      .select()
      .single();

    if (debitErr) {
      console.error('[atomic-pay-bill] ERROR: debit insert failed:', debitErr);
      throw debitErr;
    }

    // 2) Entrada no cartão (income, positivo)
    const { data: creditTx, error: creditErr } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        description: description || `Pagamento Recebido de ${debitAcc.name}`,
        amount: Math.abs(amount),
        date: payment_date,
        type: 'income',
        category_id: null,
        account_id: credit_account_id,
        linked_transaction_id: debitTx.id,
        status: 'completed',
      })
      .select()
      .single();

    if (creditErr) {
      console.error('[atomic-pay-bill] ERROR: credit insert failed:', creditErr);
      await supabaseClient.from('transactions').delete().eq('id', debitTx.id);
      throw creditErr;
    }

    // Vincular a primeira
    await supabaseClient.from('transactions').update({ linked_transaction_id: creditTx.id }).eq('id', debitTx.id);

    // Criar journal_entries (débito na liability, crédito no asset)
    const { data: coa } = await supabaseClient
      .from('chart_of_accounts')
      .select('id, code, category')
      .eq('user_id', user.id);

    const liabilityCard = coa?.find(a => a.code === '2.01.01')?.id; // Cartões de Crédito
    const anyAsset = coa?.find(a => a.code?.startsWith('1.01.'))?.id; // Caixa/Bancos

    if (liabilityCard && anyAsset) {
      // Débito: liability (reduz dívida)
      await supabaseClient.from('journal_entries').insert({
        user_id: user.id,
        transaction_id: creditTx.id,
        account_id: liabilityCard,
        entry_type: 'debit',
        amount: Math.abs(amount),
        description: creditTx.description,
        entry_date: payment_date,
      });

      // Crédito: asset (sai dinheiro da conta)
      await supabaseClient.from('journal_entries').insert({
        user_id: user.id,
        transaction_id: debitTx.id,
        account_id: anyAsset,
        entry_type: 'credit',
        amount: Math.abs(amount),
        description: debitTx.description,
        entry_date: payment_date,
      });
    }

    // Recalcular saldos
    const { data: debitBal, error: debitBalErr } = await supabaseClient.rpc('recalculate_account_balance', { p_account_id: debit_account_id });
    if (debitBalErr) {
      console.error('[atomic-pay-bill] ERROR: debit balance recalc failed:', debitBalErr);
      throw debitBalErr;
    }

    const { data: creditBal, error: creditBalErr } = await supabaseClient.rpc('recalculate_account_balance', { p_account_id: credit_account_id });
    if (creditBalErr) {
      console.error('[atomic-pay-bill] ERROR: credit balance recalc failed:', creditBalErr);
      throw creditBalErr;
    }

    return new Response(JSON.stringify({
      debit_tx: debitTx,
      credit_tx: creditTx,
      debit_balance: debitBal?.[0],
      credit_balance: creditBal?.[0],
      success: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[atomic-pay-bill] ERROR:', error);
    return new Response(JSON.stringify({ error: (error as any).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
