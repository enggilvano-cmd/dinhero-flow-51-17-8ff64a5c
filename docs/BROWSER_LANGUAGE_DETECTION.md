# Detecção Automática de Idioma do Navegador

## 🌍 Visão Geral

O sistema agora detecta automaticamente o idioma preferido do navegador do usuário e configura a interface de acordo. Isso proporciona uma experiência mais natural e localizada desde o primeiro acesso.

## ⚙️ Como Funciona

### 1. Detecção do Idioma

A função `detectBrowserLanguage()` em `src/i18n/index.ts` realiza a detecção:

```typescript
export const detectBrowserLanguage = (): string => {
  // Obtém lista de idiomas preferidos do navegador
  const browserLanguages = navigator.languages || [navigator.language];
  
  // Mapeia códigos de idioma para nossos idiomas suportados
  // Exemplo: 'pt', 'pt-PT' → 'pt-BR'
  //          'en', 'en-GB' → 'en-US'
  //          'es', 'es-MX' → 'es-ES'
  
  // Retorna o idioma detectado ou 'pt-BR' como fallback
}
```

### 2. Idiomas Suportados

O sistema mapeia automaticamente variações de idioma para os códigos suportados:

| Código do Navegador | Mapeado Para | Idioma |
|---------------------|--------------|--------|
| `pt`, `pt-BR`, `pt-PT` | `pt-BR` | Português (Brasil) |
| `en`, `en-US`, `en-GB`, `en-AU`, `en-CA` | `en-US` | Inglês (Estados Unidos) |
| `es`, `es-ES`, `es-MX`, `es-AR`, `es-CO` | `es-ES` | Espanhol (Espanha) |

### 3. Prioridade de Idiomas

A ordem de prioridade é:

1. **Preferência salva do usuário** (banco de dados)
2. **Idioma detectado do navegador** (primeira visita)
3. **Fallback padrão** (pt-BR)

## 🔄 Fluxo de Funcionamento

### Primeiro Acesso (Usuário Não Autenticado)

```
1. Sistema detecta idioma do navegador
   ↓
2. i18n é inicializado com o idioma detectado
   ↓
3. Interface aparece no idioma correto
```

**Exemplo:**
- Navegador em Espanhol → Interface em Espanhol
- Navegador em Inglês → Interface em Inglês

### Primeiro Login (Sem Preferência Salva)

```
1. Usuário faz login
   ↓
2. Sistema verifica preferências salvas
   ↓
3. Não encontra preferência de idioma
   ↓
4. Usa idioma detectado do navegador
   ↓
5. Salva como preferência padrão
```

### Logins Posteriores (Com Preferência Salva)

```
1. Usuário faz login
   ↓
2. Sistema carrega preferências do banco
   ↓
3. Encontra idioma salvo (ex: 'en-US')
   ↓
4. Aplica idioma salvo (ignora detecção)
```

## 💡 Exemplos Práticos

### Cenário 1: Usuário Brasileiro

```javascript
// Navegador configurado para pt-BR
navigator.language = 'pt-BR';

// Resultado:
// 1. Interface inicia em Português
// 2. Primeiro login: salva 'pt-BR' como preferência
// 3. Próximos logins: sempre em Português
```

### Cenário 2: Usuário Espanhol do México

```javascript
// Navegador configurado para es-MX
navigator.language = 'es-MX';

// Resultado:
// 1. Sistema detecta es-MX
// 2. Mapeia para es-ES (Espanhol suportado)
// 3. Interface inicia em Espanhol
// 4. Salva 'es-ES' como preferência
```

### Cenário 3: Usuário com Múltiplos Idiomas

```javascript
// Navegador com lista de preferências
navigator.languages = ['fr-FR', 'en-US', 'pt-BR'];

// Resultado:
// 1. Tenta 'fr-FR' → não suportado
// 2. Tenta 'en-US' → suportado! ✓
// 3. Interface inicia em Inglês
```

### Cenário 4: Idioma Não Suportado

```javascript
// Navegador em idioma não suportado
navigator.language = 'ja-JP'; // Japonês

// Resultado:
// 1. Nenhum idioma da lista é suportado
// 2. Usa fallback: pt-BR
// 3. Interface inicia em Português
```

## 🎯 Casos de Uso

### 1. Experiência Internacional

Um usuário americano acessa o sistema pela primeira vez:

- ✅ Interface aparece automaticamente em inglês
- ✅ Não precisa procurar como trocar o idioma
- ✅ Experiência mais intuitiva

### 2. Equipes Multiculturais

Uma empresa com funcionários de diferentes países:

- ✅ Cada usuário vê a interface no seu idioma preferido
- ✅ Configuração automática no primeiro acesso
- ✅ Pode alterar manualmente se desejar

### 3. Migração de Dispositivo

Usuário troca de computador ou navegador:

- ✅ Preferência salva no banco de dados
- ✅ Idioma permanece consistente
- ✅ Sincronização automática entre dispositivos

