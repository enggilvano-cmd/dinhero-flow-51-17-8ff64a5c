import {
  createTestUser,
  createTestAccount,
  createTestCategory,
  cleanupTestUser,
  invokeEdgeFunction,
  getAccountBalance,
  assertEquals,
  assertTrue,
  getSupabaseClient,
} from './setup.ts';

Deno.test('atomic-create-recurring: should create parent and child recurring transactions', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId, {
      name: 'Checking Account',
      type: 'checking',
      balance: 0,
    });

    const category = await createTestCategory(userId, {
      name: 'Rent',
      type: 'expense',
    });

    const response = await invokeEdgeFunction('atomic-create-recurring', {
      accountId: account.id,
      amount: 150000, // R$ 1,500.00
      categoryId: category.id,
      date: '2025-01-10',
      description: 'Monthly Rent',
      recurrenceType: 'monthly',
      recurrenceEndDate: '2025-12-31',
      status: 'pending',
      type: 'expense',
    }, userId);

    assertTrue(response.error === null, 'Should not have error');
    assertTrue(response.data?.success === true, 'Operation should succeed');
    assertTrue(response.data?.created_count === 12, 'Should create 12 transactions (12 months)');
    
    const parentId = response.data?.parent_id;
    assertTrue(!!parentId, 'Should return parent transaction ID');

    // Verify transactions were created
    const supabase = getSupabaseClient();
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    assertEquals(transactions?.length, 12, 'Should have 12 transactions in database');
    
    // Verify parent transaction
    const parent = transactions?.find(t => t.id === parentId);
    assertTrue(!!parent, 'Parent transaction should exist');
    assertEquals(parent?.is_recurring, true, 'Parent should be marked as recurring');
    assertEquals(parent?.recurrence_type, 'monthly', 'Should have monthly recurrence');
    
    // Verify child transactions
    const children = transactions?.filter(t => t.parent_transaction_id === parentId && t.id !== parentId);
    assertEquals(children?.length, 11, 'Should have 11 child transactions');

    console.log('✓ atomic-create-recurring test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});

Deno.test('atomic-create-recurring: should handle weekly recurrence', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId);
    const category = await createTestCategory(userId);

    const response = await invokeEdgeFunction('atomic-create-recurring', {
      accountId: account.id,
      amount: 20000, // R$ 200.00
      categoryId: category.id,
      date: '2025-01-06', // Monday
      description: 'Weekly Expense',
      recurrenceType: 'weekly',
      recurrenceEndDate: '2025-02-03', // 4 weeks later
      status: 'pending',
      type: 'expense',
    }, userId);

    assertTrue(response.error === null, 'Should not have error');
    assertTrue(response.data?.success === true, 'Operation should succeed');
    assertTrue(response.data?.created_count === 5, 'Should create 5 transactions (5 weeks)');

    console.log('✓ atomic-create-recurring weekly test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});

Deno.test('atomic-create-recurring: should validate period locking', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId);
    const category = await createTestCategory(userId);

    // Create a period closure for January 2025
    const supabase = getSupabaseClient();
    await supabase.from('period_closures').insert({
      user_id: userId,
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      closure_type: 'monthly',
      closed_by: userId,
      is_locked: true,
    });

    // Try to create recurring transaction in locked period
    const response = await invokeEdgeFunction('atomic-create-recurring', {
      accountId: account.id,
      amount: 100000,
      categoryId: category.id,
      date: '2025-01-15', // Locked period
      description: 'Test Recurring',
      recurrenceType: 'monthly',
      status: 'completed',
      type: 'expense',
    }, userId);

    assertTrue(response.data?.success === false, 'Should fail for locked period');
    assertTrue(
      response.data?.error_message?.includes('locked') || 
      response.data?.error_message?.includes('período fechado'),
      'Error should mention locked period'
    );

    console.log('✓ atomic-create-recurring period locking test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});

Deno.test('atomic-create-recurring: should update balance for completed transactions', async () => {
  let userId: string | undefined;

  try {
    const user = await createTestUser();
    userId = user.id;

    const account = await createTestAccount(userId, {
      balance: 500000, // R$ 5,000.00
    });

    const category = await createTestCategory(userId);

    const response = await invokeEdgeFunction('atomic-create-recurring', {
      accountId: account.id,
      amount: 100000, // R$ 1,000.00
      categoryId: category.id,
      date: '2025-01-15',
      description: 'Recurring Income',
      recurrenceType: 'monthly',
      recurrenceEndDate: '2025-03-15',
      status: 'completed',
      type: 'income',
    }, userId);

    assertTrue(response.error === null, 'Should not have error');
    assertTrue(response.data?.success === true, 'Operation should succeed');

    // First transaction affects balance
    const finalBalance = await getAccountBalance(account.id);
    assertEquals(finalBalance, 600000, 'Balance should increase by first transaction');

    console.log('✓ atomic-create-recurring balance update test passed');
  } finally {
    if (userId) {
      await cleanupTestUser(userId);
    }
  }
});
