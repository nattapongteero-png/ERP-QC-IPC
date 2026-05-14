#!/usr/bin/env npx tsx
/**
 * i18n Validation Script
 *
 * Validates translation files for completeness and consistency:
 * - Extracts t() function calls from source code
 * - Compares used keys against translation files
 * - Reports missing keys per locale
 * - Reports inconsistent keys across locales
 *
 * Usage:
 *   bun run scripts/validate-i18n.ts [--fix] [--verbose]
 *
 * Options:
 *   --fix      Auto-add missing keys to translation files (stub values)
 *   --verbose  Show detailed output including all checked files
 *   --strict   Fail on warnings (inconsistent keys)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  srcDir: 'src',
  localesDir: 'src/locales',
  locales: ['th', 'en'] as const,
  primaryLocale: 'th',
  /**
   * Required locales must have 100% translation coverage.
   * Missing translations in required locales cause validation to FAIL (exit code 1).
   */
  requiredLocales: ['th', 'en'] as const,
  /**
   * Optional locales can have partial translation coverage.
   * Missing translations in optional locales generate WARNINGS only.
   * Useful for gradual rollout of new languages (e.g., 'zh', 'ja').
   *
   * To add a new optional locale:
   * 1. Create locale directory: mkdir -p src/locales/zh
   * 2. Add to CONFIG.locales array above
   * 3. Add to CONFIG.optionalLocales array below
   * 4. Translation gaps will show as warnings, not errors
   */
  optionalLocales: [] as string[],
  fileExtensions: ['.tsx', '.ts'],
  excludePatterns: [
    /node_modules/,
    /\.test\./,
    /\.spec\./,
    /tests\//,
    /\.d\.ts$/,
    // Exclude accounting reports - uses ReportLanguageProvider (separate i18n system)
    /src\/app\/accounting\/reports\//,
    // Exclude report language context (separate i18n system)
    /src\/contexts\/report-language-context\.tsx$/,
  ],
};

type Locale = (typeof CONFIG.locales)[number];

// Types
interface UsedKey {
  key: string;
  file: string;
  line: number;
  /** The namespace from useTranslations(), e.g., 'purchasing' or 'dashboard.audit' */
  namespace: string | null;
}

interface ValidationError {
  key: string;
  file: string;
  line: number;
  locale: string;
  severity: 'error' | 'warning';
  message: string;
}

interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalKeysUsed: number;
    totalKeysDefined: Record<Locale, number>;
    missingCount: number;
    inconsistentCount: number;
    coveragePercent: Record<Locale, number>;
  };
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

/**
 * Extract the namespace from useTranslations() call in a file
 * Supports both simple namespaces like 'common' and nested like 'dashboard.audit'
 */
function extractNamespace(content: string): string | null {
  // Match useTranslations('namespace') or useTranslations("namespace")
  const namespaceRegex = /useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/;
  const match = content.match(namespaceRegex);
  return match ? match[1] : null;
}

/**
 * Convert a namespace like 'dashboard.audit' to a key prefix
 * Returns the part after the first dot if it's a nested namespace within a file
 * e.g., 'dashboard.audit' -> 'audit' (because 'dashboard' is the file name)
 *       'common' -> null (no prefix needed)
 */
function getKeyPrefixFromNamespace(namespace: string): string | null {
  const parts = namespace.split('.');
  if (parts.length > 1) {
    // Return everything after the first part (which is the file name)
    return parts.slice(1).join('.');
  }
  return null;
}

/**
 * Extract translation keys from source code content
 */
