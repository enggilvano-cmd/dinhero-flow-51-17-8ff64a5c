/**
 * i18n Consistency Validator
 * Valida a consistência das chaves de tradução entre os idiomas
 */

import ptBR from '@/i18n/locales/pt-BR.json';
import enUS from '@/i18n/locales/en-US.json';
import esES from '@/i18n/locales/es-ES.json';
import { logger } from '@/lib/logger';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalKeys: number;
    missingInEnglish: number;
    missingInSpanish: number;
    extraInEnglish: number;
    extraInSpanish: number;
  };
}

/**
 * Extrai todas as chaves de um objeto de tradução de forma recursiva
 */
function extractKeys(obj: any, prefix = ''): Set<string> {
  const keys = new Set<string>();
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        // Recursão para objetos aninhados
        const nestedKeys = extractKeys(obj[key], fullKey);
        nestedKeys.forEach(k => keys.add(k));
      } else {
        // Chave folha (string, número, etc.)
        keys.add(fullKey);
      }
    }
  }
  
  return keys;
}

/**
 * Compara dois conjuntos de chaves e retorna as diferenças
 */
function compareKeys(baseKeys: Set<string>, compareKeys: Set<string>): {
  missing: string[];
  extra: string[];
} {
  const missing: string[] = [];
  const extra: string[] = [];
  
  // Encontrar chaves faltando no idioma comparado
  baseKeys.forEach(key => {
    if (!compareKeys.has(key)) {
      missing.push(key);
    }
  });
  
  // Encontrar chaves extras no idioma comparado
  compareKeys.forEach(key => {
    if (!baseKeys.has(key)) {
      extra.push(key);
    }
  });
  
  return { missing, extra };
}

/**
 * Valida a consistência das traduções
 * @returns ValidationResult com erros, avisos e resumo
 */
export function validateTranslations(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Extrair todas as chaves de cada idioma
  const ptKeys = extractKeys(ptBR);
  const enKeys = extractKeys(enUS);
  const esKeys = extractKeys(esES);
  
  logger.info('🔍 Validando consistência i18n...');
  logger.info(`📊 Total de chaves: PT-BR: ${ptKeys.size}, EN-US: ${enKeys.size}, ES-ES: ${esKeys.size}`);
  
  // Comparar inglês com português (base)
  const enComparison = compareKeys(ptKeys, enKeys);
  
  // Comparar espanhol com português (base)
  const esComparison = compareKeys(ptKeys, esKeys);
  
  // Adicionar erros para chaves faltando
  if (enComparison.missing.length > 0) {
    errors.push(`❌ EN-US: ${enComparison.missing.length} chaves faltando`);
    enComparison.missing.forEach(key => {
      errors.push(`  - en-US.json: "${key}"`);
    });
  }
  
  if (esComparison.missing.length > 0) {
    errors.push(`❌ ES-ES: ${esComparison.missing.length} chaves faltando`);
    esComparison.missing.forEach(key => {
      errors.push(`  - es-ES.json: "${key}"`);
    });
  }
  
  // Adicionar avisos para chaves extras
  if (enComparison.extra.length > 0) {
    warnings.push(`⚠️ EN-US: ${enComparison.extra.length} chaves extras (não existem em PT-BR)`);
    enComparison.extra.forEach(key => {
      warnings.push(`  - en-US.json: "${key}"`);
    });
  }
  
  if (esComparison.extra.length > 0) {
    warnings.push(`⚠️ ES-ES: ${esComparison.extra.length} chaves extras (não existem em PT-BR)`);
    esComparison.extra.forEach(key => {
      warnings.push(`  - es-ES.json: "${key}"`);
    });
  }
  
  const isValid = errors.length === 0;
  
  const summary = {
    totalKeys: ptKeys.size,
    missingInEnglish: enComparison.missing.length,
    missingInSpanish: esComparison.missing.length,
    extraInEnglish: enComparison.extra.length,
    extraInSpanish: esComparison.extra.length,
  };
  
  // Log resumo
  if (isValid) {
    logger.success('✅ Todas as traduções estão consistentes!');
  } else {
    logger.error('❌ Inconsistências encontradas nas traduções:');
    errors.forEach(err => logger.error(err));
  }
  
  if (warnings.length > 0) {
    logger.warn('⚠️ Avisos encontrados:');
    warnings.forEach(warn => logger.warn(warn));
  }
  
  return {
    isValid,
    errors,
    warnings,
    summary,
  };
}

/**
 * Executa a validação e lança erro se houver inconsistências
 * Útil para CI/CD
 */
export function assertTranslationsValid(): void {
  const result = validateTranslations();
  
  if (!result.isValid) {
    throw new Error(
      `Inconsistências de tradução encontradas:\n${result.errors.join('\n')}`
    );
  }
}

/**
 * Verifica se uma chave específica existe em todos os idiomas
 */
export function checkKey(key: string): {
  existsInPT: boolean;
  existsInEN: boolean;
  existsInES: boolean;
  allLanguages: boolean;
} {
  const ptKeys = extractKeys(ptBR);
  const enKeys = extractKeys(enUS);
  const esKeys = extractKeys(esES);
  
  const existsInPT = ptKeys.has(key);
  const existsInEN = enKeys.has(key);
  const existsInES = esKeys.has(key);
  
  return {
    existsInPT,
    existsInEN,
    existsInES,
    allLanguages: existsInPT && existsInEN && existsInES,
  };
}

// Executar validação em desenvolvimento
if (import.meta.env.DEV) {
  // Executar após um delay para não atrapalhar o hot reload
  setTimeout(() => {
    const result = validateTranslations();
    
    if (!result.isValid || result.warnings.length > 0) {
      logger.group('📋 Relatório de Validação i18n');
      logger.info(`Total de chaves (PT-BR): ${result.summary.totalKeys}`);
      logger.info(`Faltando em EN-US: ${result.summary.missingInEnglish}`);
      logger.info(`Faltando em ES-ES: ${result.summary.missingInSpanish}`);
      logger.info(`Extras em EN-US: ${result.summary.extraInEnglish}`);
      logger.info(`Extras em ES-ES: ${result.summary.extraInSpanish}`);
      logger.groupEnd();
    }
  }, 2000);
}
