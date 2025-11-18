# Utilitários Supabase

## Visão Geral

O arquivo `src/lib/supabase-utils.ts` contém funções reutilizáveis para operações comuns com Supabase, eliminando código duplicado e padronizando o tratamento de erros.

## Funções Disponíveis

### Autenticação

#### `getUserId()`
Obtém o ID do usuário autenticado ou lança erro.

```typescript
import { getUserId } from '@/lib/supabase-utils';

const userId = await getUserId(); // Throws if not authenticated
```

### Tratamento de Erros

#### `handleSupabaseError()`
Handler centralizado para erros do Supabase com mensagens amigáveis.

```typescript
import { handleSupabaseError } from '@/lib/supabase-utils';

try {
  const result = await someOperation();
} catch (error) {
  const message = handleSupabaseError(
    error,
    'Operation context',
    true // Show toast
  );
}
```

#### `withErrorHandling()`
Wrapper para operações assíncronas com tratamento automático de erros.

```typescript
import { withErrorHandling } from '@/lib/supabase-utils';

const { data, error } = await withErrorHandling(
  async () => {
    // Your operation
    return await someAsyncOperation();
  },
  'Context description',
  true // Show toast on error
);

if (error) {
  // Handle error
  return;
}

// Use data
```

### Operações CRUD Genéricas

#### `queryWithUserId()`
Executa queries com filtro automático de `user_id`.

```typescript
import { queryWithUserId } from '@/lib/supabase-utils';

const { data, error } = await queryWithUserId<Account>(
  'accounts',
  (query) => query.order('created_at', { ascending: true }),
  'Error fetching accounts'
);
```

#### `insertWithUserId()`
Insere registros com `user_id` automático.

```typescript
import { insertWithUserId } from '@/lib/supabase-utils';

const { data, error } = await insertWithUserId<Account>(
  'accounts',
  {
    name: 'Nova Conta',
    type: 'checking',
    balance: 0,
    color: '#3b82f6'
  },
  'Error creating account'
);
```

#### `updateWithUserId()`
Atualiza registros com verificação de `user_id`.

```typescript
import { updateWithUserId } from '@/lib/supabase-utils';

const { data, error } = await updateWithUserId<Account>(
  'accounts',
  accountId,
  { balance: 1000 },
  'Error updating account'
);
```

#### `deleteWithUserId()`
Deleta registro com verificação de `user_id`.

```typescript
import { deleteWithUserId } from '@/lib/supabase-utils';

const { success, error } = await deleteWithUserId(
  'accounts',
  accountId,
  'Error deleting account'
);
```

#### `deleteManyWithUserId()`
Deleta múltiplos registros com verificação de `user_id`.

```typescript
import { deleteManyWithUserId } from '@/lib/supabase-utils';

const { success, error } = await deleteManyWithUserId(
  'accounts',
  [id1, id2, id3],
  'Error deleting accounts'
);
```

## Códigos de Erro Tratados

A função `handleSupabaseError` trata especificamente os seguintes códigos:

- **23505**: Registro duplicado → "This record already exists"
- **23503**: Violação de foreign key → "Cannot delete: record is being used elsewhere"
- **42501**: Permissão negada → "Permission denied"
- **PGRST116**: Registro não encontrado → "Record not found"

## Benefícios

### 1. Redução de Código Duplicado
Antes:
```typescript
// Repetido em vários lugares
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) throw new Error('User not authenticated');

const { data, error } = await supabase
  .from('accounts')
  .select('*')
  .eq('user_id', user.id);

if (error) {
  console.error('Error:', error);
  toast({ title: 'Error', description: error.message });
  return { data: null, error };
}
```

Depois:
```typescript
const { data, error } = await queryWithUserId<Account>(
  'accounts',
  (q) => q,
  'Error fetching accounts'
);
```

### 2. Tratamento Consistente de Erros
- Todos os erros são logados automaticamente
- Toasts são exibidos de forma consistente
- Mensagens amigáveis para códigos de erro comuns

### 3. Type Safety
- Funções genéricas com tipos inferidos
- Retornos padronizados
- IntelliSense completo

### 4. Manutenibilidade
- Alterações em um único lugar
- Menos bugs por inconsistência
- Código mais limpo e legível

## Exemplos Práticos

### Exemplo 1: Buscar e Criar Conta
```typescript
import { queryWithUserId, insertWithUserId } from '@/lib/supabase-utils';

// Buscar todas as contas
const { data: accounts, error: fetchError } = await queryWithUserId<Account>(
  'accounts',
  (query) => query.order('name'),
  'Error fetching accounts'
);

if (fetchError) return;

// Criar nova conta
const { data: newAccount, error: createError } = await insertWithUserId<Account>(
  'accounts',
  { name: 'Savings', type: 'savings', balance: 0, color: '#10b981' },
  'Error creating account'
);
```

### Exemplo 2: Atualizar e Deletar
```typescript
import { updateWithUserId, deleteWithUserId } from '@/lib/supabase-utils';

// Atualizar
const { data: updated, error: updateError } = await updateWithUserId<Account>(
  'accounts',
  accountId,
  { balance: 5000 },
  'Error updating balance'
);

// Deletar
const { success, error: deleteError } = await deleteWithUserId(
  'accounts',
  accountId,
  'Error deleting account'
);
```

### Exemplo 3: Operação Complexa com Error Handling
```typescript
import { withErrorHandling, getUserId } from '@/lib/supabase-utils';

const { data, error } = await withErrorHandling(
  async () => {
    const userId = await getUserId();
    
    // Operação complexa
    const result = await performComplexOperation(userId);
    
    return result;
  },
  'Complex operation',
  true // Show toast on error
);

if (error) {
  // Error already logged and toast shown
  return;
}

// Use data
console.log(data);
```

## Migração de Código Existente

### Passo 1: Identificar Padrões Duplicados
Procure por:
- `supabase.auth.getUser()`
- `.eq('user_id', userId)`
- try-catch repetidos
- Tratamento manual de erros

### Passo 2: Substituir por Utilitários
Substitua operações diretas pelos utilitários correspondentes.

### Passo 3: Testar
Certifique-se de que a funcionalidade permanece idêntica.

## Notas Importantes

1. **Sempre use `getUserId()` ao invés de obter o user manualmente**
2. **Use `withErrorHandling()` para operações complexas**
3. **As funções genéricas são para operações CRUD simples**
4. **Para operações específicas, use edge functions ou crie funções dedicadas**

## Próximas Melhorias

- [ ] Cache de queries
- [ ] Retry logic para operações falhadas
- [ ] Request deduplication
- [ ] Optimistic updates helper
- [ ] Offline support
