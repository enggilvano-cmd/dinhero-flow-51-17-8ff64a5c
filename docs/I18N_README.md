# Sistema de Internacionalização (i18n)

## 📖 Visão Geral

O sistema utiliza **react-i18next** para gerenciar traduções em múltiplos idiomas. Esta documentação explica como o sistema funciona e como adicionar novas traduções.

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
src/
├── i18n/
│   ├── index.ts              # Configuração principal do i18n
│   └── locales/              # Arquivos de tradução
│       ├── pt-BR.json        # Português (Brasil) - Padrão
│       ├── en-US.json        # Inglês (EUA)
│       └── es-ES.json        # Espanhol (Espanha)
```

### Configuração (src/i18n/index.ts)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt-BR',           // Idioma padrão
    fallbackLng: 'pt-BR',   // Idioma de fallback
    interpolation: {
      escapeValue: false,   // React já faz escape
    },
  });

export default i18n;
```

## 🎯 Como Usar

### 1. Hook useTranslation

A forma mais comum de usar traduções:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcome')}</p>
      
      {/* Idioma atual */}
      <p>Idioma: {i18n.language}</p>
      
      {/* Trocar idioma */}
      <button onClick={() => i18n.changeLanguage('en-US')}>
        English
      </button>
    </div>
  );
}
```

### 2. Traduções com Variáveis

Use interpolação para incluir variáveis dinâmicas:

```json
// pt-BR.json
{
  "welcome": "Olá {{name}}, você tem {{count}} mensagens"
}
```

```tsx
// Componente
t('welcome', { name: 'João', count: 5 })
// Resultado: "Olá João, você tem 5 mensagens"
```

### 3. Pluralização

```json
{
  "items": "{{count}} item",
  "items_plural": "{{count}} itens"
}
```

```tsx
t('items', { count: 1 })  // "1 item"
t('items', { count: 5 })  // "5 itens"
```

### 4. Traduções Condicionais

```tsx
const status = isActive ? 'active' : 'inactive';
return <Badge>{t(`status.${status}`)}</Badge>;
```

### 5. Formatação de Datas

Use bibliotecas como `date-fns` com locale:

```tsx
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';

const locales = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': es
};

const formattedDate = format(
  new Date(), 
  'PPP',
  { locale: locales[i18n.language] }
);
```

## 🎨 Padrões e Convenções

### Nomenclatura de Chaves

Use nomenclatura descritiva e hierárquica:

```json
{
  "feature": {
    "action": "texto",
    "title": "texto",
    "description": "texto",
    "button": {
      "save": "texto",
      "cancel": "texto"
    },
    "validation": {
      "required": "texto",
      "invalid": "texto"
    }
  }
}
```

### Organização por Contexto

Agrupe traduções por contexto/funcionalidade:

- `common` - Elementos comuns (botões, labels genéricos)
- `auth` - Autenticação e login
- `dashboard` - Dashboard e estatísticas
- `accounts` - Contas bancárias
- `transactions` - Transações
- `categories` - Categorias
- `settings` - Configurações
- `validation` - Mensagens de validação
- `messages` - Mensagens do sistema

### Textos Curtos vs Longos

Para textos responsivos:

```json
{
  "title": "Gerenciamento de Usuários",
  "titleShort": "Usuários",
  "description": "Gerencie usuários e suas permissões de acesso",
  "descriptionShort": "Gerencie usuários"
}
```

```tsx
// Desktop
<span className="hidden sm:block">{t('title')}</span>
// Mobile
<span className="block sm:hidden">{t('titleShort')}</span>
```

## 🔄 Fluxo de Tradução

### 1. Identificar Textos para Traduzir

Procure por textos fixos no código:
```tsx
// ❌ Errado - texto fixo
<button>Salvar</button>

// ✅ Correto - usando tradução
<button>{t('common.save')}</button>
```

### 2. Adicionar Chaves em Todos os Idiomas

Sempre adicione a tradução nos 3 arquivos simultaneamente:

**pt-BR.json**:
```json
{
  "myFeature": {
    "title": "Meu Recurso"
  }
}
```

**en-US.json**:
```json
{
  "myFeature": {
    "title": "My Feature"
  }
}
```

**es-ES.json**:
```json
{
  "myFeature": {
    "title": "Mi Recurso"
  }
}
```

### 3. Usar no Componente

```tsx
import { useTranslation } from 'react-i18next';