## 🛠️ Configuração Manual

### Trocar Idioma Manualmente

Mesmo com detecção automática, o usuário pode trocar o idioma:

1. Acesse **Configurações** (⚙️)
2. Seção **Idioma**
3. Selecione o idioma desejado:
   - Português (Brasil)
   - English (United States)
   - Español (España)
4. Preferência é salva automaticamente

### Resetar para Idioma do Navegador

Para voltar ao idioma detectado automaticamente:

1. Verifique o idioma do seu navegador
2. Selecione o mesmo idioma nas configurações
3. Ou limpe as configurações (voltará à detecção automática)

## 🔍 Debug e Logs

O sistema registra informações úteis no console do navegador:

```javascript
// Idioma detectado com sucesso
🌍 Idioma detectado (match exato): en-US

// Idioma mapeado de variante
🌍 Idioma detectado (mapeado): en-GB -> en-US

// Nenhum idioma suportado encontrado
🌍 Idioma não detectado, usando fallback: pt-BR

// Primeira vez sem preferência salva
📝 Preferência de idioma não encontrada, usando idioma detectado: en-US

// Alteração de idioma
🔄 Alterando idioma de pt-BR para en-US
```

### Como Visualizar os Logs

1. Abra as **Ferramentas do Desenvolvedor** (F12)
2. Vá para a aba **Console**
3. Filtre por emojis: 🌍 📝 🔄
4. Veja o fluxo de detecção e aplicação do idioma

## 🧪 Testando a Detecção

### Testar Diferentes Idiomas

#### Método 1: Configurações do Navegador

1. **Chrome/Edge**:
   - Settings → Languages → Language preferences
   - Adicione idiomas e reordene por prioridade

2. **Firefox**:
   - Settings → General → Language → Choose
   - Adicione idiomas preferidos

3. **Safari**:
   - System Preferences → Language & Region
   - Adicione idiomas preferidos

#### Método 2: DevTools

No console do navegador:

```javascript
// Simular navegador em espanhol
Object.defineProperty(navigator, 'language', {
  value: 'es-ES',
  writable: true
});

// Recarregar a página
location.reload();
```

#### Método 3: Parâmetros de Teste

Durante desenvolvimento, você pode forçar um idioma:

```typescript
// src/i18n/index.ts (apenas para testes)
const testLanguage = 'en-US'; // Forçar inglês
const detectedLanguage = testLanguage || detectBrowserLanguage();
```

## 📊 Estatísticas de Uso

### Mapeamentos Comuns

Baseado em estatísticas de uso web:

| Região | Idioma Comum | Mapeado Para |
|--------|--------------|--------------|
| 🇧🇷 Brasil | pt-BR | pt-BR |
| 🇵🇹 Portugal | pt-PT | pt-BR |
| 🇺🇸 EUA | en-US | en-US |
| 🇬🇧 Reino Unido | en-GB | en-US |
| 🇪🇸 Espanha | es-ES | es-ES |
| 🇲🇽 México | es-MX | es-ES |
| 🇦🇷 Argentina | es-AR | es-ES |

### Fallback (Outros Países)

- 🇫🇷 França (fr-FR) → pt-BR (fallback)
- 🇩🇪 Alemanha (de-DE) → pt-BR (fallback)
- 🇮🇹 Itália (it-IT) → pt-BR (fallback)
- 🇨🇳 China (zh-CN) → pt-BR (fallback)
- 🇯🇵 Japão (ja-JP) → pt-BR (fallback)

## 🚀 Melhorias Futuras

### Planejadas

- [ ] Adicionar mais idiomas (francês, alemão, italiano)
- [ ] Detecção de formato de moeda por região
- [ ] Formato de data/hora por região
- [ ] Notificação quando idioma é detectado automaticamente

### Em Consideração

- [ ] Permitir múltiplos idiomas por usuário
- [ ] Sugestão de idioma baseada em localização IP
- [ ] Tradução de conteúdo dinâmico

## ❓ FAQ

### O idioma detectado pode ser diferente do que escolhi?

Sim, apenas na primeira visita. Depois que você escolher manualmente um idioma nas configurações, ele será mantido independente do idioma do navegador.

### Posso desativar a detecção automática?

Não é necessário desativar. Após o primeiro login, o sistema sempre usará sua preferência salva, ignorando a detecção automática.

### O idioma sincroniza entre dispositivos?

Sim! A preferência de idioma é salva no banco de dados, então ao fazer login em outro dispositivo, o idioma será o mesmo.

### E se meu idioma não for suportado?

O sistema usa Português (Brasil) como fallback. Você pode então trocar manualmente para Inglês ou Espanhol se preferir.

### Como voltar para o idioma detectado automaticamente?

Basta selecionar o idioma que corresponde ao seu navegador nas configurações. O sistema aplicará e salvará essa preferência.

---

**Implementado em**: 2025-01-13  
**Versão**: 1.0.0  
**Status**: ✅ Ativo em Produção
