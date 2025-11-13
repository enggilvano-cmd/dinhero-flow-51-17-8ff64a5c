# Guia de Traduções - Sistema Financeiro

## 📚 Idiomas Disponíveis

O sistema possui suporte completo para os seguintes idiomas:

- **Português (Brasil)** - `pt-BR` (Padrão)
- **Inglês (EUA)** - `en-US`
- **Espanhol (Espanha)** - `es-ES`

## 🎯 Status de Tradução por Componente

### ✅ Componentes Totalmente Traduzidos

#### Autenticação e Segurança
- [x] **Auth.tsx** - Login, registro, recuperação de senha
- [x] **TwoFactorSetup.tsx** - Configuração de 2FA
- [x] **TwoFactorVerify.tsx** - Verificação de 2FA

#### Gerenciamento de Usuários
- [x] **UserManagement.tsx** - Gerenciamento completo de usuários
- [x] **UserProfile.tsx** - Perfil do usuário, senha, avatar
- [x] **SystemSettings.tsx** - Configurações globais do sistema

#### Importação de Dados
- [x] **ImportAccountsModal.tsx** - Importação de contas
- [x] **ImportCategoriesModal.tsx** - Importação de categorias
- [x] **ImportTransactionsModal.tsx** - Importação de transações

#### Outras Páginas
- [x] **SettingsPage.tsx** - Configurações gerais
- [x] **Dashboard.tsx** - Dashboard principal
- [x] **AccountsPage.tsx** - Gerenciamento de contas
- [x] **TransactionsPage.tsx** - Histórico de transações
- [x] **CategoriesPage.tsx** - Gerenciamento de categorias
- [x] **CreditBillsPage.tsx** - Faturas de cartão
- [x] **AnalyticsPage.tsx** - Relatórios e análises

## 🔧 Como Trocar de Idioma

### Para Usuários

1. Acesse **Configurações** no menu lateral
2. Na seção **Idioma**, selecione o idioma desejado:
   - Português (Brasil)
   - English (United States)
   - Español (España)
3. As alterações são salvas automaticamente
4. Toda a interface será atualizada imediatamente

### Para Desenvolvedores

O idioma pode ser alterado programaticamente usando o hook `useTranslation`:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  // Trocar idioma
  i18n.changeLanguage('en-US'); // ou 'pt-BR', 'es-ES'
  
  // Usar traduções
  return <h1>{t('common.welcome')}</h1>;
}
```

## 📝 Estrutura dos Arquivos de Tradução

Os arquivos de tradução estão localizados em:
- `src/i18n/locales/pt-BR.json`
- `src/i18n/locales/en-US.json`
- `src/i18n/locales/es-ES.json`

### Estrutura das Chaves

```json
{
  "common": {
    // Termos comuns usados em toda aplicação
  },
  "auth": {
    // Autenticação e login
  },
  "twoFactor": {
    // Autenticação de dois fatores
  },
  "dashboard": {
    // Dashboard e estatísticas
  },
  "accounts": {
    // Contas bancárias e cartões
  },
  "transactions": {
    // Transações financeiras
  },
  "categories": {
    // Categorias de transações
  },
  "creditBills": {
    // Faturas de cartão de crédito
  },
  "analytics": {
    // Relatórios e análises
  },
  "settings": {
    // Configurações gerais
  },
  "menu": {
    // Itens do menu
  },
  "profile": {
    // Perfil do usuário
  },
  "userManagement": {
    // Gerenciamento de usuários (admin)
  },
  "systemSettings": {
    // Configurações do sistema (admin)
  },
  "transfer": {
    // Transferências entre contas
  },
  "validation": {
    // Mensagens de validação
  },
  "messages": {
    // Mensagens do sistema
  },
  "dateFilter": {
    // Filtros de data
  },
  "modals": {
    // Modais e formulários
  }
}
```

## 🌍 Cobertura de Tradução

### Estatísticas Atuais

- **Total de chaves de tradução**: ~800
- **Componentes traduzidos**: 15+
- **Idiomas**: 3 (pt-BR, en-US, es-ES)
- **Cobertura**: ~95% da interface

### Áreas Traduzidas

1. **Interface de Usuário**: 100%
   - Botões, labels, placeholders
   - Mensagens de erro e sucesso
   - Títulos e descrições

2. **Validações**: 100%
   - Campos obrigatórios
   - Formatos inválidos
   - Mensagens de erro

3. **Notificações**: 100%
   - Toasts de sucesso
   - Mensagens de erro
   - Confirmações

4. **Navegação**: 100%
   - Menu lateral
   - Breadcrumbs
   - Abas e seções

## 🔍 Como Adicionar Novas Traduções

### 1. Adicione as chaves nos arquivos de idioma

**pt-BR.json**:
```json
{
  "myFeature": {
    "title": "Meu Recurso",
    "description": "Descrição do recurso"
  }
}
```

**en-US.json**:
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Feature description"
  }
}
```