function extractTranslationKeys(content: string, filePath: string): UsedKey[] {
  const keys: UsedKey[] = [];
  const lines = content.split('\n');

  // Detect the namespace used in this file
  const namespace = extractNamespace(content);
  const keyPrefix = namespace ? getKeyPrefixFromNamespace(namespace) : null;

  // Match various t() function call patterns:
  // - t('key')
  // - t("key")
  // - t(`key`)
  // - t('key', { ... })
  const tFunctionRegex = /\bt\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,|\))/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = tFunctionRegex.exec(line)) !== null) {
      let key = match[1];
      // Skip dynamic keys with template literals (${...})
      if (key.includes('${')) {
        continue;
      }

      // Prepend the key prefix from useTranslations namespace if present
      // e.g., useTranslations('dashboard.audit') + t('error') -> 'audit.error'
      if (keyPrefix) {
        key = `${keyPrefix}.${key}`;
      }

      keys.push({
        key,
        file: filePath,
        line: index + 1,
        namespace,
      });
    }
    // Reset lastIndex for each line
    tFunctionRegex.lastIndex = 0;
  });

  return keys;
}

/**
 * Get all source files recursively
 */
function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Check exclusion patterns
      if (CONFIG.excludePatterns.some((pattern) => pattern.test(fullPath))) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CONFIG.fileExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(dir);
  return files;
}

/**
 * Load translation file for a locale (merged - for backward compatibility and key counting)
 */
function loadTranslations(locale: Locale): Record<string, unknown> {
  const localeDir = path.join(CONFIG.localesDir, locale);

  if (!fs.existsSync(localeDir)) {
    return {};
  }

  const translations: Record<string, unknown> = {};
  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(localeDir, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      Object.assign(translations, content);
    } catch (error) {
      console.error(
        `${colors.red}Error loading ${filePath}:${colors.reset}`,
        error
      );
    }
  }

  return translations;
}

/**
 * Load translation files per namespace for a locale
 * Returns a map: namespace (file basename without .json) -> content
 */
function loadTranslationsPerNamespace(locale: Locale): Map<string, Record<string, unknown>> {
  const localeDir = path.join(CONFIG.localesDir, locale);
  const result = new Map<string, Record<string, unknown>>();

  if (!fs.existsSync(localeDir)) {
    return result;
  }

  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(localeDir, file);
    const namespace = file.replace('.json', '');
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      result.set(namespace, content);
    } catch (error) {
      console.error(
        `${colors.red}Error loading ${filePath}:${colors.reset}`,
        error
      );
    }
  }

  return result;
}

/**
 * Get nested value from object using dot notation key
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Flatten nested object to dot notation keys
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey)
      );
    } else {
      result[newKey] = String(value);
    }
  }

  return result;
}

/**
 * Main validation function
 */
