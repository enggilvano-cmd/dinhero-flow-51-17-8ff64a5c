import {
  createTestUser,
  createTestAccount,
  createTestCategory,
  cleanupTestUser,
  invokeEdgeFunction,
  assertEquals,
  assertTrue,
  getSupabaseClient,
} from './setup.ts';

Deno.test('generate-recurring-transactions: should generate pending recurring transactions', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId);
    const category = await createTestCategory(userId);

    const supabase = getSupabaseClient();

    // Create parent recurring transaction that started 3 months ago
    const parentDate = new Date();
    parentDate.setMonth(parentDate.getMonth() - 3);
    const parentDateStr = parentDate.toISOString().split('T')[0];

    const { data: parent } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: account.id,
        category_id: category.id,
        amount: 100000,
        date: parentDateStr,
        description: 'Recurring Expense',
        type: 'expense',
        status: 'completed',
        is_recurring: true,
        recurrence_type: 'monthly',
        recurrence_end_date: null, // No end date
      })
      .select()
      .single();

    assertTrue(!!parent, 'Parent transaction should be created');

    // Invoke generate function
    const response = await invokeEdgeFunction('generate-recurring-transactions', {}, userId);

    assertTrue(response.error === null, 'Should not have error');

    // Verify child transactions were generated for past months
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_transaction_id', parent.id)
      .order('date', { ascending: true });

    // Should generate transactions for the 3 months gap
    assertTrue(
      (transactions?.length ?? 0) >= 2,
      'Should generate at least 2 child transactions'
    );

    console.log('✓ generate-recurring-transactions test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});

Deno.test('generate-recurring-transactions: should respect end date', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId);
    const category = await createTestCategory(userId);

    const supabase = getSupabaseClient();

    // Create parent with end date in the past
    const { data: parent } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: account.id,
        category_id: category.id,
        amount: 100000,
        date: '2024-01-01',
        description: 'Expired Recurring',
        type: 'expense',
        status: 'completed',
        is_recurring: true,
        recurrence_type: 'monthly',
        recurrence_end_date: '2024-03-01', // Ended in March
      })
      .select()
      .single();

    assertTrue(!!parent, 'Parent should be created');

    // Invoke generate function
    await invokeEdgeFunction('generate-recurring-transactions', {}, userId);

    // Verify no new transactions after end date
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_transaction_id', parent.id)
      .gte('date', '2024-04-01');

    assertEquals(transactions?.length, 0, 'Should not generate transactions after end date');

    console.log('✓ generate-recurring-transactions end date test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});

Deno.test('generate-recurring-transactions: should skip locked periods', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId);
    const category = await createTestCategory(userId);

    const supabase = getSupabaseClient();

    // Create period closure for January 2025
    await supabase.from('period_closures').insert({
      user_id: userId,
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      closure_type: 'monthly',
      closed_by: userId,
      is_locked: true,
    });

    // Create parent recurring transaction
    const { data: parent } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: account.id,
        category_id: category.id,
        amount: 100000,
        date: '2024-12-15',
        description: 'Recurring',
        type: 'expense',
        status: 'completed',
        is_recurring: true,
        recurrence_type: 'monthly',
      })
      .select()
      .single();

    assertTrue(!!parent, 'Parent should be created');

    // Invoke generate function
    await invokeEdgeFunction('generate-recurring-transactions', {}, userId);

    // Verify no transactions in locked period
    const { data: lockedTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_transaction_id', parent.id)
      .gte('date', '2025-01-01')
      .lte('date', '2025-01-31');

    assertEquals(lockedTransactions?.length, 0, 'Should not generate in locked period');

    console.log('✓ generate-recurring-transactions locked period test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});
