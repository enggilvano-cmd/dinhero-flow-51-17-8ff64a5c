# Upstash Redis Setup Guide

## ✅ Secrets Configurados

Os secrets `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` já foram adicionados ao projeto.

---

## 🚀 Como Obter as Credenciais do Upstash

### 1. Criar Conta Gratuita no Upstash

Acesse: https://console.upstash.com/

- Plano gratuito: 10,000 comandos/dia
- Sem necessidade de cartão de crédito
- Suficiente para a maioria das aplicações

### 2. Criar Database Redis

1. No dashboard do Upstash, clique em **"Create Database"**
2. Escolha:
   - **Name**: `planiflow-rate-limiter` (ou qualquer nome)
   - **Type**: Regional (mais rápido) ou Global (mais confiável)
   - **Region**: Escolha mais próximo dos seus usuários
3. Clique em **"Create"**

### 3. Copiar Credenciais REST API

Na página do database criado:

1. Vá até a aba **"REST API"**
2. Copie os valores:
   - **UPSTASH_REDIS_REST_URL**: `https://your-region.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `AXXXXXXXXXXXXXXXXXXXXXXXx`

### 4. Atualizar Secrets no Lovable

✅ **JÁ FEITO!** Os secrets já foram adicionados ao projeto.

Se precisar atualizar no futuro:
1. Vá em Settings → Secrets
2. Atualize os valores dos secrets

---

## 🔧 Como Funciona

### Edge Functions Atualizados

Todos os edge functions que usam rate limiting agora suportam Upstash:

```typescript
import { rateLimiters } from './_shared/rate-limiter.ts';

// Aplicar rate limiting distribuído
const rateLimitResponse = await rateLimiters.strict.middleware(req, userId);
if (rateLimitResponse) return rateLimitResponse;
```

### Níveis de Rate Limiting

- **strict**: 10 requests / 15 minutos (operações sensíveis)
- **moderate**: 100 requests / 15 minutos (operações normais)
- **lenient**: 60 requests / 1 minuto (leituras)

### Fallback Gracioso

Se o Upstash não estiver configurado ou houver erro:
- Rate limiting será desabilitado (fail-open)
- Warning será logado no console
- Aplicação continua funcionando normalmente

---

## 📊 Monitoramento

### Dashboard do Upstash

Acesse https://console.upstash.com/ para visualizar:
- Número de comandos executados
- Latência média
- Taxa de erros
- Uso de memória

### Logs dos Edge Functions

Logs de rate limiting aparecem nos edge function logs:
- "Rate limit exceeded" quando usuário excede limite
- "Upstash Redis not configured" se secrets não estão configurados

---

## 🧪 Testar Rate Limiting

### Teste Manual

1. Faça 10 requisições rápidas a um endpoint protegido
2. A 11ª requisição deve retornar erro 429
3. Headers de resposta incluem:
   - `X-RateLimit-Limit`: Limite total
   - `X-RateLimit-Remaining`: Requests restantes
   - `Retry-After`: Segundos até reset

### Teste com cURL

```bash
# Fazer várias requisições rapidamente
for i in {1..15}; do
  curl -X POST https://sdberrkfwoozezletfuq.supabase.co/functions/v1/atomic-transaction \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  echo "\nRequest $i"
done
```

---

## 💰 Custos

### Plano Gratuito Upstash
- 10,000 comandos/dia
- Banda suficiente para ~5,000 transações/dia
- Retenção de dados: ilimitada
- **Custo: R$ 0/mês**

### Plano Pro Upstash (se necessário)
- A partir de US$ 10/mês
- 100,000 comandos/dia
- Banda suficiente para ~50,000 transações/dia

---

## 🔐 Segurança

✅ **Secrets armazenados de forma segura no Supabase**
✅ **Tokens nunca expostos no frontend**
✅ **Comunicação via HTTPS**
✅ **Rate limiting previne abuse e ataques DDoS**

---

## ⚡ Performance

### Latência Esperada
- Upstash Regional: ~10-30ms
- Upstash Global: ~50-100ms
- In-Memory (antigo): ~1ms

### Trade-off
Pequeno aumento de latência (20-50ms) em troca de rate limiting confiável e distribuído que funciona corretamente em serverless.

---

## 🐛 Troubleshooting

### "Upstash Redis not configured"
- Verificar se secrets foram adicionados corretamente
- Conferir se nomes estão exatos: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

### "Rate limit exceeded" legítimo
- Usuário realmente excedeu limite
- Pode aumentar limites em `rate-limiter.ts` se necessário
- Ou atualizar plano do Upstash

### Erro 401 do Upstash
- Token inválido ou expirado
- Regenerar token no dashboard Upstash
- Atualizar secret no Lovable

---

## 📚 Recursos

- [Upstash Docs](https://docs.upstash.com/redis)
- [REST API Reference](https://docs.upstash.com/redis/features/restapi)
- [Rate Limiting Guide](https://docs.upstash.com/redis/howto/ratelimiting)
