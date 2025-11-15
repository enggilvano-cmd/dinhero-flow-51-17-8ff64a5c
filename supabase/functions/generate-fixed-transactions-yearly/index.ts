import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FixedTransaction {
  id: string
  description: string
  amount: number
  date: string
  type: 'income' | 'expense'
  category_id: string | null
  account_id: string
  user_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting yearly fixed transactions generation...')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Buscar todas as transações fixas (parent transactions)
    const { data: fixedTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_type', 'monthly')
      .is('recurrence_end_date', null)
      .neq('type', 'transfer')

    if (fetchError) {
      console.error('Error fetching fixed transactions:', fetchError)
      throw fetchError
    }

    if (!fixedTransactions || fixedTransactions.length === 0) {
      console.log('No fixed transactions found')
      return new Response(
        JSON.stringify({ message: 'No fixed transactions found', generated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${fixedTransactions.length} fixed transactions`)

    let totalGenerated = 0

    // Para cada transação fixa, gerar 12 meses do próximo ano
    for (const fixedTx of fixedTransactions as FixedTransaction[]) {
      const startDate = new Date(fixedTx.date)
      const currentYear = new Date().getFullYear()
      
      // Calcular a data inicial para o próximo ano
      // Se a transação é no dia 15, começar do dia 15 do primeiro mês do próximo ano
      const nextYearStart = new Date(currentYear + 1, 0, startDate.getDate())
      
      const futureTransactions = []
      
      // Gerar 12 meses para o próximo ano
      for (let i = 0; i < 12; i++) {
        const futureDate = new Date(nextYearStart)
        futureDate.setMonth(nextYearStart.getMonth() + i)
        
        const year = futureDate.getFullYear()
        const month = String(futureDate.getMonth() + 1).padStart(2, '0')
        const day = String(futureDate.getDate()).padStart(2, '0')
        
        futureTransactions.push({
          user_id: fixedTx.user_id,
          description: fixedTx.description,
          amount: fixedTx.amount,
          date: `${year}-${month}-${day}`,
          type: fixedTx.type,
          category_id: fixedTx.category_id,
          account_id: fixedTx.account_id,
          status: 'completed',
          is_recurring: false,
          parent_transaction_id: fixedTx.id,
          invoice_month: `${year}-${month}`,
        })
      }

      // Inserir as transações futuras
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(futureTransactions)

      if (insertError) {
        console.error(`Error generating transactions for ${fixedTx.id}:`, insertError)
        continue
      }

      totalGenerated += futureTransactions.length
      console.log(`Generated ${futureTransactions.length} transactions for ${fixedTx.description}`)
    }

    console.log(`Total transactions generated: ${totalGenerated}`)

    return new Response(
      JSON.stringify({
        message: 'Fixed transactions generated successfully',
        generated: totalGenerated,
        fixedTransactionsProcessed: fixedTransactions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in generate-fixed-transactions-yearly:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
