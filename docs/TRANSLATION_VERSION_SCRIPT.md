# Script de Atualização Automática de Versão de Tradução

## 📋 Visão Geral

Este script automatiza o processo de atualização da versão de tradução, calculando um hash dos arquivos de tradução e atualizando automaticamente o `TRANSLATION_VERSION` no arquivo `src/i18n/index.ts`.

## 🚀 Como Funciona

1. **Lê todos os arquivos de tradução** (pt-BR.json, en-US.json, es-ES.json)
2. **Calcula um hash MD5** do conteúdo combinado
3. **Gera uma versão semântica** no formato `1.0.xxxxxxxx` (onde x é o hash)
4. **Atualiza automaticamente** o `TRANSLATION_VERSION` no arquivo `src/i18n/index.ts`

### Por que usar hash?

- ✅ Versão muda automaticamente quando qualquer tradução é modificada
- ✅ Garante que cada mudança gera uma versão única
- ✅ Não requer intervenção manual para incrementar versões
- ✅ Força reload do cache apenas quando necessário

## 📦 Instalação

O script já está criado em `scripts/update-translation-version.js` e está pronto para uso.

## 💻 Formas de Uso

### 1. Execução Manual

Execute o script sempre que atualizar traduções:

```bash
node scripts/update-translation-version.js
```

### 2. Integração com Git Hooks (Recomendado)

#### Opção A: Pre-commit Hook

Adicione ao `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Atualizar versão de tradução automaticamente antes de cada commit
node scripts/update-translation-version.js

# Adicionar mudanças no i18n/index.ts ao commit se houver
git add src/i18n/index.ts
```

Torne o hook executável:
```bash
chmod +x .git/hooks/pre-commit
```

#### Opção B: Usando Husky (se instalado)

Se você usa Husky para gerenciar hooks:

```bash
# Instalar husky
npm install --save-dev husky

# Inicializar husky
npx husky init

# Adicionar script ao pre-commit
echo "node scripts/update-translation-version.js" > .husky/pre-commit
echo "git add src/i18n/index.ts" >> .husky/pre-commit
```

### 3. Integração com Package.json Scripts

Adicione ao `package.json`:

```json
{
  "scripts": {
    "update-translations": "node scripts/update-translation-version.js",
    "prebuild": "npm run update-translations",
    "predev": "npm run update-translations"
  }
}
```

Isso executará automaticamente:
- Antes de cada build de produção
- Antes de iniciar o servidor de desenvolvimento

### 4. Integração com CI/CD (GitHub Actions)

Adicione ao seu workflow `.github/workflows/deploy.yml`:

```yaml
- name: Update Translation Version
  run: node scripts/update-translation-version.js

- name: Commit translation version
  run: |
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    git add src/i18n/index.ts
    git diff --quiet && git diff --staged --quiet || git commit -m "chore: update translation version [skip ci]"
```

## 📝 Exemplos de Saída

### Quando há mudanças:

```
🔍 Verificando mudanças nos arquivos de tradução...

📦 Nova versão gerada: 1.0.a3f8d2c1

🔄 Versão de tradução atualizada: 1.0.b2e1c3d4 -> 1.0.a3f8d2c1

✅ Script executado com sucesso!
💡 Lembre-se de commitar as mudanças no i18n/index.ts
```

### Quando não há mudanças:

```
🔍 Verificando mudanças nos arquivos de tradução...

📦 Nova versão gerada: 1.0.a3f8d2c1

✅ Versão de tradução já está atualizada: 1.0.a3f8d2c1
```

## 🔧 Customização

### Adicionar novos arquivos de tradução

Edite o array `translationFiles` no script:

```javascript
const translationFiles = [
  'src/i18n/locales/pt-BR.json',
  'src/i18n/locales/en-US.json',
  'src/i18n/locales/es-ES.json',
  'src/i18n/locales/fr-FR.json', // Novo idioma
];
```

### Mudar formato da versão

Modifique a função `generateVersion()`:

```javascript
function generateVersion() {
  // ... código existente ...
  
  // Formato personalizado
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${date}.${hash}`; // Ex: 20250113.a3f8d2c1
}
```

## 🔍 Troubleshooting

### Script não encontra arquivos de tradução

**Erro:** `❌ Erro ao ler arquivo src/i18n/locales/pt-BR.json`

**Solução:** Verifique se os caminhos dos arquivos estão corretos no script.

### Permissão negada ao executar

**Erro:** `Permission denied`

**Solução:** 
```bash
chmod +x scripts/update-translation-version.js
```

### Git hook não executa

**Solução:** Certifique-se de que o hook é executável:
```bash
chmod +x .git/hooks/pre-commit
```

## 🎯 Benefícios

- ✅ **Automação total**: Sem necessidade de incrementar versões manualmente
- ✅ **Garantia de atualização**: Cache sempre atualizado quando traduções mudam
- ✅ **Rastreabilidade**: Cada versão representa um estado único das traduções
- ✅ **Integração fácil**: Funciona com git hooks, CI/CD, e scripts npm
- ✅ **Zero configuração adicional**: Funciona out-of-the-box após criação

## 📚 Arquivos Relacionados

- `scripts/update-translation-version.js` - Script principal
- `src/i18n/index.ts` - Arquivo que contém TRANSLATION_VERSION
- `src/i18n/locales/*.json` - Arquivos de tradução monitorados

## 🤝 Contribuindo

Para adicionar novas funcionalidades ao script:

1. Edite `scripts/update-translation-version.js`
2. Teste com `node scripts/update-translation-version.js`
3. Atualize esta documentação se necessário
