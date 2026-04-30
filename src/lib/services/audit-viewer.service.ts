/**
 * Audit Trail Viewer Service — Phase 9
 *
 * Aggregates audit-trail rows from multiple sources into a unified view.
 * The audit_trail table is updated by the existing auditedInsert/Update/
 * Delete wrapper (DO NOT touch). The QC + COA module also writes specialized
 * audit rows directly to:
 *
 *   - qc_sample_signatures   (analyst → reviewer → approver → qa_release)
 *   - coa_signatures         (approver / qa_release)
 *   - coa_print_history      (every PDF render / email / customer download)
 *   - coa_verify_log         (every public verify-portal hit)
 *   - qc_oos_investigations  (open / classify / close lifecycle events)
 *
 * The viewer joins these into a single time-ordered stream so QA managers,
 * auditors and admins can answer FDA 21 CFR Part 11 §11.10(e) questions like
 * "show me everything that happened to sample X" or "show me every customer
 * verify hit yesterday" without hopping between five tables.
 *
 * Read-only by design. Writes still go through their original code paths.
 */

import { and, desc, eq, gte, lte, like, or, sql } from 'drizzle-orm';
import { executeDbOperation } from '../db/db-helper';
import { isSqlite } from '../db';
import { toDateSafe, toQueryDate } from '../db/date-utils';
import {
  // SQLite
  sqliteAuditTrail,
  sqliteUsers,
  sqliteQcSampleSignatures,
  sqliteQcOosInvestigations,
  sqliteQcSamples,
  sqliteQcSampleTests,
  sqliteCoaSignatures,
  sqliteCoaPrintHistory,
  sqliteCoaVerifyLog,
  sqliteCoaDocuments,
  // MySQL
  mysqlAuditTrail,
  mysqlUsers,
  mysqlQcSampleSignatures,
  mysqlQcOosInvestigations,
  mysqlQcSamples,
  mysqlQcSampleTests,
  mysqlCoaSignatures,
  mysqlCoaPrintHistory,
  mysqlCoaVerifyLog,
  mysqlCoaDocuments,
} from '../db/schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AuditEntityType =
  | 'qc_sample'
  | 'coa_document'
  | 'material_return'
  | 'wo_sop_execution'
  | 'other';

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'sign'
  | 'approve'
  | 'release'
  | 'verify'
  | 'print'
  | 'investigate'
  | 'other';

export interface AuditTrailFilters {
  entityType?: AuditEntityType;
  entityId?: number;
  userId?: number;
  actionType?: AuditActionType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  /** Source filter — used to narrow down to a single source table when
   *  embedded in entity detail pages. Not exposed in the main UI. */
  sources?: AuditSource[];
}

export type AuditSource =
  | 'audit_trail'
  | 'qc_sample_signatures'
  | 'coa_signatures'
  | 'coa_print_history'
  | 'coa_verify_log'
  | 'qc_oos_investigations';

