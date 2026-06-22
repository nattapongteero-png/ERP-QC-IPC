/**
 * Environmental Inspection Service
 * Feature: 023-environmental-monitoring
 *
 * - Inspection templates CRUD
 * - Inspection schedules with computeNextDue
 * - Record inspections with auto-deviation on out-of-spec
 * - Scan due/overdue → creates F022 notifications
 */
import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { createHash } from 'crypto';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate } from '../db/date-utils';
import { createAuditLog } from '../audit';
import {
  EnvMonitorError,
  ENV_MONITOR_ERROR_CODES,
  computeNextDue,
  evaluateResult,
  type InspectionFrequency,
  type InspectionTargetType,
  type InspectionTemplate,
  type InspectionTemplateItem,
  type InspectionRecord,
  type ResultStatus,
} from '@/types/environmental-monitoring';

function getTables() {
  return {
    templates: getTableRef('inspectionTemplates'),
    schedules: getTableRef('inspectionSchedules'),
    records: getTableRef('inspectionRecords'),
    results: getTableRef('inspectionResults'),
    signatures: getTableRef('electronicSignatures'),
    deviations: getTableRef('deviations'),
    users: getTableRef('users'),
  };
}

// ============================================
// Templates
// ============================================

export async function listTemplates(includeInactive = false): Promise<InspectionTemplate[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = includeInactive
      ? await db.select().from(t.templates)
      : await db.select().from(t.templates).where(eq(t.templates.isActive, true));
    return rows.map(normalizeTemplate);
  });
}

export async function getTemplate(id: number): Promise<InspectionTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db.select().from(t.templates).where(eq(t.templates.id, id)).limit(1);
    if (rows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.TEMPLATE_NOT_FOUND, 'Template not found');
    return normalizeTemplate(rows[0]);
  });
}

export async function createTemplate(
  input: {
    name: string;
    description?: string | null;
    targetType: InspectionTargetType;
    items: Array<{
      label: string;
      parameter: string;
      unit?: string | null;
      specMin?: number | null;
      specMax?: number | null;
      specText?: string | null;
      isMandatory: boolean;
      sortOrder: number;
    }>;
  },
  userId: number,
): Promise<InspectionTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const itemsWithIds: InspectionTemplateItem[] = input.items.map((it, idx) => ({
      id: idx + 1,
      label: it.label,
      parameter: it.parameter,
      unit: it.unit ?? null,
      specMin: it.specMin ?? null,
      specMax: it.specMax ?? null,
      specText: it.specText ?? null,
      isMandatory: it.isMandatory,
      sortOrder: it.sortOrder,
    }));

    const ins = await db.insert(t.templates).values({
      name: input.name,
      description: input.description ?? null,
      targetType: input.targetType,
      itemsJson: JSON.stringify(itemsWithIds),
      isActive: true,
      createdByUserId: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.templates).where(eq(t.templates.id, id)).limit(1);
    return normalizeTemplate(fresh[0]);
  });
}

// ============================================
// Schedules
// ============================================

export async function listSchedules(): Promise<Array<{
  id: number;
  targetType: string;
  targetId: number;
  targetName: string;
  templateId: number;
  templateName: string | null;
  frequency: string;
  nextDue: string;
  lastDone: string | null;
  alertDaysBefore: number;
  isActive: boolean;
}>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select({
        id: t.schedules.id,
        targetType: t.schedules.targetType,
        targetId: t.schedules.targetId,
        targetName: t.schedules.targetName,
        templateId: t.schedules.templateId,
        templateName: t.templates.name,
        frequency: t.schedules.frequency,
        nextDue: t.schedules.nextDue,
        lastDone: t.schedules.lastDone,
        alertDaysBefore: t.schedules.alertDaysBefore,
        isActive: t.schedules.isActive,
      })
      .from(t.schedules)
      .leftJoin(t.templates, eq(t.templates.id, t.schedules.templateId))
      .orderBy(t.schedules.nextDue);
    return rows.map((r: any) => ({
      ...r,
      id: Number(r.id),
      targetId: Number(r.targetId),
      templateId: Number(r.templateId),
      alertDaysBefore: Number(r.alertDaysBefore),
      isActive: Boolean(r.isActive),
      nextDue: String(r.nextDue),
      lastDone: r.lastDone ? String(r.lastDone) : null,
    }));
  });
}

