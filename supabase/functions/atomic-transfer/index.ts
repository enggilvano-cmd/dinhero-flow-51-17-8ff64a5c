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

    const { transfer }: { transfer: TransferInput } = await req.json();

    console.log('[atomic-transfer] INFO: Processing transfer for user:', user.id);

    // Validações básicas
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

    // Validação detalhada de inputs
    const validation = validateTransferInput(transfer);
    if (!validation.valid) {
      console.error('[atomic-transfer] ERROR: Invalid input:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o período está fechado
    const { data: isLocked } = await supabaseClient
      .rpc('is_period_locked', { 
        p_user_id: user.id, 
        p_date: transfer.date 
      });

    if (isLocked) {
      console.error('[atomic-transfer] ERROR: Period is locked:', transfer.date);
      return new Response(
        JSON.stringify({ 
          error: 'Period is locked',
          message: 'Cannot create transfers in a locked period. Please unlock the period first.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Validar limite para contas checking e savings
    if (fromAccount.type === 'checking' || fromAccount.type === 'savings') {
      const limit = fromAccount.limit_amount || 0;
      const futureBalance = fromAccount.balance - transfer.amount;
      
      if (futureBalance < 0 && Math.abs(futureBalance) > limit) {
        return new Response(
          JSON.stringify({
            error: `Transfer exceeds limit of ${fromAccount.name}`,
            limit: limit,
            futureBalance,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (fromAccount.type === 'credit') {
      // Para cartão de crédito, verificar se não excede o limite disponível
      const debt = Math.abs(Math.min(fromAccount.balance, 0));
      const availableCredit = (fromAccount.limit_amount || 0) - debt;
      
      if (transfer.amount > availableCredit) {
        return new Response(
          JSON.stringify({
            error: `Transfer exceeds available credit of ${fromAccount.name}`,
            availableCredit,
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
      console.error('[atomic-transfer] ERROR: Outgoing transaction failed:', outError);
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
      console.error('[atomic-transfer] ERROR: Incoming transaction failed:', inError);
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
      console.error('[atomic-transfer] ERROR: From balance recalc failed:', fromBalError);
      // Reverter ambas transações
      await supabaseClient.from('transactions').delete().in('id', [outgoingTx.id, incomingTx.id]);
      throw fromBalError;
    }

    const { data: toBalance, error: toBalError } = await supabaseClient
      .rpc('recalculate_account_balance', { p_account_id: transfer.to_account_id });

    if (toBalError) {
      console.error('[atomic-transfer] ERROR: To balance recalc failed:', toBalError);
      // Reverter tudo
      await supabaseClient.from('transactions').delete().in('id', [outgoingTx.id, incomingTx.id]);
      await supabaseClient.rpc('recalculate_account_balance', { p_account_id: transfer.from_account_id });
      throw toBalError;
    }

    // 5. Criar journal_entries (Débito destino, Crédito origem)
    const { data: coa } = await supabaseClient
      .from('chart_of_accounts')
      .select('id, code')
      .eq('user_id', user.id);

    if (coa && coa.length > 0) {
      // Mapear conta origem
      let fromAccountCoaId: string | undefined;
      if (fromAccount.type === 'checking') {
        fromAccountCoaId = coa.find(a => a.code === '1.01.02')?.id;
      } else if (fromAccount.type === 'savings') {
        fromAccountCoaId = coa.find(a => a.code === '1.01.03')?.id;
      } else if (fromAccount.type === 'investment') {
        fromAccountCoaId = coa.find(a => a.code === '1.01.04')?.id;
      } else if (fromAccount.type === 'credit') {
        fromAccountCoaId = coa.find(a => a.code === '2.01.01')?.id;
      }

      // Mapear conta destino
      let toAccountCoaId: string | undefined;
      if (toAccount.type === 'checking') {
        toAccountCoaId = coa.find(a => a.code === '1.01.02')?.id;
      } else if (toAccount.type === 'savings') {
        toAccountCoaId = coa.find(a => a.code === '1.01.03')?.id;
      } else if (toAccount.type === 'investment') {
        toAccountCoaId = coa.find(a => a.code === '1.01.04')?.id;
      } else if (toAccount.type === 'credit') {
        toAccountCoaId = coa.find(a => a.code === '2.01.01')?.id;
      }

      // Fallback para primeira conta de ativo
      if (!fromAccountCoaId) fromAccountCoaId = coa.find(a => a.code?.startsWith('1.01.'))?.id;
      if (!toAccountCoaId) toAccountCoaId = coa.find(a => a.code?.startsWith('1.01.'))?.id;

      if (fromAccountCoaId && toAccountCoaId) {
        await supabaseClient.from('journal_entries').insert([
          {
            user_id: user.id,
            transaction_id: incomingTx.id,
            account_id: toAccountCoaId,
            entry_type: 'debit',
            amount: Math.abs(transfer.amount),
            description: incomingTx.description,
            entry_date: transfer.date,
          },
          {
            user_id: user.id,
            transaction_id: outgoingTx.id,
            account_id: fromAccountCoaId,
            entry_type: 'credit',
            amount: Math.abs(transfer.amount),
            description: outgoingTx.description,
            entry_date: transfer.date,
          }
        ]);
      }
    }

    console.log('[atomic-transfer] INFO: Transfer completed successfully');

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
    console.error('[atomic-transfer] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});