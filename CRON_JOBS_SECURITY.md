# Cron Jobs Security Configuration

## Overview

The scheduled job edge functions now require authentication via the `X-Cron-Secret` header to prevent unauthorized execution.

## Affected Functions

1. **cleanup-old-backups** - Deletes old backup files and records
2. **generate-scheduled-backup** - Creates Excel backups for all users
3. **renew-fixed-transactions** - Generates transactions for all users

## Security Implementation

Each function now verifies the `CRON_SECRET` environment variable against the `X-Cron-Secret` header provided in the request. If the secret doesn't match, the function returns a 401 Unauthorized response.

## Updating Cron Jobs

You need to update your cron jobs to include the `X-Cron-Secret` header. Here's how:

### Step 1: Access Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/sql/new

### Step 2: Update Existing Cron Jobs

Run the following SQL to update your cron jobs with the secret header:

```sql
-- First, unschedule the old jobs
SELECT cron.unschedule('cleanup-old-backups-monthly');
SELECT cron.unschedule('generate-scheduled-backup-daily');
SELECT cron.unschedule('renew-fixed-transactions-yearly');

-- Then recreate them with the X-Cron-Secret header
-- Replace 'YOUR_CRON_SECRET_VALUE' with the actual secret you added to Supabase secrets

-- 1. Cleanup old backups (monthly at 3 AM)
SELECT cron.schedule(
  'cleanup-old-backups-monthly',
  '0 3 1 * *', -- At 03:00 on day 1 of every month
  $$
  SELECT net.http_post(
    url := 'https://sdberrkfwoozezletfuq.supabase.co/functions/v1/cleanup-old-backups',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg", "X-Cron-Secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 2. Generate scheduled backup (daily at 2 AM)
SELECT cron.schedule(
  'generate-scheduled-backup-daily',
  '0 2 * * *', -- At 02:00 every day
  $$
  SELECT net.http_post(
    url := 'https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-scheduled-backup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg", "X-Cron-Secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 3. Renew fixed transactions (yearly on January 1st at 4 AM)
SELECT cron.schedule(
  'renew-fixed-transactions-yearly',
  '0 4 1 1 *', -- At 04:00 on January 1st
  $$
  SELECT net.http_post(
    url := 'https://sdberrkfwoozezletfuq.supabase.co/functions/v1/renew-fixed-transactions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg", "X-Cron-Secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Step 3: Verify Cron Jobs

Check that your cron jobs are scheduled correctly:

```sql
SELECT * FROM cron.job ORDER BY jobid DESC;
```

## Testing

You can test the security by calling the functions without the secret:

```bash
# This should return 401 Unauthorized
curl -X POST https://sdberrkfwoozezletfuq.supabase.co/functions/v1/cleanup-old-backups \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg"

# This should work (replace YOUR_CRON_SECRET_VALUE with your actual secret)
curl -X POST https://sdberrkfwoozezletfuq.supabase.co/functions/v1/cleanup-old-backups \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg" \
  -H "X-Cron-Secret: YOUR_CRON_SECRET_VALUE"
```

## Security Benefits

✅ **Prevents unauthorized execution** - Only requests with the correct secret can trigger these functions  
✅ **DoS protection** - Prevents attackers from repeatedly calling expensive operations  
✅ **Resource protection** - Prevents unauthorized backup generation and cleanup  
✅ **Data integrity** - Prevents unauthorized transaction generation  

## Monitoring

Check the edge function logs for unauthorized access attempts:

- [cleanup-old-backups logs](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/cleanup-old-backups/logs)
- [generate-scheduled-backup logs](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/generate-scheduled-backup/logs)
- [renew-fixed-transactions logs](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/renew-fixed-transactions/logs)

Look for log entries containing: `WARN: Unauthorized access attempt - invalid CRON_SECRET`