export async function createSchedule(input: {
  targetType: InspectionTargetType;
  targetId: number;
  targetName: string;
  templateId: number;
  frequency: InspectionFrequency;
  alertDaysBefore?: number;
}): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    // MySQL datetime needs a Date object; SQLite needs an ISO string.
    // toDbDate() returns the right type for each (matches the record path).
    const nextDue = toDbDate(computeNextDue(input.frequency));
    const ins = await db.insert(t.schedules).values({
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: input.targetName,
      templateId: input.templateId,
      frequency: input.frequency,
      nextDue,
      alertDaysBefore: input.alertDaysBefore ?? 1,
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return { id: getInsertId(ins) };
  });
}

// ============================================
// Record an inspection
// ============================================

export interface RecordInspectionInput {
  scheduleId?: number | null;
  templateId: number;
  targetType: InspectionTargetType;
  targetId: number;
  results: Array<{
    templateItemId: number;
    parameter: string;
    numericValue?: number | null;
    textValue?: string | null;
    remarks?: string | null;
  }>;
  notes?: string | null;
  signature: { password?: string; pin?: string };
}

export interface RecordInspectionResult {
  inspectionId: number;
  overallResult: ResultStatus;
  outOfSpecCount: number;
  deviationId: number | null;
}

export async function recordInspection(
  input: RecordInspectionInput,
  userId: number,
): Promise<RecordInspectionResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Load template + items
    const tplRows = await db.select().from(t.templates).where(eq(t.templates.id, input.templateId)).limit(1);
    if (tplRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.TEMPLATE_NOT_FOUND, 'Template not found');
    const templateItems = parseItemsJson(tplRows[0].itemsJson);
    const itemsById = new Map(templateItems.map((it) => [it.id, it]));

    // Validate mandatory items present
    const missing = templateItems
      .filter((it) => it.isMandatory)
      .filter((it) => !input.results.some((r) => r.templateItemId === it.id));
    if (missing.length > 0)
      throw new EnvMonitorError(
        ENV_MONITOR_ERROR_CODES.TEMPLATE_INCOMPLETE,
        'Mandatory items missing',
        { missing: missing.map((m) => m.id) },
      );

    // Load user
    const userRows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
    if (userRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.NOT_FOUND, 'User not found');
    const user = userRows[0];

    // Signature
    const sigHash = createHash('sha256')
      .update(`env-inspect|${userId}|${input.templateId}|${input.targetId}|${Date.now()}`)
      .digest('hex');
    const sigIns = await db.insert(t.signatures).values({
      entityType: 'env_inspection',
      entityId: 0,
      action: 'perform',
      userId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `Operator performed environmental inspection on ${input.targetType} #${input.targetId}`,
      passwordVerified: Boolean(input.signature.password),
      signatureHash: sigHash,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigIns);

    // Insert inspection record (overallResult computed below)
    let outOfSpecCount = 0;
    const evaluatedResults: Array<{
      templateItemId: number;
      parameter: string;
      numericValue: number | null;
      textValue: string | null;
      specMinSnapshot: number | null;
      specMaxSnapshot: number | null;
      result: ResultStatus;
      remarks: string | null;
    }> = [];

    for (const r of input.results) {
      const item = itemsById.get(r.templateItemId);
      const min = item?.specMin ?? null;
      const max = item?.specMax ?? null;
      const result = evaluateResult(r.numericValue ?? null, min, max);
      if (result === 'out_of_spec') outOfSpecCount++;
      evaluatedResults.push({
        templateItemId: r.templateItemId,
        parameter: r.parameter,
        numericValue: r.numericValue ?? null,
        textValue: r.textValue ?? null,
        specMinSnapshot: min,
        specMaxSnapshot: max,
        result,
        remarks: r.remarks ?? null,
      });
    }

    const overallResult: ResultStatus = outOfSpecCount > 0 ? 'out_of_spec' : 'in_spec';

    const recIns = await db.insert(t.records).values({
      scheduleId: input.scheduleId ?? null,
      templateId: input.templateId,
      templateVersion: 1,
      targetType: input.targetType,
      targetId: input.targetId,
      performedAt: getNow(),
      operatorUserId: userId,
      signatureId,
      status: 'completed',
      overallResult,
      notes: input.notes ?? null,
      createdAt: getNow(),
    });
    const inspectionId = getInsertId(recIns);

    // Update signature entityId
    await db
      .update(t.signatures)
      .set({ entityId: inspectionId })
      .where(eq(t.signatures.id, signatureId));

    // Insert per-item results
    for (const r of evaluatedResults) {
      await db.insert(t.results).values({
        inspectionId,
        templateItemId: r.templateItemId,
        parameter: r.parameter,
        numericValue: r.numericValue,
        textValue: r.textValue,
        specMinSnapshot: r.specMinSnapshot,
        specMaxSnapshot: r.specMaxSnapshot,
        result: r.result,
        remarks: r.remarks,
        createdAt: getNow(),
      });
    }

    // Auto-deviation on out-of-spec
    let deviationId: number | null = null;
    if (outOfSpecCount > 0) {
      try {
        const devNumber = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const devIns = await db.insert(t.deviations).values({
          deviationNumber: devNumber,
          // The deviations table column is `type` (not `deviationType`) —
          // inserting the wrong key made Drizzle throw, which the catch below
          // swallowed, so no deviation was ever created on an out-of-spec result.
          type: 'environmental_out_of_spec',
          sourceType: 'quality',
          sourceId: inspectionId,
          severity: 'major',
          title: `Env inspection out-of-spec on ${input.targetType} #${input.targetId}`,
          description: `${outOfSpecCount} item(s) outside specification. See inspection record #${inspectionId}.`,
          reportedBy: userId,
          reportedAt: getNow(),
          status: 'open',
          createdAt: getNow(),
          updatedAt: getNow(),
        });
        deviationId = getInsertId(devIns);
        await db
          .update(t.records)
          .set({ deviationId })
          .where(eq(t.records.id, inspectionId));
      } catch (err) {
        console.warn('[env-inspection] deviation creation failed', err);
      }

      // Notification (F022)
      try {
        const { createNotification } = await import('./equipment-notification.service');
        await createNotification({
          entityType: 'env_inspection',
          entityId: inspectionId,
          type: 'inspection_due',
          title: `OUT-OF-SPEC env inspection on ${input.targetType} #${input.targetId}`,
          body: `${outOfSpecCount} items out of spec. Deviation: ${deviationId ?? 'pending'}.`,
          severity: 'overdue',
          recipientRole: 'qa',
        });
      } catch (err) {
        console.warn('[env-inspection] notification creation failed', err);
      }
    }

    // Update schedule.lastDone + nextDue if this was a scheduled inspection
    if (input.scheduleId) {
      const schedRows = await db
        .select()
        .from(t.schedules)
        .where(eq(t.schedules.id, input.scheduleId))
        .limit(1);
      if (schedRows.length > 0) {
        const nextDue = computeNextDue(schedRows[0].frequency as InspectionFrequency);
        await db
          .update(t.schedules)
          .set({
            lastDone: getNow(),
            nextDue: toDbDate(nextDue),
            updatedAt: getNow(),
          })
          .where(eq(t.schedules.id, input.scheduleId));
      }
    }

    return {
      inspectionId,
      overallResult,
      outOfSpecCount,
      deviationId,
    };
  });
}

