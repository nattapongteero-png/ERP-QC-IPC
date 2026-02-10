/**
 * Settings Module i18n Tests
 * Feature: 015-i18n, Phase 10I
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Pages that have been migrated to use next-intl
const SETTINGS_PAGES_MIGRATED = [
  'src/app/settings/page.tsx',
  'src/app/settings/confidentiality/page.tsx',
  'src/app/settings/vmi/page.tsx',
  'src/app/settings/vmi/[id]/page.tsx',
  'src/app/settings/approval-workflows/page.tsx',
  'src/app/settings/matching-tolerances/page.tsx',
];

// All settings pages (including ones not yet migrated)
const SETTINGS_PAGES_ALL = [
  ...SETTINGS_PAGES_MIGRATED,
  'src/app/settings/approval-workflows/new/page.tsx',
  'src/app/settings/approval-workflows/[id]/page.tsx',
  'src/app/settings/approval-workflows/[id]/history/page.tsx',
  'src/app/settings/matching-tolerances/new/page.tsx',
  'src/app/settings/matching-tolerances/[id]/page.tsx',
  'src/app/settings/workflow-test/page.tsx',
];

function readFileContent(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function hasUseTranslationsImport(content: string): boolean {
  return /import\s*{\s*[^}]*useTranslations[^}]*}\s*from\s*['"]next-intl['"]/.test(content);
}

function hasUseTranslationsHook(content: string): boolean {
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]settings['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

describe('Settings Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(SETTINGS_PAGES_MIGRATED)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(SETTINGS_PAGES_MIGRATED)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(SETTINGS_PAGES_MIGRATED)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai settings translations', () => {
      const content = readFileContent('src/locales/th/settings.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English settings translations', () => {
      const content = readFileContent('src/locales/en/settings.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation keys exist', () => {
    it('should have all required translation sections in Thai', () => {
      const content = readFileContent('src/locales/th/settings.json');
      const json = JSON.parse(content);
      expect(json.settingsPage).toBeDefined();
      expect(json.company).toBeDefined();
      expect(json.regulatory).toBeDefined();
      expect(json.prefixes).toBeDefined();
      expect(json.confidentiality).toBeDefined();
      expect(json.securityConfidentiality).toBeDefined();
      expect(json.vmiSettings).toBeDefined();
      expect(json.vmiPortalEdit).toBeDefined();
      expect(json.approvalWorkflows).toBeDefined();
      expect(json.matchingTolerances).toBeDefined();
    });

    it('should have all required translation sections in English', () => {
      const content = readFileContent('src/locales/en/settings.json');
      const json = JSON.parse(content);
      expect(json.settingsPage).toBeDefined();
      expect(json.company).toBeDefined();
      expect(json.regulatory).toBeDefined();
      expect(json.prefixes).toBeDefined();
      expect(json.confidentiality).toBeDefined();
      expect(json.securityConfidentiality).toBeDefined();
      expect(json.vmiSettings).toBeDefined();
      expect(json.vmiPortalEdit).toBeDefined();
      expect(json.approvalWorkflows).toBeDefined();
      expect(json.matchingTolerances).toBeDefined();
    });
  });

  describe('All page files exist', () => {
    it.each(SETTINGS_PAGES_ALL)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
