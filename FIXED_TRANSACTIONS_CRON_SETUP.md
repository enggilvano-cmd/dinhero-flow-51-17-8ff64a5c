# Configuração do Cron Job para Transações Fixas

## Visão Geral

O sistema de transações fixas gera automaticamente transações para os próximos 2 anos quando uma transação fixa é criada. Para manter o sistema atualizado, existe uma Edge Function que deve ser executada todo dia 1º de janeiro para gerar as transações do próximo ano.

## Edge Function

A Edge Function `generate-fixed-transactions-yearly` foi criada para:
1. Buscar todas as transações fixas (parent transactions)
2. Gerar 12 transações mensais para o próximo ano
3. Manter o ciclo de 2 anos sempre atualizado

## Como Configurar o Cron Job no Supabase

### Opção 1: Via Dashboard do Supabase

1. Acesse o dashboard do Supabase: https://supabase.com/dashboard/project/sdberrkfwoozezletfuq
2. Navegue até **Database** → **Extensions**
3. Habilite a extensão **pg_cron** se ainda não estiver habilitada
4. Vá para **SQL Editor** e execute o seguinte comando:

```sql
-- Criar o cron job para rodar todo dia 1º de janeiro às 00:00 UTC
SELECT cron.schedule(
  'generate-fixed-transactions-yearly',
  '0 0 1 1 *',
  $$
    SELECT
      net.http_post(
        url:='https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-fixed-transactions-yearly',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
  $$
);
```

### Opção 2: Via SQL Migration

Se preferir, você pode criar uma migration SQL:

```sql
-- Primeiro, certifique-se de que pg_cron está habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar a execução para todo dia 1º de janeiro às 00:00 UTC
SELECT cron.schedule(
  'generate-fixed-transactions-yearly',
  '0 0 1 1 *',
  $$
    SELECT
      net.http_post(
        url:='https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-fixed-transactions-yearly',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
  $$
);
```

## Teste Manual

Para testar a função manualmente, você pode executá-la via HTTP:

```bash
curl -X POST \
  https://sdberrkfwoozezletfuq.supabase.co/functions/v1/generate-fixed-transactions-yearly \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

Ou através do console JavaScript da aplicação:

```javascript
const { data, error } = await supabase.functions.invoke('generate-fixed-transactions-yearly');
console.log('Result:', data, error);
```

## Verificar Cron Jobs Existentes

Para ver os cron jobs configurados:

```sql
SELECT * FROM cron.job;
```

## Remover o Cron Job (se necessário)

```sql
SELECT cron.unschedule('generate-fixed-transactions-yearly');
```

## Logs e Monitoramento

- Os logs da Edge Function podem ser visualizados em: https://supabase.com/dashboard/project/sdberrkfwoozezletfuq/functions/generate-fixed-transactions-yearly/logs
- A função registra quantas transações foram geradas para cada transação fixa

## Formato do Cron

O formato `0 0 1 1 *` significa:
- `0` - minuto 0
- `0` - hora 0 (meia-noite)
- `1` - dia 1 do mês
- `1` - mês 1 (janeiro)
- `*` - qualquer dia da semana

Portanto, a função será executada todo dia 1º de janeiro às 00:00 UTC.