// ============================================
// Inspection records — history / view / edit / delete
// ============================================

export interface InspectionRecordListItem {
  id: number;
  performedAt: string;
  targetType: string;
  targetId: number;
  targetName: string | null;
  templateId: number;
  templateName: string | null;
  operatorUserId: number;
  operatorName: string | null;
  overallResult: string;
  status: string;
  notes: string | null;
  deviationId: number | null;
}

export async function listInspectionRecords(filter?: {
  limit?: number;
}): Promise<InspectionRecordListItem[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select({
        id: t.records.id,
        performedAt: t.records.performedAt,
        targetType: t.records.targetType,
        targetId: t.records.targetId,
        targetName: t.schedules.targetName,
        templateId: t.records.templateId,
        templateName: t.templates.name,
        operatorUserId: t.records.operatorUserId,
        operatorName: t.users.name,
        overallResult: t.records.overallResult,
        status: t.records.status,
        notes: t.records.notes,
        deviationId: t.records.deviationId,
      })
      .from(t.records)
      .leftJoin(t.templates, eq(t.templates.id, t.records.templateId))
      .leftJoin(t.schedules, eq(t.schedules.id, t.records.scheduleId))
      .leftJoin(t.users, eq(t.users.id, t.records.operatorUserId))
      .orderBy(desc(t.records.performedAt))
      .limit(filter?.limit ?? 200);

    return rows.map((r: any) => ({
      id: Number(r.id),
      performedAt: String(r.performedAt),
      targetType: String(r.targetType),
      targetId: Number(r.targetId),
      targetName: r.targetName ?? null,
      templateId: Number(r.templateId),
      templateName: r.templateName ?? null,
      operatorUserId: Number(r.operatorUserId),
      operatorName: r.operatorName ?? null,
      overallResult: String(r.overallResult),
      status: String(r.status),
      notes: r.notes ?? null,
      deviationId: r.deviationId != null ? Number(r.deviationId) : null,
    }));
  });
}

