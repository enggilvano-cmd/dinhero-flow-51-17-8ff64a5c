# 🔒 Guia de Segurança

## ⚠️ CRÍTICO - Nunca Commite Secrets!

### Arquivos Sensíveis
Os seguintes arquivos **NUNCA** devem ser commitados ao repositório:

```
.env
.env.local
.env.development
.env.production
.env.test
```

### Setup Inicial
1. Copie `.env.example` para `.env`
2. Preencha os valores reais
3. **NUNCA** commite o arquivo `.env`

```bash
cp .env.example .env
# Edite .env com seus valores reais
```

## 🛡️ Medidas de Segurança Implementadas

### 1. Rate Limiting
Todas as Edge Functions implementam rate limiting:

- **Strict** (10 req/15min): Operações sensíveis
- **Moderate** (100 req/15min): Operações normais
- **Lenient** (60 req/min): Leituras

### 2. Input Validation
Validação rigorosa usando schemas customizados:

```typescript
import { validateTransaction } from '../_shared/validation.ts';

const validation = validateTransaction(data);
if (!validation.valid) {
  return validationErrorResponse(validation.errors, corsHeaders);
}
```

### 3. Error Boundaries
Error boundaries granulares para diferentes seções:

- `GranularErrorBoundary`: Genérico com contexto
- `TransactionErrorBoundary`: Para transações
- `DashboardErrorBoundary`: Para dashboard
- `AnalyticsErrorBoundary`: Para análises

### 4. Sentry Integration
Todos os erros são automaticamente reportados ao Sentry com contexto completo:

```typescript
Sentry.captureException(error, {
  contexts: { /* ... */ },
  tags: { /* ... */ }
});
```

## 🔐 Best Practices

### Edge Functions

#### ✅ SEMPRE:
- Validar TODOS os inputs
- Aplicar rate limiting apropriado
- Usar tipos TypeScript estritos
- Implementar logging estruturado
- Usar SECURITY DEFINER com cuidado
- Retornar CORS headers apropriados

#### ❌ NUNCA:
- Expor secrets no código
- Executar SQL raw sem validação
- Confiar em dados do cliente
- Log sensitive information
- Usar `any` types
- Ignorar erros silenciosamente

### Frontend

#### ✅ SEMPRE:
- Validar inputs no cliente E servidor
- Usar Error Boundaries
- Implementar retry logic para falhas de rede
- Sanitizar HTML user-generated
- Usar HTTPS em produção

#### ❌ NUNCA:
- Armazenar tokens em localStorage sem encryption
- Confiar apenas em validação client-side
- Expor API keys no código frontend
- Usar `dangerouslySetInnerHTML` com user input

## 🚨 Reporting Security Issues

**NÃO** crie issues públicas para vulnerabilidades de segurança.

Em vez disso:
1. Envie email para: security@your-domain.com
2. Inclua descrição detalhada
3. Steps to reproduce
4. Impacto potencial

## 📋 Security Checklist

Antes de cada deploy:

- [ ] `.env` não está commitado
- [ ] Secrets rotacionados se necessário
- [ ] Rate limiting configurado
- [ ] Validação de input em todas as edge functions
- [ ] Error boundaries implementados
- [ ] Sentry configurado e funcionando
- [ ] RLS policies revisadas
- [ ] Audit logs habilitados
- [ ] HTTPS forçado em produção
- [ ] Dependency scan executado

```bash
# Verificar vulnerabilidades
npm audit

# Executar testes de segurança
npm run test:security
```

## 🔄 Rotação de Secrets

Secrets devem ser rotacionados:
- A cada 90 dias (scheduled)
- Imediatamente após um incident
- Quando um membro da equipe sai
- Se houver suspeita de vazamento

### Como Rotacionar:

1. **Gerar novos secrets** no Supabase Dashboard
2. **Atualizar** `.env` local
3. **Atualizar** secrets no CI/CD
4. **Deployar** nova versão
5. **Revogar** secrets antigos

## 📚 Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Edge Functions Security](https://supabase.com/docs/guides/functions/security)
- [RLS Policy Examples](https://supabase.com/docs/guides/auth/row-level-security)

---

**Última atualização:** 2025-11-21
**Versão:** 1.0.0
