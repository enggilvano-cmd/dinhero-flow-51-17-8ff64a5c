# Guia de Testes de Tradução

## 🎯 Objetivo

Este guia fornece um roteiro completo para testar todas as traduções implementadas no sistema, garantindo que todos os textos aparecem corretamente nos 3 idiomas suportados.

## 🌍 Idiomas a Testar

- **Português (Brasil)** - pt-BR
- **English (United States)** - en-US
- **Español (España)** - es-ES

## ✅ Roteiro de Testes

### Preparação

1. Faça login no sistema
2. Acesse **Configurações** → **Idioma**
3. Para cada teste abaixo, repita nos 3 idiomas

---

## 📋 Áreas de Teste

### 1. Autenticação

#### Página de Login
- [ ] Título da página
- [ ] Campos (Email, Senha)
- [ ] Botão "Entrar"
- [ ] Link "Esqueci minha senha"
- [ ] Link "Criar conta"
- [ ] Mensagens de validação:
  - Email obrigatório
  - Email inválido
  - Senha obrigatória
  - Senha muito curta

#### Página de Registro
- [ ] Título "Criar nova conta"
- [ ] Campos (Nome, Email, Senha, Confirmar Senha, WhatsApp)
- [ ] Botão "Cadastrar"
- [ ] Link "Já tem uma conta?"
- [ ] Mensagens de validação:
  - Nome obrigatório
  - Senhas não coincidem
  - WhatsApp inválido

#### Recuperação de Senha
- [ ] Título
- [ ] Campo de email
- [ ] Botão de envio
- [ ] Mensagem de sucesso
- [ ] Mensagem de erro

---

### 2. Dashboard

#### Cards de Estatísticas
- [ ] "Saldo Total"
- [ ] "Crédito Disponível"
- [ ] "Receitas do Mês"
- [ ] "Despesas do Mês"
- [ ] "Transações Pendentes"

#### Gráficos
- [ ] "Evolução Financeira"
- [ ] "Top Categorias"
- [ ] Legendas dos gráficos

#### Transações Recentes
- [ ] Título da seção
- [ ] Status: Completado, Pendente
- [ ] Tipos: Receita, Despesa, Transferência
- [ ] Botão "Ver todas"

---

### 3. Contas

#### Lista de Contas
- [ ] Título "Contas"
- [ ] Botão "Adicionar Conta"
- [ ] Filtros e busca
- [ ] Colunas da tabela:
  - Nome
  - Tipo
  - Saldo
  - Ações

#### Modal de Adicionar/Editar Conta
- [ ] Título
- [ ] Campos:
  - Nome da conta
  - Tipo (Conta Corrente, Poupança, Cartão de Crédito)
  - Saldo inicial
  - Limite (para cartão)
  - Data de fechamento
  - Data de vencimento
- [ ] Botões "Salvar" e "Cancelar"
- [ ] Mensagens de validação
- [ ] Toast de sucesso/erro

---

### 4. Transações

#### Lista de Transações
- [ ] Título "Transações"
- [ ] Botão "Adicionar Transação"
- [ ] Filtros:
  - Todas as transações
  - Mês atual
  - Escolher mês
  - Período personalizado
- [ ] Colunas:
  - Descrição
  - Categoria
  - Conta
  - Valor
  - Data
  - Status
  - Tipo

#### Modal de Adicionar/Editar Transação
- [ ] Título
- [ ] Tipo: Receita, Despesa, Transferência
- [ ] Campos:
  - Descrição
  - Valor
  - Data
  - Categoria
  - Conta
  - Status (Completado, Pendente)
  - Parcelamento
  - Recorrência
- [ ] Mensagens de validação
- [ ] Toast de sucesso/erro

---

### 5. Categorias

#### Lista de Categorias
- [ ] Título "Categorias"
- [ ] Botão "Adicionar Categoria"
- [ ] Filtro por tipo (Receita, Despesa, Ambos)
- [ ] Cards de categorias com nome e tipo

#### Modal de Adicionar/Editar Categoria
- [ ] Título
- [ ] Campos:
  - Nome
  - Tipo (Receita, Despesa, Ambos)
  - Cor
- [ ] Botões "Salvar" e "Cancelar"
- [ ] Mensagens de validação
- [ ] Toast de sucesso/erro

---

### 6. Faturas de Cartão

#### Lista de Faturas
- [ ] Título "Faturas de Cartão"
- [ ] Abas: "Fatura Atual" e "Próxima Fatura"
- [ ] Seletor de cartão
- [ ] Informações da fatura:
  - Total da fatura
  - Data de fechamento
  - Data de vencimento
  - Status

#### Detalhes da Fatura
- [ ] Lista de transações
- [ ] Botão "Pagar Fatura"
- [ ] Modal de pagamento
- [ ] Confirmações

