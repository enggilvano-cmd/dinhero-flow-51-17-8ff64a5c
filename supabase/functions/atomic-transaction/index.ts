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

// Validação de inputs
function validateTransactionInput(input: TransactionInput): { valid: boolean; error?: string } {
  if (!input.description || input.description.trim().length === 0) {
    return { valid: false, error: 'Description is required and cannot be empty' };
  }
  if (input.description.length > 200) {
    return { valid: false, error: 'Description must be less than 200 characters' };
  }
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  if (input.amount > 1000000000) { // 1 bilhão - limite razoável
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
  // Validar UUID format (básico)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(input.account_id)) {
    return { valid: false, error: 'Invalid account_id format' };
  }
  if (!uuidRegex.test(input.category_id)) {
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

    const { transaction }: { transaction: TransactionInput } = await req.json();

    console.log('[atomic-transaction] INFO: Creating transaction for user:', user.id);

    // Validações básicas
    if (!transaction.description || !transaction.amount || !transaction.account_id || !transaction.category_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação detalhada de inputs
    const validation = validateTransactionInput(transaction);
    if (!validation.valid) {
      console.error('[atomic-transaction] ERROR: Invalid input:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INICIAR TRANSAÇÃO ATÔMICA
    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabaseClient
      .from('accounts')
      .select('type, balance, limit_amount')
      .eq('id', transaction.account_id)
      .single();

    if (accountError) {
      console.error('[atomic-transaction] ERROR: Account fetch failed:', accountError);
      throw accountError;
    }

    // Calcular amount com sinal correto
    const amount = transaction.type === 'expense' 
      ? -Math.abs(transaction.amount) 
      : Math.abs(transaction.amount);

    // VALIDAÇÃO DE LIMITE DE CRÉDITO
    if (accountData.type === 'credit' && transaction.type === 'expense' && transaction.status === 'completed') {
      const currentDebt = Math.abs(Math.min(accountData.balance, 0));
      const availableCredit = (accountData.limit_amount || 0) - currentDebt;
      const transactionAmount = Math.abs(amount);

      if (transactionAmount > availableCredit) {
        console.error('[atomic-transaction] ERROR: Credit limit exceeded', {
          currentDebt,
          availableCredit,
          transactionAmount,
          limit: accountData.limit_amount
        });
        return new Response(
          JSON.stringify({
            error: 'Credit limit exceeded',
            details: {
              available: availableCredit,
              requested: transactionAmount,
              limit: accountData.limit_amount,
              currentDebt
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
      console.error('[atomic-transaction] ERROR: Insert failed:', insertError);
      throw insertError;
    }

    // 2. Recalcular saldo APENAS se status = 'completed' usando função atômica
    if (transaction.status === 'completed') {
      // Criar journal_entries (partidas dobradas básicas)
      const { data: coa } = await supabaseClient
        .from('chart_of_accounts')
        .select('id, code, category')
        .eq('user_id', user.id);

      const anyAsset = coa?.find(a => a.code?.startsWith('1.01.'))?.id;
      const anyExpense = coa?.find(a => a.category === 'expense')?.id;
      const anyRevenue = coa?.find(a => a.category === 'revenue')?.id;
      const liabilityCard = coa?.find(a => a.code === '2.01.01')?.id;

      if (anyAsset && (anyExpense || anyRevenue)) {
        if (transaction.type === 'income' && anyRevenue) {
          // Débito: Ativo | Crédito: Receita
          await supabaseClient.from('journal_entries').insert({
            user_id: user.id,
            transaction_id: newTransaction.id,
            account_id: anyAsset,
            entry_type: 'debit',
            amount: Math.abs(newTransaction.amount),
            description: newTransaction.description,
            entry_date: newTransaction.date,
          });
          await supabaseClient.from('journal_entries').insert({
            user_id: user.id,
            transaction_id: newTransaction.id,
            account_id: anyRevenue,
            entry_type: 'credit',
            amount: Math.abs(newTransaction.amount),
            description: newTransaction.description,
            entry_date: newTransaction.date,
          });
        }
        if (transaction.type === 'expense' && anyExpense) {
          // Débito: Despesa | Crédito: Ativo (ou Passivo cartão)
          await supabaseClient.from('journal_entries').insert({
            user_id: user.id,
            transaction_id: newTransaction.id,
            account_id: anyExpense,
            entry_type: 'debit',
            amount: Math.abs(newTransaction.amount),
            description: newTransaction.description,
            entry_date: newTransaction.date,
          });
          const creditAccountId = accountData?.type === 'credit' && liabilityCard ? liabilityCard : anyAsset;
          await supabaseClient.from('journal_entries').insert({
            user_id: user.id,
            transaction_id: newTransaction.id,
            account_id: creditAccountId!,
            entry_type: 'credit',
            amount: Math.abs(newTransaction.amount),
            description: newTransaction.description,
            entry_date: newTransaction.date,
          });
        }
      }

      const { data: recalcResult, error: recalcError } = await supabaseClient
        .rpc('recalculate_account_balance', {
          p_account_id: transaction.account_id,
        });

      if (recalcError) {
        console.error('[atomic-transaction] ERROR: Balance recalc failed:', recalcError);
        // Tentar reverter a transação
        await supabaseClient
          .from('transactions')
          .delete()
          .eq('id', newTransaction.id);
        throw recalcError;
      }

      console.log('[atomic-transaction] INFO: Balance recalculated:', recalcResult[0]);

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
    console.error('[atomic-transaction] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});