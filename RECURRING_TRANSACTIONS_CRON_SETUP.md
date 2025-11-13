# Configuração do Cron Job para Transações Recorrentes

## ⚙️ Configuração Automática

Para ativar a geração automática de transações recorrentes, você precisa configurar um cron job no Supabase.

### Passo 1: Acessar o SQL Editor

1. Acesse o [SQL Editor do seu projeto](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/sql/new)
2. Cole o seguinte SQL:

```sql
SELECT cron.schedule(
  'generate-recurring-transactions-daily',
  '1 0 * * *', -- Diariamente às 00:01
  $$
  SELECT net.http_post(
    url:='https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-recurring-transactions',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

3. Execute o SQL clicando em "Run"

### Passo 2: Verificar Configuração

Para verificar se o cron job foi criado corretamente:

```sql
SELECT * FROM cron.job WHERE jobname = 'generate-recurring-transactions-daily';
```

## 🔄 Como Funciona

A edge function `generate-recurring-transactions` será executada automaticamente todos os dias à 00:01 e irá:

1. **Buscar** todas as transações recorrentes ativas
2. **Verificar** quais precisam gerar novas transações baseado na última criada
3. **Criar** automaticamente novas transações respeitando:
   - Frequência configurada (diária, semanal, mensal, anual)
   - Data final de recorrência (se houver)
   - Todas as informações da transação original (valor, categoria, conta, etc.)
4. **Vincular** as transações geradas à transação recorrente original via `parent_transaction_id`

## 🧪 Testar Manualmente

Você pode testar a função manualmente antes de ativar o cron:

1. Acesse as [Functions do projeto](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/generate-recurring-transactions)
2. Use o seguinte curl:

```bash
curl -X POST \
  'https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-recurring-transactions' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYmVycmtmd29vemV6bGV0ZnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Njg2MTksImV4cCI6MjA3MTI0NDYxOX0.4CkPaX75EGyma1gwVYvDodd10TwZPm8I37D0jvjUNBg' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 📊 Monitoramento

Para verificar os logs da função:
- [Logs da Edge Function](https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/generate-recurring-transactions/logs)

## ⚙️ Ajustar Frequência

Para alterar a frequência de execução, modifique o cron pattern:

- `'1 0 * * *'` - Diariamente às 00:01 (configuração atual)
- `'0 */6 * * *'` - A cada 6 horas
- `'0 12 * * *'` - Diariamente ao meio-dia
- `'0 0 * * 0'` - Semanalmente aos domingos à meia-noite

Para atualizar, delete o job atual e crie um novo:

```sql
SELECT cron.unschedule('generate-recurring-transactions-daily');
-- Depois execute o schedule novamente com o novo pattern
```

## 🗑️ Desativar Geração Automática

Para desativar completamente o cron job:

```sql
SELECT cron.unschedule('generate-recurring-transactions-daily');
```
