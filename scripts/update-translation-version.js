#!/usr/bin/env node

/**
 * Script para atualizar automaticamente a versão de tradução
 * Calcula um hash dos arquivos de tradução e atualiza o i18n/index.ts
 * 
 * Uso:
 * - Manualmente: node scripts/update-translation-version.js
 * - Pre-commit: adicione ao .git/hooks/pre-commit
 * - Build: adicione ao script de build no package.json
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Arquivos de tradução a serem monitorados
const translationFiles = [
  'src/i18n/locales/pt-BR.json',
  'src/i18n/locales/en-US.json',
  'src/i18n/locales/es-ES.json',
];

// Arquivo de configuração i18n
const i18nConfigFile = 'src/i18n/index.ts';

/**
 * Calcula hash MD5 de um conteúdo
 */
function calculateHash(content) {
  return createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * Gera uma versão semântica baseada no hash
 */
function generateVersion() {
  let combinedContent = '';
  
  // Concatenar conteúdo de todos os arquivos de tradução
  for (const file of translationFiles) {
    try {
      const filePath = join(projectRoot, file);
      const content = readFileSync(filePath, 'utf8');
      combinedContent += content;
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo ${file}:`, error.message);
      process.exit(1);
    }
  }
  
  // Calcular hash do conteúdo combinado
  const hash = calculateHash(combinedContent);
  
  // Gerar versão no formato: 1.0.hash
  return `1.0.${hash}`;
}

/**
 * Atualiza a versão no arquivo i18n/index.ts
 */
function updateVersionInConfig(newVersion) {
  const configPath = join(projectRoot, i18nConfigFile);
  
  try {
    let content = readFileSync(configPath, 'utf8');
    
    // Regex para encontrar a linha TRANSLATION_VERSION
    const versionRegex = /const TRANSLATION_VERSION = ['"](.+?)['"]/;
    const match = content.match(versionRegex);
    
    if (!match) {
      console.error('❌ Não foi possível encontrar TRANSLATION_VERSION no arquivo');
      process.exit(1);
    }
    
    const oldVersion = match[1];
    
    // Verificar se a versão mudou
    if (oldVersion === newVersion) {
      console.log('✅ Versão de tradução já está atualizada:', newVersion);
      return false;
    }
    
    // Substituir a versão
    content = content.replace(versionRegex, `const TRANSLATION_VERSION = '${newVersion}'`);
    
    // Escrever arquivo atualizado
    writeFileSync(configPath, content, 'utf8');
    
    console.log(`🔄 Versão de tradução atualizada: ${oldVersion} -> ${newVersion}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erro ao atualizar ${i18nConfigFile}:`, error.message);
    process.exit(1);
  }
}

/**
 * Função principal
 */
function main() {
  console.log('🔍 Verificando mudanças nos arquivos de tradução...\n');
  
  // Gerar nova versão baseada no hash dos arquivos
  const newVersion = generateVersion();
  console.log(`📦 Nova versão gerada: ${newVersion}\n`);
  
  // Atualizar versão no arquivo de configuração
  const updated = updateVersionInConfig(newVersion);
  
  if (updated) {
    console.log('\n✅ Script executado com sucesso!');
    console.log('💡 Lembre-se de commitar as mudanças no i18n/index.ts');
  }
}

// Executar script
main();