export interface InspectionRecordDetail extends InspectionRecordListItem {
  scheduleId: number | null;
  results: Array<{
    id: number;
    templateItemId: number;
    label: string;
    parameter: string;
    unit: string | null;
    numericValue: number | null;
    textValue: string | null;
    specMinSnapshot: number | null;
    specMaxSnapshot: number | null;
    result: ResultStatus;
    remarks: string | null;
  }>;
}

export async function getInspectionRecord(id: number): Promise<InspectionRecordDetail> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const recRows = await db
      .select({
        id: t.records.id,
        scheduleId: t.records.scheduleId,
        performedAt: t.records.performedAt,
        targetType: t.records.targetType,
        targetId: t.records.targetId,
        targetName: t.schedules.targetName,
        templateId: t.records.templateId,
        templateName: t.templates.name,
        itemsJson: t.templates.itemsJson,
        operatorUserId: t.records.operatorUserId,
        operatorName: t.users.name,
        overallResult: t.records.overallResult,
        status: t.records.status,
        notes: t.records.notes,
        deviationId: t.records.deviationId,
      })
      .from(t.records)
      .leftJoin(t.templates, eq(t.templates.id, t.records.templateId))
      .leftJoin(t.schedules, eq(t.schedules.id, t.records.scheduleId))
      .leftJoin(t.users, eq(t.users.id, t.records.operatorUserId))
      .where(eq(t.records.id, id))
      .limit(1);
    if (recRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.NOT_FOUND, 'Inspection record not found');
    const rec: any = recRows[0];

    const tplItems = parseItemsJson(rec.itemsJson);
    const itemsById = new Map(tplItems.map((it) => [it.id, it]));

    const resRows = await db
      .select()
      .from(t.results)
      .where(eq(t.results.inspectionId, id));

    return {
      id: Number(rec.id),
      scheduleId: rec.scheduleId != null ? Number(rec.scheduleId) : null,
      performedAt: String(rec.performedAt),
      targetType: String(rec.targetType),
      targetId: Number(rec.targetId),
      targetName: rec.targetName ?? null,
      templateId: Number(rec.templateId),
      templateName: rec.templateName ?? null,
      operatorUserId: Number(rec.operatorUserId),
      operatorName: rec.operatorName ?? null,
      overallResult: String(rec.overallResult),
      status: String(rec.status),
      notes: rec.notes ?? null,
      deviationId: rec.deviationId != null ? Number(rec.deviationId) : null,
      results: resRows.map((r: any) => {
        const item = itemsById.get(Number(r.templateItemId));
        return {
          id: Number(r.id),
          templateItemId: Number(r.templateItemId),
          label: item?.label ?? String(r.parameter),
          parameter: String(r.parameter),
          unit: item?.unit ?? null,
          numericValue: r.numericValue != null ? Number(r.numericValue) : null,
          textValue: r.textValue ?? null,
          specMinSnapshot: r.specMinSnapshot != null ? Number(r.specMinSnapshot) : null,
          specMaxSnapshot: r.specMaxSnapshot != null ? Number(r.specMaxSnapshot) : null,
          result: r.result as ResultStatus,
          remarks: r.remarks ?? null,
        };
      }),
    };
  });
}