export interface AuditTrailRow {
  /** Stable ID composed of source + numeric id so React can key rows. */
  rowKey: string;
  source: AuditSource;
  timestamp: string; // ISO string
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: AuditActionType;
  actionLabel: string;
  entityType: AuditEntityType;
  entityId: number | null;
  entityRef: string | null; // e.g. "QC-2026-00045" or "COA-2026-000123"
  details: string;
  detailsJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditTrailResponse {
  items: AuditTrailRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditKpis {
  totalEventsToday: number;
  signOffsThisWeek: number;
  verifyHitsThisWeek: number;
  failedLoginsThisWeek: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getTables() {
  if (isSqlite()) {
    return {
      audit: sqliteAuditTrail,
      users: sqliteUsers,
      qcSig: sqliteQcSampleSignatures,
      qcOos: sqliteQcOosInvestigations,
      qcSamples: sqliteQcSamples,
      qcSampleTests: sqliteQcSampleTests,
      coaSig: sqliteCoaSignatures,
      coaPrint: sqliteCoaPrintHistory,
      coaVerify: sqliteCoaVerifyLog,
      coa: sqliteCoaDocuments,
    };
  }
  return {
    audit: mysqlAuditTrail,
    users: mysqlUsers,
    qcSig: mysqlQcSampleSignatures,
    qcOos: mysqlQcOosInvestigations,
    qcSamples: mysqlQcSamples,
    qcSampleTests: mysqlQcSampleTests,
    coaSig: mysqlCoaSignatures,
    coaPrint: mysqlCoaPrintHistory,
    coaVerify: mysqlCoaVerifyLog,
    coa: mysqlCoaDocuments,
  };
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  try {
    return toDateSafe(value).toISOString();
  } catch {
    return String(value);
  }
}

function safeJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Map raw audit_trail.action → our normalized actionType. */
function mapAuditAction(raw: string): AuditActionType {
  const v = String(raw || '').toUpperCase();
  if (v === 'CREATE') return 'create';
  if (v === 'UPDATE') return 'update';
  if (v === 'DELETE') return 'delete';
  if (v === 'APPROVE') return 'approve';
  if (v === 'RELEASE') return 'release';
  return 'other';
}

/** Categorize the raw audit_trail.tableName column → our entityType bucket. */
function entityTypeFromTableName(tableName: string | null): AuditEntityType {
  if (!tableName) return 'other';
  const t = String(tableName).toLowerCase();
  if (t.startsWith('qcsamples') || t === 'qcsamples' || t === 'qcsampletests')
    return 'qc_sample';
  if (t.startsWith('coa')) return 'coa_document';
  if (t.startsWith('material') && t.includes('return'))
    return 'material_return';
  if (t.startsWith('wo') || t.includes('workorder')) return 'wo_sop_execution';
  return 'other';
}

/** Format an IP/UA-bearing details string for the unified row. */
function formatDetails(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && String(p).trim()).join(' · ');
}

// ---------------------------------------------------------------------------
// Query: getAuditTrail
// ---------------------------------------------------------------------------

const ALL_SOURCES: AuditSource[] = [
  'audit_trail',
  'qc_sample_signatures',
  'coa_signatures',
  'coa_print_history',
  'coa_verify_log',
  'qc_oos_investigations',
];

export async function getAuditTrail(
  filters: AuditTrailFilters = {},
): Promise<AuditTrailResponse> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 50;

    const sourcesToQuery =
      filters.sources && filters.sources.length > 0
        ? filters.sources
        : ALL_SOURCES;

    const dateFromSql = filters.dateFrom
      ? toQueryDate(filters.dateFrom)
      : null;
    const dateToSql = filters.dateTo ? toQueryDate(filters.dateTo) : null;

    const allRows: AuditTrailRow[] = [];

    // ----- Source 1: audit_trail (generic CREATE/UPDATE/DELETE/etc.) -----
    if (sourcesToQuery.includes('audit_trail')) {
      const conds: any[] = [];
      if (filters.userId)
        conds.push(eq(tables.audit.userId, filters.userId));
      if (filters.entityId)
        conds.push(eq(tables.audit.recordId, filters.entityId));
      if (filters.dateFrom)
        conds.push(gte(tables.audit.createdAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.audit.createdAt, dateToSql as any));
      if (filters.actionType) {
        const map: Record<AuditActionType, string[]> = {
          create: ['CREATE'],
          update: ['UPDATE'],
          delete: ['DELETE'],
          approve: ['APPROVE'],
          release: ['RELEASE'],
          sign: [],
          verify: [],
          print: [],
          investigate: [],
          other: [],
        };
        const accepted = map[filters.actionType];
        if (accepted.length > 0) {
          conds.push(
            or(...accepted.map((a) => eq(tables.audit.action, a as any))),
          );
        } else if (
          filters.actionType !== 'other'
        ) {
          // Caller asked for sign/verify/print/investigate — those don't exist
          // in audit_trail. Skip this source entirely.
          conds.push(sql`1 = 0`);
        }
      }
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.audit.tableName, q),
            like(tables.audit.action, q),
            like(tables.audit.oldValue, q),
            like(tables.audit.newValue, q),
          ),
        );
      }
      if (filters.entityType && filters.entityType !== 'other') {
        // entityType filter — match table name prefix
        const prefixMap: Record<AuditEntityType, string> = {
          qc_sample: 'qcSample',
          coa_document: 'coa',
          material_return: 'materialReturn',
          wo_sop_execution: 'wo',
          other: '',
        };
        const prefix = prefixMap[filters.entityType];
        if (prefix) {
          conds.push(like(tables.audit.tableName, `${prefix}%`));
        }
      }

      let q = db
        .select({
          id: tables.audit.id,
          userId: tables.audit.userId,
          userName: tables.users.name,
          userRole: tables.users.role,
          action: tables.audit.action,
          tableName: tables.audit.tableName,
          recordId: tables.audit.recordId,
          oldValue: tables.audit.oldValue,
          newValue: tables.audit.newValue,
          ipAddress: tables.audit.ipAddress,
          createdAt: tables.audit.createdAt,
        })
        .from(tables.audit)
        .leftJoin(tables.users, eq(tables.audit.userId, tables.users.id));
      if (conds.length > 0) q = q.where(and(...conds));
      const rows = await q.orderBy(desc(tables.audit.id)).limit(limit * 4); // overfetch — final cut after merge

      for (const r of rows as any[]) {
        const action = mapAuditAction(String(r.action));
        const entType = entityTypeFromTableName(r.tableName);
        if (filters.entityType && entType !== filters.entityType) continue;
        const oldVal = safeJson(r.oldValue);
        const newVal = safeJson(r.newValue);
        const details = formatDetails([
          r.tableName ? `table=${r.tableName}` : null,
          r.recordId ? `id=${r.recordId}` : null,
        ]);
        allRows.push({
          rowKey: `audit-${r.id}`,
          source: 'audit_trail',
          timestamp: toIso(r.createdAt),
          userId: r.userId != null ? Number(r.userId) : null,
          userName: r.userName ?? null,
          userRole: r.userRole ?? null,
          action,
          actionLabel: String(r.action || '').toLowerCase(),
          entityType: entType,
          entityId: r.recordId != null ? Number(r.recordId) : null,
          entityRef: r.tableName ? `${r.tableName}#${r.recordId ?? '—'}` : null,
          details,
          detailsJson: { old: oldVal, new: newVal },
          ipAddress: r.ipAddress ?? null,
          userAgent: null,
        });
      }
    }

    // ----- Source 2: qc_sample_signatures -----
    if (
      sourcesToQuery.includes('qc_sample_signatures') &&
      (!filters.entityType || filters.entityType === 'qc_sample') &&
      (!filters.actionType ||
        filters.actionType === 'sign' ||
        filters.actionType === 'approve' ||
        filters.actionType === 'release' ||
        filters.actionType === 'other')
    ) {
      const conds: any[] = [];
      if (filters.userId) conds.push(eq(tables.qcSig.userId, filters.userId));
      if (filters.entityId)
        conds.push(eq(tables.qcSig.sampleId, filters.entityId));
      if (filters.dateFrom)
        conds.push(gte(tables.qcSig.signedAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.qcSig.signedAt, dateToSql as any));
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.qcSig.role, q),
            like(tables.qcSig.signatureMeaning, q),
            like(tables.qcSig.notes, q),
          ),
        );
      }

      let q = db
        .select({
          id: tables.qcSig.id,
          sampleId: tables.qcSig.sampleId,
          sampleNumber: tables.qcSamples.sampleNumber,
          role: tables.qcSig.role,
          userId: tables.qcSig.userId,
          userName: tables.users.name,
          userRole: tables.users.role,
          signedAt: tables.qcSig.signedAt,
          signatureMeaning: tables.qcSig.signatureMeaning,
          notes: tables.qcSig.notes,
          ipAddress: tables.qcSig.ipAddress,
          userAgent: tables.qcSig.userAgent,
        })
        .from(tables.qcSig)
        .leftJoin(tables.users, eq(tables.qcSig.userId, tables.users.id))
        .leftJoin(tables.qcSamples, eq(tables.qcSig.sampleId, tables.qcSamples.id));
      if (conds.length > 0) q = q.where(and(...conds));
      const rows = await q.orderBy(desc(tables.qcSig.id)).limit(limit * 4);

      for (const r of rows as any[]) {
        const role = String(r.role || '');
        const action: AuditActionType =
          role === 'qa_release'
            ? 'release'
            : role === 'approver'
              ? 'approve'
              : 'sign';
        if (filters.actionType && filters.actionType !== action && filters.actionType !== 'other')
          continue;
        allRows.push({
          rowKey: `qcsig-${r.id}`,
          source: 'qc_sample_signatures',
          timestamp: toIso(r.signedAt),
          userId: r.userId != null ? Number(r.userId) : null,
          userName: r.userName ?? null,
          userRole: r.userRole ?? null,
          action,
          actionLabel: `sign:${role}`,
          entityType: 'qc_sample',
          entityId: r.sampleId != null ? Number(r.sampleId) : null,
          entityRef: r.sampleNumber ?? `qc_sample#${r.sampleId}`,
          details: formatDetails([
            `role=${role}`,
            r.signatureMeaning ? `meaning="${r.signatureMeaning}"` : null,
            r.notes ? `notes="${String(r.notes).slice(0, 80)}"` : null,
          ]),
          detailsJson: {
            role,
            signatureMeaning: r.signatureMeaning,
            notes: r.notes,
          },
          ipAddress: r.ipAddress ?? null,
          userAgent: r.userAgent ?? null,
        });
      }
    }

    // ----- Source 3: coa_signatures -----
    if (
      sourcesToQuery.includes('coa_signatures') &&
      (!filters.entityType || filters.entityType === 'coa_document') &&
      (!filters.actionType ||
        filters.actionType === 'sign' ||
        filters.actionType === 'approve' ||
        filters.actionType === 'release' ||
        filters.actionType === 'other')
    ) {
      const conds: any[] = [];
      if (filters.userId) conds.push(eq(tables.coaSig.userId, filters.userId));
      if (filters.entityId)
        conds.push(eq(tables.coaSig.coaId, filters.entityId));
      if (filters.dateFrom)
        conds.push(gte(tables.coaSig.signedAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.coaSig.signedAt, dateToSql as any));
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.coaSig.role, q),
            like(tables.coaSig.signatureMeaning, q),
            like(tables.coaSig.userNameSnapshot, q),
          ),
        );
      }

      let q = db
        .select({
          id: tables.coaSig.id,
          coaId: tables.coaSig.coaId,
          coaNumber: tables.coa.coaNumber,
          role: tables.coaSig.role,
          userId: tables.coaSig.userId,
          userName: tables.users.name,
          userRole: tables.users.role,
          userNameSnapshot: tables.coaSig.userNameSnapshot,
          userTitleSnapshot: tables.coaSig.userTitleSnapshot,
          signedAt: tables.coaSig.signedAt,
          signatureMeaning: tables.coaSig.signatureMeaning,
          ipAddress: tables.coaSig.ipAddress,
        })
        .from(tables.coaSig)
        .leftJoin(tables.users, eq(tables.coaSig.userId, tables.users.id))
        .leftJoin(tables.coa, eq(tables.coaSig.coaId, tables.coa.id));
      if (conds.length > 0) q = q.where(and(...conds));
      const rows = await q.orderBy(desc(tables.coaSig.id)).limit(limit * 4);

      for (const r of rows as any[]) {
        const role = String(r.role || '');
        const action: AuditActionType =
          role === 'qa_release'
            ? 'release'
            : role === 'approver' || role === 'qa_manager'
              ? 'approve'
              : 'sign';
        if (filters.actionType && filters.actionType !== action && filters.actionType !== 'other')
          continue;
        allRows.push({
          rowKey: `coasig-${r.id}`,
          source: 'coa_signatures',
          timestamp: toIso(r.signedAt),
          userId: r.userId != null ? Number(r.userId) : null,
          userName: r.userName ?? r.userNameSnapshot ?? null,
          userRole: r.userRole ?? null,
          action,
          actionLabel: `sign:${role}`,
          entityType: 'coa_document',
          entityId: r.coaId != null ? Number(r.coaId) : null,
          entityRef: r.coaNumber ?? `coa#${r.coaId}`,
          details: formatDetails([
            `role=${role}`,
            r.signatureMeaning ? `meaning="${r.signatureMeaning}"` : null,
            r.userTitleSnapshot ? `title="${r.userTitleSnapshot}"` : null,
          ]),
          detailsJson: {
            role,
            signatureMeaning: r.signatureMeaning,
            userTitle: r.userTitleSnapshot,
          },
          ipAddress: r.ipAddress ?? null,
          userAgent: null,
        });
      }
    }

    // ----- Source 4: coa_print_history -----
    if (
      sourcesToQuery.includes('coa_print_history') &&
      (!filters.entityType || filters.entityType === 'coa_document') &&
      (!filters.actionType ||
        filters.actionType === 'print' ||
        filters.actionType === 'other')
    ) {
      const conds: any[] = [];
      if (filters.userId)
        conds.push(eq(tables.coaPrint.printedBy, filters.userId));
      if (filters.entityId)
        conds.push(eq(tables.coaPrint.coaId, filters.entityId));
      if (filters.dateFrom)
        conds.push(gte(tables.coaPrint.printedAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.coaPrint.printedAt, dateToSql as any));
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.coaPrint.printType, q),
            like(tables.coaPrint.customerEmail, q),
          ),
        );
      }

      let q = db
        .select({
          id: tables.coaPrint.id,
          coaId: tables.coaPrint.coaId,
          coaNumber: tables.coa.coaNumber,
          printedBy: tables.coaPrint.printedBy,
          userName: tables.users.name,
          userRole: tables.users.role,
          printedAt: tables.coaPrint.printedAt,
          printType: tables.coaPrint.printType,
          customerEmail: tables.coaPrint.customerEmail,
          ipAddress: tables.coaPrint.ipAddress,
        })
        .from(tables.coaPrint)
        .leftJoin(tables.users, eq(tables.coaPrint.printedBy, tables.users.id))
        .leftJoin(tables.coa, eq(tables.coaPrint.coaId, tables.coa.id));
      if (conds.length > 0) q = q.where(and(...conds));
      const rows = await q
        .orderBy(desc(tables.coaPrint.id))
        .limit(limit * 4);

      for (const r of rows as any[]) {
        allRows.push({
          rowKey: `coaprint-${r.id}`,
          source: 'coa_print_history',
          timestamp: toIso(r.printedAt),
          userId: r.printedBy != null ? Number(r.printedBy) : null,
          userName: r.userName ?? null,
          userRole: r.userRole ?? null,
          action: 'print',
          actionLabel: `print:${r.printType}`,
          entityType: 'coa_document',
          entityId: r.coaId != null ? Number(r.coaId) : null,
          entityRef: r.coaNumber ?? `coa#${r.coaId}`,
          details: formatDetails([
            `type=${r.printType}`,
            r.customerEmail ? `to="${r.customerEmail}"` : null,
          ]),
          detailsJson: {
            printType: r.printType,
            customerEmail: r.customerEmail,
          },
          ipAddress: r.ipAddress ?? null,
          userAgent: null,
        });
      }
    }

    // ----- Source 5: coa_verify_log (public verify hits) -----
    if (
      sourcesToQuery.includes('coa_verify_log') &&
      (!filters.entityType || filters.entityType === 'coa_document') &&
      (!filters.actionType ||
        filters.actionType === 'verify' ||
        filters.actionType === 'other')
    ) {
      const conds: any[] = [];
      if (filters.entityId)
        conds.push(eq(tables.coaVerify.coaId, filters.entityId));
      if (filters.dateFrom)
        conds.push(gte(tables.coaVerify.verifiedAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.coaVerify.verifiedAt, dateToSql as any));
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.coaVerify.ipAddress, q),
            like(tables.coaVerify.userAgent, q),
            like(tables.coaVerify.referer, q),
            like(tables.coaVerify.qrTokenAttempted, q),
          ),
        );
      }

      let q = db
        .select({
          id: tables.coaVerify.id,
          coaId: tables.coaVerify.coaId,
          coaNumber: tables.coa.coaNumber,
          qrTokenAttempted: tables.coaVerify.qrTokenAttempted,
          ipAddress: tables.coaVerify.ipAddress,
          userAgent: tables.coaVerify.userAgent,
          referer: tables.coaVerify.referer,
          result: tables.coaVerify.result,
          verifiedAt: tables.coaVerify.verifiedAt,
        })
        .from(tables.coaVerify)
        .leftJoin(tables.coa, eq(tables.coaVerify.coaId, tables.coa.id));
      if (conds.length > 0) q = q.where(and(...conds));
      const rows = await q
        .orderBy(desc(tables.coaVerify.id))
        .limit(limit * 4);

      for (const r of rows as any[]) {
        allRows.push({
          rowKey: `coaverify-${r.id}`,
          source: 'coa_verify_log',
          timestamp: toIso(r.verifiedAt),
          userId: null,
          userName: 'Public visitor',
          userRole: 'public',
          action: 'verify',
          actionLabel: `verify:${r.result}`,
          entityType: 'coa_document',
          entityId: r.coaId != null ? Number(r.coaId) : null,
          entityRef: r.coaNumber ?? (r.coaId ? `coa#${r.coaId}` : 'unknown'),
          details: formatDetails([
            `result=${r.result}`,
            r.referer ? `referer="${String(r.referer).slice(0, 80)}"` : null,
            r.qrTokenAttempted
              ? `token=${String(r.qrTokenAttempted).slice(0, 8)}…`
              : null,
          ]),
          detailsJson: {
            result: r.result,
            referer: r.referer,
            tokenSuffix: r.qrTokenAttempted
              ? String(r.qrTokenAttempted).slice(-6)
              : null,
          },
          ipAddress: r.ipAddress ?? null,
          userAgent: r.userAgent ?? null,
        });
      }
    }

    // ----- Source 6: qc_oos_investigations -----
    if (
      sourcesToQuery.includes('qc_oos_investigations') &&
      (!filters.entityType || filters.entityType === 'qc_sample') &&
      (!filters.actionType ||
        filters.actionType === 'investigate' ||
        filters.actionType === 'other')
    ) {
      const conds: any[] = [];
      if (filters.userId)
        conds.push(
          or(
            eq(tables.qcOos.initiatedBy, filters.userId),
            eq(tables.qcOos.closedBy, filters.userId),
          ),
        );
      if (filters.dateFrom)
        conds.push(gte(tables.qcOos.initiatedAt, dateFromSql as any));
      if (filters.dateTo)
        conds.push(lte(tables.qcOos.initiatedAt, dateToSql as any));
      if (filters.search) {
        const q = `%${filters.search}%`;
        conds.push(
          or(
            like(tables.qcOos.classification, q),
            like(tables.qcOos.conclusion, q),
            like(tables.qcOos.phase1LabErrorCheck, q),
            like(tables.qcOos.phase2RootCause, q),
          ),
        );
      }

      let q = db
        .select({
          id: tables.qcOos.id,
          sampleTestId: tables.qcOos.sampleTestId,
          sampleId: tables.qcSampleTests.sampleId,
          sampleNumber: tables.qcSamples.sampleNumber,
          initiatedBy: tables.qcOos.initiatedBy,
          initiatedByName: tables.users.name,
          initiatedByRole: tables.users.role,
          initiatedAt: tables.qcOos.initiatedAt,
          classification: tables.qcOos.classification,
          retestAuthorized: tables.qcOos.retestAuthorized,
          closedBy: tables.qcOos.closedBy,
          closedAt: tables.qcOos.closedAt,
          conclusion: tables.qcOos.conclusion,
        })
        .from(tables.qcOos)
        .leftJoin(
          tables.qcSampleTests,
          eq(tables.qcOos.sampleTestId, tables.qcSampleTests.id),
        )
        .leftJoin(
          tables.qcSamples,
          eq(tables.qcSampleTests.sampleId, tables.qcSamples.id),
        )
        .leftJoin(tables.users, eq(tables.qcOos.initiatedBy, tables.users.id));
      if (conds.length > 0) q = q.where(and(...conds));
      // Filter by sample id if entityId is provided AND entityType is qc_sample
      const rows = await q.orderBy(desc(tables.qcOos.id)).limit(limit * 4);

      for (const r of rows as any[]) {
        // entityId filter with entityType='qc_sample' is by sampleId
        if (
          filters.entityId &&
          filters.entityType === 'qc_sample' &&
          Number(r.sampleId) !== filters.entityId
        ) {
          continue;
        }
        allRows.push({
          rowKey: `oos-open-${r.id}`,
          source: 'qc_oos_investigations',
          timestamp: toIso(r.initiatedAt),
          userId: r.initiatedBy != null ? Number(r.initiatedBy) : null,
          userName: r.initiatedByName ?? null,
          userRole: r.initiatedByRole ?? null,
          action: 'investigate',
          actionLabel: 'oos:open',
          entityType: 'qc_sample',
          entityId: r.sampleId != null ? Number(r.sampleId) : null,
          entityRef: r.sampleNumber ?? `qc_sample#${r.sampleId}`,
          details: formatDetails([
            `oos #${r.id}`,
            r.classification ? `classification=${r.classification}` : null,
            r.retestAuthorized ? `retest authorized` : null,
          ]),
          detailsJson: {
            oosId: r.id,
            classification: r.classification,
            retestAuthorized: !!r.retestAuthorized,
          },
          ipAddress: null,
          userAgent: null,
        });
        if (r.closedAt) {
          allRows.push({
            rowKey: `oos-close-${r.id}`,
            source: 'qc_oos_investigations',
            timestamp: toIso(r.closedAt),
            userId: r.closedBy != null ? Number(r.closedBy) : null,
            userName: null,
            userRole: null,
            action: 'investigate',
            actionLabel: 'oos:close',
            entityType: 'qc_sample',
            entityId: r.sampleId != null ? Number(r.sampleId) : null,
            entityRef: r.sampleNumber ?? `qc_sample#${r.sampleId}`,
            details: formatDetails([
              `oos #${r.id} closed`,
              r.conclusion
                ? `conclusion="${String(r.conclusion).slice(0, 60)}…"`
                : null,
            ]),
            detailsJson: {
              oosId: r.id,
              conclusion: r.conclusion,
            },
            ipAddress: null,
            userAgent: null,
          });
        }
      }
    }

    // ----- Merge, sort, paginate -----
    allRows.sort((a, b) => {
      // Most recent first
      if (a.timestamp === b.timestamp) return 0;
      return a.timestamp < b.timestamp ? 1 : -1;
    });
    const total = allRows.length;
    const start = (page - 1) * limit;
    const items = allRows.slice(start, start + limit);

    return { items, total, page, limit };
  });
}

