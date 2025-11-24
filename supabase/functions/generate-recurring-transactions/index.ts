import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { rateLimiters } from '../_shared/rate-limiter.ts';
import { withRetry } from '../_shared/retry.ts';
import { getNowInUserTimezone, toUserTimezone, formatDateString, addDays, addMonths, addYears } from '../_shared/timezone.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecurringTransaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
  account_id: string;
  date: string;
  status: 'pending' | 'completed';
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_end_date: string | null;
  invoice_month: string | null;
  invoice_month_overridden: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-recurring] INFO: Starting recurring transactions generation...');

    // Rate limiting - Lenient para jobs automatizados
    const identifier = req.headers.get('x-job-id') || 'recurring-job';
    const rateLimitResponse = rateLimiters.lenient.middleware(req, identifier);
    if (rateLimitResponse) {
      console.warn('[generate-recurring] WARN: Rate limit exceeded');
      return new Response(
        rateLimitResponse.body,
        { 
          status: rateLimitResponse.status, 
          headers: { ...corsHeaders, ...Object.fromEntries(rateLimitResponse.headers.entries()) } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todas as transações recorrentes ativas com retry
    const { data: recurringTransactions, error: fetchError } = await withRetry(
      () => supabase
        .from('transactions')
        .select('*')
        .eq('is_recurring', true)
        .order('user_id')
    );

    if (fetchError) {
      console.error('[generate-recurring] ERROR: Failed to fetch recurring transactions:', fetchError);
      throw fetchError;
    }

    console.log(`[generate-recurring] INFO: Found ${recurringTransactions?.length || 0} recurring transactions`);

    if (!recurringTransactions || recurringTransactions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recurring transactions to process',
          generated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = getNowInUserTimezone();
    today.setHours(0, 0, 0, 0);
    
    let generatedCount = 0;
    const errors: Array<{ recurring_id: string; error: string }> = [];

    for (const recurring of recurringTransactions as RecurringTransaction[]) {
      try {
        // Verificar se a recorrência já expirou
        if (recurring.recurrence_end_date) {
          const endDate = toUserTimezone(recurring.recurrence_end_date);
          endDate.setHours(0, 0, 0, 0);
          
          if (today > endDate) {
            console.log(`[generate-recurring] INFO: Skipping expired transaction: ${recurring.id}`);
            continue;
          }
        }

        // Buscar a última transação gerada por esta recorrência com retry
        const { data: lastGenerated, error: lastError } = await withRetry(
          () => supabase
            .from('transactions')
            .select('date')
            .eq('parent_transaction_id', recurring.id)
            .order('date', { ascending: false })
            .limit(1)
            .single()
        );

        if (lastError && lastError.code !== 'PGRST116') { // PGRST116 = not found
          console.error(`[generate-recurring] ERROR: Failed to fetch last generated for ${recurring.id}:`, lastError);
          continue;
        }

        // Data base para cálculo (última gerada ou data da recorrente)
        const lastDate = lastGenerated?.date 
          ? toUserTimezone(lastGenerated.date) 
          : toUserTimezone(recurring.date);
        lastDate.setHours(0, 0, 0, 0);

        // Calcular a próxima data baseada na frequência
        const nextDate = calculateNextDate(lastDate, recurring.recurrence_type);
        
        // Verificar se deve gerar a transação hoje
        if (nextDate <= today) {
          // Verificar se não ultrapassa a data final
          if (recurring.recurrence_end_date) {
            const endDate = toUserTimezone(recurring.recurrence_end_date);
            endDate.setHours(0, 0, 0, 0);
            
            if (nextDate > endDate) {
              console.log(`[generate-recurring] INFO: Next date exceeds end date for: ${recurring.id}`);
              continue;
            }
          }

          // Criar a nova transação
          const newTransaction = {
            user_id: recurring.user_id,
            description: recurring.description,
            amount: recurring.amount,
            type: recurring.type,
            category_id: recurring.category_id,
            account_id: recurring.account_id,
            date: formatDateString(nextDate),
            status: recurring.status,
            is_recurring: false, // A transação gerada não é recorrente
            recurrence_type: null,
            recurrence_end_date: null,
            parent_transaction_id: recurring.id, // Vínculo com a transação recorrente
            invoice_month: calculateInvoiceMonth(nextDate, recurring.account_id, supabase),
            invoice_month_overridden: false,
          };

          const { error: insertError } = await withRetry(
            () => supabase
              .from('transactions')
              .insert(newTransaction)
          );

          if (insertError) {
            console.error(`[generate-recurring] ERROR: Failed to insert transaction for ${recurring.id}:`, insertError);
            errors.push({ recurring_id: recurring.id, error: insertError.message });
          } else {
            console.log(`[generate-recurring] INFO: Generated transaction for ${recurring.id} on ${formatDate(nextDate)}`);
            generatedCount++;
          }
        } else {
          console.log(`[generate-recurring] INFO: Next date (${formatDateString(nextDate)}) not reached for: ${recurring.id}`);
        }
      } catch (error) {
        console.error(`[generate-recurring] ERROR: Failed to process ${recurring.id}:`, error);
        errors.push({ recurring_id: recurring.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`[generate-recurring] INFO: Generation complete. Generated: ${generatedCount} transactions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: generatedCount,
        processed: recurringTransactions.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[generate-recurring] ERROR:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function calculateNextDate(lastDate: Date, recurrenceType: string): Date {
  switch (recurrenceType) {
    case 'daily':
      return addDays(lastDate, 1);
    case 'weekly':
      return addDays(lastDate, 7);
    case 'monthly':
      return addMonths(lastDate, 1);
    case 'yearly':
      return addYears(lastDate, 1);
    default:
      return lastDate;
  }
}

async function calculateInvoiceMonth(
  date: Date, 
  accountId: string, 
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  // Buscar informações da conta para calcular invoice_month se for cartão de crédito com retry
  const { data: account } = await withRetry(
    () => supabase
      .from('accounts')
      .select('type, closing_date, due_date')
      .eq('id', accountId)
      .single()
  );

  if (!account || account.type !== 'credit' || !account.closing_date) {
    return null;
  }

  // Lógica simplificada: se a data é antes do fechamento, usa o mês atual
  // Se é depois, usa o próximo mês
  const closingDate = account.closing_date;
  const invoiceDate = new Date(date);
  
  if (date.getDate() < closingDate) {
    return `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const nextMonth = addMonths(invoiceDate, 1);
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
  }
}