export interface UpdateInspectionRecordInput {
  notes?: string | null;
  results: Array<{
    id: number; // env_inspection_results.id
    numericValue?: number | null;
    remarks?: string | null;
  }>;
}

/**
 * Edit a recorded inspection (correction). Each result is re-evaluated against
 * its STORED spec snapshot (so corrections stay comparable to the spec that
 * applied at the time), the overall result is recomputed, and the change is
 * written to the audit trail. Signature + deviation history are preserved.
 */
export async function updateInspectionRecord(
  id: number,
  input: UpdateInspectionRecordInput,
  userId: number,
): Promise<{ id: number; overallResult: ResultStatus; outOfSpecCount: number }> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const recRows = await db.select().from(t.records).where(eq(t.records.id, id)).limit(1);
    if (recRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.NOT_FOUND, 'Inspection record not found');
    const before: any = recRows[0];

    const existing = await db.select().from(t.results).where(eq(t.results.inspectionId, id));
    const beforeResults = existing.map((r: any) => ({
      id: Number(r.id),
      numericValue: r.numericValue != null ? Number(r.numericValue) : null,
      result: r.result,
    }));
    const byId = new Map(existing.map((r: any) => [Number(r.id), r]));
    const patchById = new Map(input.results.map((r) => [r.id, r]));

    let outOfSpecCount = 0;
    for (const row of existing as any[]) {
      const rid = Number(row.id);
      const patch = patchById.get(rid);
      const numericValue =
        patch && patch.numericValue !== undefined
          ? patch.numericValue
          : row.numericValue != null
            ? Number(row.numericValue)
            : null;
      const remarks =
        patch && patch.remarks !== undefined ? patch.remarks : (row.remarks ?? null);
      const min = row.specMinSnapshot != null ? Number(row.specMinSnapshot) : null;
      const max = row.specMaxSnapshot != null ? Number(row.specMaxSnapshot) : null;
      const result = evaluateResult(numericValue, min, max);
      if (result === 'out_of_spec') outOfSpecCount++;

      await db
        .update(t.results)
        .set({ numericValue, remarks, result })
        .where(eq(t.results.id, rid));
    }

    const overallResult: ResultStatus = outOfSpecCount > 0 ? 'out_of_spec' : 'in_spec';

    await db
      .update(t.records)
      .set({
        notes: input.notes !== undefined ? input.notes : before.notes,
        overallResult,
      })
      .where(eq(t.records.id, id));

    const afterResults = (await db.select().from(t.results).where(eq(t.results.inspectionId, id))).map(
      (r: any) => ({
        id: Number(r.id),
        numericValue: r.numericValue != null ? Number(r.numericValue) : null,
        result: r.result,
      }),
    );

    await createAuditLog({
      userId,
      action: 'UPDATE',
      tableName: 'inspectionRecords',
      recordId: id,
      oldValue: {
        overallResult: before.overallResult,
        notes: before.notes,
        results: beforeResults,
      } as Record<string, any>,
      newValue: {
        overallResult,
        notes: input.notes !== undefined ? input.notes : before.notes,
        results: afterResults,
      } as Record<string, any>,
    });

    return { id, overallResult, outOfSpecCount };
  });
}