// ---------------------------------------------------------------------------
// Convenience: per-entity audit trail for embedded viewers
// ---------------------------------------------------------------------------

export async function getEntityAuditTrail(
  entityType: AuditEntityType,
  entityId: number,
  options: { limit?: number } = {},
): Promise<AuditTrailResponse> {
  return getAuditTrail({
    entityType,
    entityId,
    limit: options.limit ?? 200,
    page: 1,
  });
}

// ---------------------------------------------------------------------------
// KPIs for the audit-viewer dashboard
// ---------------------------------------------------------------------------

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Roll back to Sunday-of-the-current-week
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d.toISOString();
}

export async function getAuditKpis(): Promise<AuditKpis> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const todayIso = startOfTodayIso();
    const weekIso = startOfWeekIso();
    const todaySql = toQueryDate(todayIso);
    const weekSql = toQueryDate(weekIso);

    // 1. Total events today — sum across audit_trail + signatures + prints + verify + oos
    const [auditTodayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.audit)
      .where(gte(tables.audit.createdAt, todaySql as any));
    const [qcSigTodayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.qcSig)
      .where(gte(tables.qcSig.signedAt, todaySql as any));
    const [coaSigTodayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.coaSig)
      .where(gte(tables.coaSig.signedAt, todaySql as any));
    const [coaPrintTodayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.coaPrint)
      .where(gte(tables.coaPrint.printedAt, todaySql as any));
    const [coaVerifyTodayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.coaVerify)
      .where(gte(tables.coaVerify.verifiedAt, todaySql as any));
    const totalEventsToday =
      Number((auditTodayRow as any)?.n ?? 0) +
      Number((qcSigTodayRow as any)?.n ?? 0) +
      Number((coaSigTodayRow as any)?.n ?? 0) +
      Number((coaPrintTodayRow as any)?.n ?? 0) +
      Number((coaVerifyTodayRow as any)?.n ?? 0);

    // 2. Sign-offs this week — qc_sample_signatures + coa_signatures
    const [qcSigWeekRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.qcSig)
      .where(gte(tables.qcSig.signedAt, weekSql as any));
    const [coaSigWeekRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.coaSig)
      .where(gte(tables.coaSig.signedAt, weekSql as any));
    const signOffsThisWeek =
      Number((qcSigWeekRow as any)?.n ?? 0) +
      Number((coaSigWeekRow as any)?.n ?? 0);

    // 3. Verify hits this week
    const [verifyWeekRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.coaVerify)
      .where(gte(tables.coaVerify.verifiedAt, weekSql as any));
    const verifyHitsThisWeek = Number((verifyWeekRow as any)?.n ?? 0);

    // 4. Failed login attempts — audit_trail.action = 'LOGIN_FAILED' (best-
    //    effort; most projects track logins with just LOGIN). If never logged,
    //    returns 0.
    let failedLoginsThisWeek = 0;
    try {
      const [loginFailRow] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(tables.audit)
        .where(
          and(
            gte(tables.audit.createdAt, weekSql as any),
            eq(tables.audit.action, 'LOGIN_FAILED' as any),
          ),
        );
      failedLoginsThisWeek = Number((loginFailRow as any)?.n ?? 0);
    } catch {
      failedLoginsThisWeek = 0;
    }

    return {
      totalEventsToday,
      signOffsThisWeek,
      verifyHitsThisWeek,
      failedLoginsThisWeek,
    };
  });
}