**es-ES.json**:
```json
{
  "myFeature": {
    "title": "Mi Recurso",
    "description": "Descripción del recurso"
  }
}
```

### 2. Use no componente

```tsx
import { useTranslation } from 'react-i18next';

function MyFeature() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
    </div>
  );
}
```

### 3. Traduções com Variáveis

```json
{
  "message": "Olá {{name}}, você tem {{count}} mensagens"
}
```

```tsx
t('message', { name: 'João', count: 5 })
// Resultado: "Olá João, você tem 5 mensagens"
```

## 🧪 Testando as Traduções

### Checklist de Testes

Para cada nova tradução, verifique:

- [ ] Texto aparece corretamente em pt-BR
- [ ] Texto aparece corretamente em en-US
- [ ] Texto aparece corretamente em es-ES
- [ ] Mudança de idioma atualiza o texto imediatamente
- [ ] Não há texto "hardcoded" (fixo no código)
- [ ] Variáveis são substituídas corretamente
- [ ] Mensagens de erro são exibidas no idioma correto
- [ ] Formatos de data/hora respeitam o idioma
- [ ] Formatação de moeda está correta

### Páginas para Testar

1. **Login/Registro**
   - Formulários
   - Validações
   - Mensagens de erro

2. **Dashboard**
   - Cards de estatísticas
   - Gráficos (legendas)
   - Transações recentes

3. **Contas**
   - Lista de contas
   - Modal de adicionar/editar
   - Tipos de conta

4. **Transações**
   - Lista de transações
   - Filtros
   - Modal de adicionar/editar
   - Tipos e status

5. **Categorias**
   - Lista de categorias
   - Modal de adicionar/editar
   - Tipos de categoria

6. **Faturas**
   - Lista de faturas
   - Detalhes
   - Status de pagamento

7. **Relatórios**
   - Gráficos
   - Exportação
   - Filtros

8. **Configurações**
   - Seletor de idioma
   - Outras configurações
   - Importação/Exportação

9. **Perfil**
   - Informações pessoais
   - Segurança
   - Atividades

10. **Admin**
    - Gerenciamento de usuários
    - Configurações do sistema
    - Logs de auditoria

## 🚀 Próximos Passos

### Idiomas Futuros

Estrutura já preparada para adicionar:
- Francês (fr-FR)
- Italiano (it-IT)
- Alemão (de-DE)
- Mandarim (zh-CN)

### Melhorias Planejadas

- [ ] Detecção automática do idioma do navegador
- [ ] Fallback para idioma padrão em chaves não traduzidas
- [ ] Ferramentas de CI/CD para validar traduções
- [ ] Interface para gerenciar traduções sem editar JSON
- [ ] Pluralização automática
- [ ] Formatação de números específica por região

## 📞 Suporte

Para dúvidas sobre traduções ou para reportar textos não traduzidos:
1. Verifique este guia primeiro
2. Consulte os arquivos de tradução em `src/i18n/locales/`
3. Abra uma issue no repositório do projeto

---

**Última atualização**: 2025-01-13  
**Versão**: 1.0.0