function validateTranslations(verbose: boolean = false): ValidationResult {
  console.log(`\n${colors.bold}🌐 i18n Validation${colors.reset}\n`);

  // Step 1: Collect all used translation keys
  console.log(`${colors.cyan}Scanning source files...${colors.reset}`);
  const sourceFiles = getSourceFiles(CONFIG.srcDir);
  const usedKeys: UsedKey[] = [];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const keys = extractTranslationKeys(content, file);
    usedKeys.push(...keys);
  }

  // Deduplicate keys (keep first occurrence for error reporting)
  const uniqueKeysMap = new Map<string, UsedKey>();
  for (const key of usedKeys) {
    if (!uniqueKeysMap.has(key.key)) {
      uniqueKeysMap.set(key.key, key);
    }
  }
  const uniqueKeys = Array.from(uniqueKeysMap.values());

  if (verbose) {
    console.log(`  Scanned ${sourceFiles.length} files`);
    console.log(`  Found ${usedKeys.length} t() calls`);
    console.log(`  ${uniqueKeys.length} unique keys`);
  }

  // Step 2: Load translation files
  console.log(`${colors.cyan}Loading translation files...${colors.reset}`);
  const translations: Record<Locale, Record<string, unknown>> = {} as Record<
    Locale,
    Record<string, unknown>
  >;
  const translationsPerNs: Record<Locale, Map<string, Record<string, unknown>>> = {} as Record<
    Locale,
    Map<string, Record<string, unknown>>
  >;
  const definedKeysPerLocale: Record<Locale, Set<string>> = {} as Record<
    Locale,
    Set<string>
  >;

  for (const locale of CONFIG.locales) {
    translations[locale] = loadTranslations(locale);
    translationsPerNs[locale] = loadTranslationsPerNamespace(locale);
    const flatKeys = flattenObject(translations[locale]);
    definedKeysPerLocale[locale] = new Set(Object.keys(flatKeys));

    if (verbose) {
      console.log(
        `  ${locale}: ${definedKeysPerLocale[locale].size} keys defined`
      );
    }
  }

  // Step 3: Validate keys
  console.log(`${colors.cyan}Validating translations...${colors.reset}\n`);
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check for missing keys in used translations
  for (const { key, file, line, namespace } of uniqueKeys) {
    for (const locale of CONFIG.locales) {
      let value: unknown;

      if (namespace) {
        // Namespace-aware lookup: useTranslations('purchasing') -> look in purchasing.json
        // useTranslations('dashboard.audit') -> look in dashboard.json under 'audit' prefix
        const namespaceParts = namespace.split('.');
        const jsonFileName = namespaceParts[0]; // e.g., 'purchasing' or 'dashboard'
        const nsTranslations = translationsPerNs[locale].get(jsonFileName);

        if (nsTranslations) {
          value = getNestedValue(nsTranslations, key);
        }
      } else {
        // Fallback to merged lookup for files without useTranslations
        value = getNestedValue(translations[locale], key);
      }

      if (value === undefined) {
        errors.push({
          key,
          file,
          line,
          locale,
          severity: 'error',
          message: `Missing translation for key "${key}" in locale "${locale}"`,
        });
      }
    }
  }

  // Check for inconsistent keys (present in some locales but not all)
  const allDefinedKeys = new Set<string>();
  for (const locale of CONFIG.locales) {
    definedKeysPerLocale[locale].forEach((k) => allDefinedKeys.add(k));
  }

  for (const key of allDefinedKeys) {
    const missingInLocales = CONFIG.locales.filter(
      (locale) => !definedKeysPerLocale[locale].has(key)
    );
    if (missingInLocales.length > 0 && missingInLocales.length < CONFIG.locales.length) {
      for (const locale of missingInLocales) {
        warnings.push({
          key,
          file: `src/locales/${locale}/`,
          line: 0,
          locale,
          severity: 'warning',
          message: `Key "${key}" is defined in other locales but missing in "${locale}"`,
        });
      }
    }
  }

  // Step 4: Calculate summary
  const totalKeysDefined = {} as Record<Locale, number>;
  const coveragePercent = {} as Record<Locale, number>;

  for (const locale of CONFIG.locales) {
    totalKeysDefined[locale] = definedKeysPerLocale[locale].size;
    const usedKeysCount = uniqueKeys.length;
    const matchingKeys = uniqueKeys.filter(({ key, namespace }) => {
      if (namespace) {
        const namespaceParts = namespace.split('.');
        const jsonFileName = namespaceParts[0];
        const nsTranslations = translationsPerNs[locale].get(jsonFileName);
        return nsTranslations && getNestedValue(nsTranslations, key) !== undefined;
      }
      return getNestedValue(translations[locale], key) !== undefined;
    }).length;
    coveragePercent[locale] =
      usedKeysCount > 0 ? Math.round((matchingKeys / usedKeysCount) * 100) : 100;
  }

  const result: ValidationResult = {
    success: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalKeysUsed: uniqueKeys.length,
      totalKeysDefined,
      missingCount: errors.length,
      inconsistentCount: warnings.length,
      coveragePercent,
    },
  };

  // Step 5: Print results
  printResults(result, verbose);

  return result;
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult, verbose: boolean) {
  const { summary, errors, warnings } = result;

  // Print summary table
  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`  Total unique keys used: ${summary.totalKeysUsed}`);
  console.log('');
  console.log('  Locale  | Defined | Coverage');
  console.log('  --------|---------|----------');
  for (const locale of CONFIG.locales) {
    const coverage = summary.coveragePercent[locale];
    const coverageColor =
      coverage === 100
        ? colors.green
        : coverage >= 90
          ? colors.yellow
          : colors.red;
    console.log(
      `  ${locale.padEnd(7)} | ${String(summary.totalKeysDefined[locale]).padStart(7)} | ${coverageColor}${coverage}%${colors.reset}`
    );
  }
  console.log('');

  // Print errors
  if (errors.length > 0) {
    console.log(
      `${colors.red}${colors.bold}✗ ${errors.length} missing translation(s):${colors.reset}`
    );
    const displayErrors = verbose ? errors : errors.slice(0, 10);
    for (const error of displayErrors) {
      console.log(
        `  ${colors.red}•${colors.reset} [${error.locale}] ${error.key}`
      );
      console.log(`    ${colors.dim}${error.file}:${error.line}${colors.reset}`);
    }
    if (!verbose && errors.length > 10) {
      console.log(
        `  ${colors.dim}... and ${errors.length - 10} more (use --verbose to see all)${colors.reset}`
      );
    }
    console.log('');
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log(
      `${colors.yellow}${colors.bold}⚠ ${warnings.length} inconsistent key(s):${colors.reset}`
    );
    const displayWarnings = verbose ? warnings : warnings.slice(0, 5);
    for (const warning of displayWarnings) {
      console.log(
        `  ${colors.yellow}•${colors.reset} [${warning.locale}] ${warning.key}`
      );
    }
    if (!verbose && warnings.length > 5) {
      console.log(
        `  ${colors.dim}... and ${warnings.length - 5} more (use --verbose to see all)${colors.reset}`
      );
    }
    console.log('');
  }

  // Final status
  if (result.success && warnings.length === 0) {
    console.log(
      `${colors.green}${colors.bold}✓ All translations are complete!${colors.reset}\n`
    );
  } else if (result.success) {
    console.log(
      `${colors.yellow}${colors.bold}⚠ No missing keys, but some inconsistencies found${colors.reset}\n`
    );
  } else {
    console.log(
      `${colors.red}${colors.bold}✗ Validation failed - missing translations detected${colors.reset}\n`
    );
  }
}

