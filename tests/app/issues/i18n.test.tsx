/**
 * Issues Module i18n Tests
 * Feature: 015-i18n
 *
 * Tests verify Issues dashboard page uses i18n translations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

const ISSUES_PAGES = [
  'src/app/issues/page.tsx',
];

// ============================================
// Helper Functions
// ============================================

function readFileContent(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return '';
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function hasUseTranslationsImport(content: string): boolean {
  return /import\s*{\s*[^}]*useTranslations[^}]*}\s*from\s*['"]next-intl['"]/.test(content);
}

function hasUseTranslationsHook(content: string): boolean {
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]issues['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Issues Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(ISSUES_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(ISSUES_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(ISSUES_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai issues translations', () => {
      const content = readFileContent('src/locales/th/issues.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English issues translations', () => {
      const content = readFileContent('src/locales/en/issues.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required issues translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/issues.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions).toBeDefined();
      expect(translations.actions.viewAll).toBeDefined();
      expect(translations.actions.reportIssue).toBeDefined();
      expect(translations.kpi).toBeDefined();
      expect(translations.kpi.openIssues).toBeDefined();
      expect(translations.kpi.criticalIssues).toBeDefined();
      expect(translations.kpi.resolvedThisWeek).toBeDefined();
      expect(translations.kpi.avgResolutionTime).toBeDefined();
      expect(translations.kpi.days).toBeDefined();
      expect(translations.charts).toBeDefined();
      expect(translations.charts.byStatus).toBeDefined();
      expect(translations.charts.bySeverity).toBeDefined();
      expect(translations.charts.byCategory).toBeDefined();
      expect(translations.recent).toBeDefined();
      expect(translations.recent.title).toBeDefined();
      expect(translations.recent.viewAll).toBeDefined();
      expect(translations.recent.noIssues).toBeDefined();
      expect(translations.quickActions).toBeDefined();
      expect(translations.quickActions.title).toBeDefined();
      expect(translations.quickActions.reportNew).toBeDefined();
      expect(translations.error).toBeDefined();
      expect(translations.error.loadFailed).toBeDefined();
      expect(translations.error.genericError).toBeDefined();
    });

    it('should have required issues translation keys in English', () => {
      const content = readFileContent('src/locales/en/issues.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions).toBeDefined();
      expect(translations.actions.viewAll).toBeDefined();
      expect(translations.actions.reportIssue).toBeDefined();
      expect(translations.kpi).toBeDefined();
      expect(translations.kpi.openIssues).toBeDefined();
      expect(translations.kpi.criticalIssues).toBeDefined();
      expect(translations.kpi.resolvedThisWeek).toBeDefined();
      expect(translations.kpi.avgResolutionTime).toBeDefined();
      expect(translations.kpi.days).toBeDefined();
      expect(translations.charts).toBeDefined();
      expect(translations.charts.byStatus).toBeDefined();
      expect(translations.charts.bySeverity).toBeDefined();
      expect(translations.charts.byCategory).toBeDefined();
      expect(translations.recent).toBeDefined();
      expect(translations.recent.title).toBeDefined();
      expect(translations.recent.viewAll).toBeDefined();
      expect(translations.recent.noIssues).toBeDefined();
      expect(translations.quickActions).toBeDefined();
      expect(translations.quickActions.title).toBeDefined();
      expect(translations.quickActions.reportNew).toBeDefined();
      expect(translations.error).toBeDefined();
      expect(translations.error.loadFailed).toBeDefined();
      expect(translations.error.genericError).toBeDefined();
    });
  });

  describe('No hardcoded strings in dashboard', () => {
    it('should not have hardcoded UI strings in issues dashboard', () => {
      const content = readFileContent('src/app/issues/page.tsx');
      // These strings should now be replaced with t() calls
      expect(content).not.toContain('>Issue Tracker<');
      expect(content).not.toContain('text="View All Issues"');
      expect(content).not.toContain('text="Report Issue"');
      expect(content).not.toContain('label="Open Issues"');
      expect(content).not.toContain('label="Critical Issues"');
      expect(content).not.toContain('>Quick Actions<');
      expect(content).not.toContain('>Recent Issues<');
      expect(content).not.toContain('>Issues by Status<');
      expect(content).not.toContain('>Failed to Load Dashboard<');
    });
  });
});
