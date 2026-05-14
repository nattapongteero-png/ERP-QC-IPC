/**
 * Integration Tests: GMP Pages i18n
 *
 * Regression context: several GMP pages (documents, capa, complaints, recalls,
 * sanitation, internal-audit, stability) had hardcoded English labels for
 * DataGrid column headers, StatCard labels, buttons, and placeholders. This
 * file asserts every translation key used in code exists in BOTH locale JSON
 * files and that values diverge between Thai and English.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import thGmp from '../../src/locales/th/gmp.json';
import enGmp from '../../src/locales/en/gmp.json';

function resolveKey(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

describe('GMP — common shared keys (regression)', () => {
  const keys = ['common.clearFilters', 'common.cancel', 'common.close', 'common.refresh', 'common.actions'];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en).toBeDefined();
    expect(th).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — documents page keys', () => {
  const keys = [
    'documents.stats.total',
    'documents.stats.active',
    'documents.stats.draft',
    'documents.stats.pendingApproval',
    'documents.stats.upForReview',
    'documents.stats.obsoleteArchived',
    'documents.stats.documentTypes',
    'documents.table.columns.documentNumber',
    'documents.table.columns.title',
    'documents.table.columns.type',
    'documents.table.columns.department',
    'documents.table.columns.version',
    'documents.table.columns.status',
    'documents.table.columns.createdBy',
    'documents.table.columns.lastUpdated',
    'documents.table.columns.actions',
    'documents.search.placeholder',
    'documents.charts.statusDistribution',
    'documents.noResultsTitle',
    'documents.noResultsDescription',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — capa page keys', () => {
  const keys = [
    'capa.search.placeholder',
    'capa.table.columns.capaNumber',
    'capa.table.columns.title',
    'capa.table.columns.source',
    'capa.table.columns.type',
    'capa.table.columns.priority',
    'capa.table.columns.status',
    'capa.table.columns.risk',
    'capa.table.columns.actions',
    'capa.table.columns.owner',
    'capa.table.columns.dueDate',
    'capa.table.columns.created',
    'capa.buttons.newCapa',
    'capa.buttons.showAll',
    'capa.empty.title',
    'capa.empty.description',
    'capa.noResults.title',
    'capa.noResults.description',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — complaints page keys', () => {
  const keys = [
    'complaints.status.all',
    'complaints.status.received',
    'complaints.status.under_investigation',
    'complaints.status.resolved',
    'complaints.status.closed',
    'complaints.search.placeholder',
    'complaints.table.columns.complaintNumber',
    'complaints.table.columns.customer',
    'complaints.table.columns.product',
    'complaints.table.columns.severity',
    'complaints.table.columns.status',
    'complaints.table.columns.receivedDate',
    'complaints.table.columns.actions',
    'complaints.empty.title',
    'complaints.empty.description',
    'complaints.noResults.title',
    'complaints.noResults.description',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — recalls page keys', () => {
  const keys = [
    'recalls.buttons.mockDrill',
    'recalls.buttons.viewCritical',
    'recalls.buttons.runMockDrill',
    'recalls.buttons.initiateRecall',
    'recalls.search.placeholder',
    'recalls.search.enterLotId',
    'recalls.empty.title',
    'recalls.empty.description',
    'recalls.noResults.title',
    'recalls.noResults.description',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — sanitation page keys', () => {
  const keys = [
    'sanitation.actions.schedules',
    'sanitation.actions.recordLog',
    'sanitation.actions.viewTasks',
    'sanitation.actions.viewAllLogs',
    'sanitation.actions.record',
    'sanitation.stats.complianceRate',
    'sanitation.stats.completed',
    'sanitation.stats.pending',
    'sanitation.stats.overdue',
    'sanitation.stats.missed',
    'sanitation.stats.pestFindings',
    'sanitation.charts.complianceByArea',
    'sanitation.charts.pestActivity',
    'sanitation.charts.quickSummary',
    'sanitation.charts.complianceTrend',
    'sanitation.charts.overallCompliance',
    'sanitation.charts.thisPeriod',
    'sanitation.quickActions.schedulesTitle',
    'sanitation.quickActions.logsTitle',
    'sanitation.quickActions.pestTitle',
    'sanitation.quickActions.trendsTitle',
    'sanitation.pendingTasks',
    'sanitation.alerts.overdueTasks',
    'sanitation.alerts.overdueAction',
    'sanitation.status.upcoming',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — internal-audit page keys', () => {
  const keys = [
    'internalAudit.actions.refresh',
    'internalAudit.actions.auditPlans',
    'internalAudit.actions.scheduleAudit',
    'internalAudit.actions.clearFilter',
    'internalAudit.stats.totalAudits',
    'internalAudit.stats.inProgress',
    'internalAudit.stats.completed',
    'internalAudit.stats.openFindings',
    'internalAudit.table.columns.auditNumber',
    'internalAudit.table.columns.scope',
    'internalAudit.table.columns.type',
    'internalAudit.table.columns.gmpChapters',
    'internalAudit.table.columns.scheduled',
    'internalAudit.table.columns.leadAuditor',
    'internalAudit.table.columns.status',
    'internalAudit.table.columns.findings',
    'internalAudit.table.columns.actions',
    'internalAudit.search.placeholder',
    'internalAudit.empty.title',
    'internalAudit.noResults.title',
  ];
  it.each(keys)('"%s" present + divergent', (key) => {
    const en = resolveKey(enGmp, key);
    const th = resolveKey(thGmp, key);
    expect(en, `Missing en: ${key}`).toBeDefined();
    expect(th, `Missing th: ${key}`).toBeDefined();
    expect(en).not.toBe(th);
  });
});

describe('GMP — stability page keys (tryDifferentFilter regression)', () => {
  it('tryDifferentFilter present in both locales', () => {
    expect(resolveKey(enGmp, 'stability.studies.tryDifferentFilter')).toBeDefined();
    expect(resolveKey(thGmp, 'stability.studies.tryDifferentFilter')).toBeDefined();
  });
});

describe('Inventory/MasterData — import/template button keys', () => {
  // These tests validate master-data.json + inventory.json additions
  // verified separately in inventory-pages-i18n.test.tsx; here we only
  // spot-check the master-data actions that were missing.
  it('masterData actions.downloadTemplate present in both locales', async () => {
    const enMd = (await import('../../src/locales/en/masterData.json')).default as Record<string, unknown>;
    const thMd = (await import('../../src/locales/th/masterData.json')).default as Record<string, unknown>;
    expect(resolveKey(enMd, 'actions.downloadTemplate')).toBeDefined();
    expect(resolveKey(thMd, 'actions.downloadTemplate')).toBeDefined();
  });
  it('masterData actions.importExcel present in both locales', async () => {
    const enMd = (await import('../../src/locales/en/masterData.json')).default as Record<string, unknown>;
    const thMd = (await import('../../src/locales/th/masterData.json')).default as Record<string, unknown>;
    expect(resolveKey(enMd, 'actions.importExcel')).toBeDefined();
    expect(resolveKey(thMd, 'actions.importExcel')).toBeDefined();
  });
  it('inventory common.downloadTemplate + common.importExcel present in both locales', async () => {
    const enInv = (await import('../../src/locales/en/inventory.json')).default as Record<string, unknown>;
    const thInv = (await import('../../src/locales/th/inventory.json')).default as Record<string, unknown>;
    expect(resolveKey(enInv, 'common.downloadTemplate')).toBeDefined();
    expect(resolveKey(thInv, 'common.downloadTemplate')).toBeDefined();
    expect(resolveKey(enInv, 'common.importExcel')).toBeDefined();
    expect(resolveKey(thInv, 'common.importExcel')).toBeDefined();
  });
});