/**
 * Add missing keys to translation files (stub values)
 */
function fixMissingKeys(errors: ValidationError[]): void {
  console.log(`\n${colors.cyan}Attempting to fix missing keys...${colors.reset}\n`);

  // Group errors by locale
  const errorsByLocale = new Map<string, ValidationError[]>();
  for (const error of errors) {
    const existing = errorsByLocale.get(error.locale) || [];
    existing.push(error);
    errorsByLocale.set(error.locale, existing);
  }

  for (const [locale, localeErrors] of errorsByLocale) {
    // Load current common.json (or create new structure)
    const commonPath = path.join(CONFIG.localesDir, locale, 'common.json');
    let translations: Record<string, unknown> = {};

    if (fs.existsSync(commonPath)) {
      translations = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
    }

    // Add missing keys with TODO markers
    for (const error of localeErrors) {
      const parts = error.key.split('.');
      let current = translations;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      if (current[lastPart] === undefined) {
        current[lastPart] = `TODO: ${error.key}`;
        console.log(`  ${colors.green}+${colors.reset} [${locale}] ${error.key}`);
      }
    }

    // Write back
    fs.writeFileSync(commonPath, JSON.stringify(translations, null, 2) + '\n');
    console.log(
      `  ${colors.dim}Updated ${commonPath}${colors.reset}`
    );
  }

  console.log(
    `\n${colors.yellow}Note: Stub values added with "TODO:" prefix. Please translate them.${colors.reset}\n`
  );
}

// Main execution
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const fix = args.includes('--fix');
const strict = args.includes('--strict');

const result = validateTranslations(verbose);

// Fix mode
if (fix && result.errors.length > 0) {
  fixMissingKeys(result.errors);
}

// Exit code
if (!result.success) {
  process.exit(1);
} else if (strict && result.warnings.length > 0) {
  console.log(
    `${colors.red}Exiting with error due to --strict mode${colors.reset}`
  );
  process.exit(1);
}

process.exit(0);