function MyFeature() {
  const { t } = useTranslation();
  return <h1>{t('myFeature.title')}</h1>;
}
```

### 4. Testar nos 3 Idiomas

Troque o idioma e verifique se o texto aparece corretamente.

## 🧩 Integração com SettingsContext

O sistema persiste a preferência de idioma do usuário:

```tsx
// src/context/SettingsContext.tsx
const updateSettings = async (newSettings: AppSettings) => {
  setSettings(newSettings);
  
  // Atualiza o idioma do i18n
  if (newSettings.language && i18n.language !== newSettings.language) {
    await i18n.changeLanguage(newSettings.language);
  }
  
  // Salva no Supabase
  if (user) {
    await saveSettings(newSettings);
  }
};
```

## 📱 Componente de Seleção de Idioma

Exemplo de como criar um seletor de idioma:

```tsx
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function LanguageSelector() {
  const { i18n } = useTranslation();
  
  const languages = [
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'en-US', name: 'English (United States)' },
    { code: 'es-ES', name: 'Español (España)' }
  ];
  
  return (
    <Select
      value={i18n.language}
      onValueChange={(value) => i18n.changeLanguage(value)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map(lang => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

## 🔍 Debugging

### Verificar Chave Não Traduzida

Se uma chave aparecer em vez do texto (ex: "common.save"):

1. Verifique se a chave existe no arquivo JSON
2. Verifique a sintaxe JSON (vírgulas, aspas)
3. Verifique se o idioma está correto
4. Reinicie o servidor de desenvolvimento

### Console de Debug

Habilite logs do i18next:

```typescript
i18n.init({
  // ... outras configurações
  debug: true  // Adicione esta linha
});
```

### Chaves Faltantes

Para encontrar chaves faltantes, busque por strings hardcoded:

```bash
# Procurar por strings em JSX
grep -r '".*"' src/components --include="*.tsx"

# Procurar por texto específico
grep -r "Salvar" src/components --include="*.tsx"
```

## 🌍 Adicionando Novo Idioma

### 1. Criar Arquivo de Tradução

```bash
# Criar novo arquivo
cp src/i18n/locales/pt-BR.json src/i18n/locales/fr-FR.json
```

### 2. Traduzir Conteúdo

Edite `fr-FR.json` e traduza todas as chaves para francês.

### 3. Registrar no i18n

```typescript
// src/i18n/index.ts
import frFR from './locales/fr-FR.json';

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
  'fr-FR': { translation: frFR },  // Adicionar
};
```

### 4. Adicionar no Seletor

```tsx
const languages = [
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'en-US', name: 'English (United States)' },
  { code: 'es-ES', name: 'Español (España)' },
  { code: 'fr-FR', name: 'Français (France)' },  // Adicionar
];
```

## 📊 Estatísticas do Projeto

### Idiomas Implementados
- ✅ Português (Brasil) - 100%
- ✅ Inglês (EUA) - 100%
- ✅ Espanhol (Espanha) - 100%

### Componentes Traduzidos
- ✅ Auth (15 componentes)
- ✅ Dashboard (8 componentes)
- ✅ Accounts (5 componentes)
- ✅ Transactions (6 componentes)
- ✅ Categories (4 componentes)
- ✅ Credit Bills (5 componentes)
- ✅ Analytics (4 componentes)
- ✅ Settings (6 componentes)
- ✅ Profile (3 componentes)
- ✅ User Management (2 componentes)
- ✅ System Settings (1 componente)

### Total de Chaves
- ~800 chaves de tradução
- 15+ componentes principais
- 95%+ cobertura da interface

## 🛠️ Ferramentas Úteis

### VSCode Extensions
- **i18n Ally** - Visualização inline de traduções
- **JSON Editor** - Editor visual para arquivos JSON

### Scripts Úteis

```bash
# Encontrar textos não traduzidos (hardcoded)
npm run find-hardcoded-strings

# Validar arquivos JSON
npm run validate-translations

# Comparar chaves entre idiomas
npm run compare-translations
```

## 📚 Recursos Externos

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [Guia de Internacionalização](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/Intl)

## 🤝 Contribuindo

Para contribuir com traduções:

1. Fork o repositório
2. Adicione/corrija traduções nos arquivos JSON
3. Teste em todos os 3 idiomas
4. Submeta um Pull Request

---

**Última atualização**: 2025-01-13  
**Mantenedor**: Equipe de Desenvolvimento