---

### 7. Relatórios e Análises

#### Página de Analytics
- [ ] Título "Relatórios Financeiros"
- [ ] Botão "Exportar PDF"
- [ ] Filtros:
  - Período
  - Categorias
- [ ] Gráficos:
  - Receitas vs Despesas
  - Distribuição por categoria
  - Evolução mensal
  - Saldo acumulado
- [ ] Legendas e tooltips

---

### 8. Configurações

#### Configurações Gerais
- [ ] Título "Configurações"
- [ ] Seções:
  - Geral (Moeda, Idioma, Tema)
  - Notificações
  - Backup de Dados
  - Sobre

#### Seletor de Idioma
- [ ] Teste trocar entre os 3 idiomas
- [ ] Verificar se toda interface atualiza
- [ ] Verificar se a preferência é salva

#### Importação/Exportação
- [ ] Botões "Exportar" e "Importar"
- [ ] Modais de importação
- [ ] Mensagens de sucesso/erro
- [ ] Templates de exemplo

---

### 9. Perfil do Usuário

#### Informações Pessoais
- [ ] Título "Meu Perfil"
- [ ] Campos:
  - Nome completo
  - Email
  - Avatar
- [ ] Botão "Salvar Alterações"

#### Segurança
- [ ] "Alterar Senha"
- [ ] "Autenticação de Dois Fatores"
- [ ] Status: Ativo/Inativo
- [ ] Botões de ativar/desativar

#### Status da Conta
- [ ] Status: Ativo/Inativo
- [ ] Função: Admin, Usuário, Trial, Assinante
- [ ] Membro desde

#### Atividades Recentes
- [ ] Título
- [ ] Lista de atividades
- [ ] Datas formatadas

#### Zona de Perigo
- [ ] Título
- [ ] Botão "Sair"

---

### 10. Gerenciamento de Usuários (Admin)

#### Lista de Usuários
- [ ] Título "Gerenciamento de Usuários"
- [ ] Abas: Usuários, Auditoria
- [ ] Colunas:
  - Usuário
  - Função
  - Status
  - Criado em
  - Ações

#### Funções de Usuário
- [ ] Administrador
- [ ] Vitalício
- [ ] Trial
- [ ] Assinante

#### Status
- [ ] Ativo
- [ ] Inativo

#### Ações
- [ ] Alterar função
- [ ] Ativar/Desativar
- [ ] Excluir usuário
- [ ] Configurar assinatura

#### Log de Auditoria
- [ ] Colunas:
  - Usuário
  - Ação
  - Recurso
  - Data/Hora

---

### 11. Configurações do Sistema (Admin)

#### Período de Trial
- [ ] Título "Configurações do Sistema"
- [ ] Campo "Dias de Trial"
- [ ] Descrição
- [ ] Botão "Salvar Configurações"
- [ ] Alertas de segurança
- [ ] Mensagens de sucesso/erro

---

### 12. Autenticação de Dois Fatores

#### Configuração
- [ ] Título
- [ ] Instruções
- [ ] QR Code
- [ ] Código manual
- [ ] Campo de verificação
- [ ] Botões de ação

#### Verificação
- [ ] Título
- [ ] Campo de código
- [ ] Botão verificar
- [ ] Mensagens de erro

---

## 🔍 Checklist de Validação

Para cada área testada, confirme:

- [ ] Todos os textos aparecem no idioma correto
- [ ] Não há textos em inglês misturados
- [ ] Não há chaves de tradução aparecendo (ex: "common.save")
- [ ] Formatação de datas está correta para o idioma
- [ ] Formatação de números/moeda está correta
- [ ] Mensagens de validação aparecem traduzidas
- [ ] Toasts de sucesso/erro aparecem traduzidos
- [ ] Placeholders estão traduzidos
- [ ] Tooltips estão traduzidos
- [ ] Mensagens de confirmação estão traduzidas

---

## 📊 Relatório de Testes

Após completar todos os testes, preencha:

### Português (pt-BR)
- Status: ✅ Completo / ⚠️ Problemas / ❌ Falhas
- Problemas encontrados: _____________________

### English (en-US)
- Status: ✅ Completo / ⚠️ Problemas / ❌ Falhas
- Problemas encontrados: _____________________

### Español (es-ES)
- Status: ✅ Completo / ⚠️ Problemas / ❌ Falhas
- Problemas encontrados: _____________________

---

## 🐛 Como Reportar Problemas

Se encontrar textos não traduzidos:

1. Anote a página e localização exata
2. Anote o texto em inglês que aparece
3. Verifique se a chave existe nos arquivos de tradução
4. Se não existir, adicione em todos os 3 idiomas
5. Se existir mas não funciona, verifique o componente

---

**Data do Teste**: ___________  
**Testador**: ___________  
**Versão**: 1.0.0