/**
 * Delete a recorded inspection and its per-item results. The deletion is
 * written to the audit trail (full snapshot in oldValue).
 */
export async function deleteInspectionRecord(
  id: number,
  userId: number,
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const recRows = await db.select().from(t.records).where(eq(t.records.id, id)).limit(1);
    if (recRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.NOT_FOUND, 'Inspection record not found');
    const before: any = recRows[0];
    const beforeResults = await db.select().from(t.results).where(eq(t.results.inspectionId, id));

    // Explicit child delete (FK cascade is not enforced uniformly across SQLite/MySQL).
    await db.delete(t.results).where(eq(t.results.inspectionId, id));
    await db.delete(t.records).where(eq(t.records.id, id));

    await createAuditLog({
      userId,
      action: 'DELETE',
      tableName: 'inspectionRecords',
      recordId: id,
      oldValue: { ...before, results: beforeResults } as Record<string, any>,
      newValue: undefined,
    });

    return { id };
  });
}

// ============================================
// Scan due + overdue → notifications
// ============================================

export async function scanDueInspections(): Promise<{
  scanned: number;
  created: number;
  skipped: number;
}> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const now = new Date();

    const schedules = await db
      .select()
      .from(t.schedules)
      .where(eq(t.schedules.isActive, true));

    let created = 0;
    let skipped = 0;
    const { createNotification } = await import('./equipment-notification.service');

    for (const sched of schedules) {
      const due = new Date(sched.nextDue);
      const alertWindow = new Date(
        due.getTime() - Number(sched.alertDaysBefore ?? 1) * 86400 * 1000,
      );

      if (now < alertWindow) {
        skipped++;
        continue;
      }

      const severity = now > due ? 'overdue' : now.toDateString() === due.toDateString() ? 'due_today' : 'due_in_7d';
      try {
        await createNotification({
          entityType: `env_${sched.targetType}`,
          entityId: Number(sched.targetId),
          scheduleId: Number(sched.id),
          type: 'inspection_due',
          title: `Environmental inspection ${severity === 'overdue' ? 'OVERDUE' : 'due'} — ${sched.targetName}`,
          body: `Due ${due.toLocaleDateString('th-TH')} (${sched.frequency})`,
          dueAt: due.toISOString(),
          severity: severity as any,
          recipientRole: 'qa',
        });
        created++;
      } catch (err) {
        skipped++;
      }
    }

    return { scanned: schedules.length, created, skipped };
  });
}

// ============================================
// Trend: inspections aggregated per target + parameter for last N days
// ============================================

export async function getTrend(
  targetType: InspectionTargetType,
  targetId: number,
  parameter: string,
  days: number = 30,
): Promise<Array<{ performedAt: string; value: number | null; result: ResultStatus }>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const rows = await db
      .select({
        performedAt: t.records.performedAt,
        value: t.results.numericValue,
        result: t.results.result,
      })
      .from(t.results)
      .leftJoin(t.records, eq(t.records.id, t.results.inspectionId))
      .where(
        and(
          eq(t.records.targetType, targetType),
          eq(t.records.targetId, targetId),
          eq(t.results.parameter, parameter),
          sql`${t.records.performedAt} >= ${since}`,
        ),
      )
      .orderBy(t.records.performedAt);

    return rows.map((r: any) => ({
      performedAt: String(r.performedAt),
      value: r.value != null ? Number(r.value) : null,
      result: r.result as ResultStatus,
    }));
  });
}

// ============================================
// Helpers
// ============================================

function parseItemsJson(raw: unknown): InspectionTemplateItem[] {
  if (Array.isArray(raw)) return raw as InspectionTemplateItem[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTemplate(row: any): InspectionTemplate {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description ?? null,
    targetType: row.targetType as InspectionTargetType,
    items: parseItemsJson(row.itemsJson),
    isActive: Boolean(row.isActive),
    createdAt: String(row.createdAt),
  };
}
