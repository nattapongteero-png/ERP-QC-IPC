/**
 * Stability Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Manages stability protocols, studies, sample scheduling, and trend analysis.
 */

import { getDb } from '../db';
import { eq, and, desc, like, or, sql, count, lte, gte, isNull } from 'drizzle-orm';
import {
  sqliteStabilityProtocols,
  sqliteStabilityStudies,
  sqliteStabilitySamples,
  sqliteStabilityTrends,
  sqliteItems,
  sqliteInventoryLots,
  sqliteUsers,
  sqliteQualityTests,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  StabilityStudyType,
  StabilityProtocolStatus,
  StabilityStudyStatus,
  StabilitySampleStatus,
  StabilityProtocol,
  StabilityProtocolCreate,
  StabilityProtocolUpdate,
  StabilityStudy,
  StabilityStudyCreate,
  StabilityStudyUpdate,
  StabilityStudyDetails,
  StabilitySample,
  StabilitySampleUpdate,
  RecordTestRequest,
  SampleAlert,
  TrendParameter,
  StabilityTrends,
  StudyTrendData,
  StabilityProtocolListParams,
  StabilityStudyListParams,
  StabilityStudyListResponse,
  StabilitySampleListParams,
  StabilitySampleListResponse,
} from '@/types/stability';

// Type for database query result rows
interface DbProtocolRow {
  id: number;
  protocolNumber: string;
  name: string;
  productId: number | null;
  productName: string | null;
  studyType: string;
  storageCondition: string | null;
  timepoints: string | null;
  testsRequired: string | null;
  status: string;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface DbStudyRow {
  id: number;
  studyNumber: string;
  protocolId: number | null;
  protocolNumber: string | null;
  lotId: number | null;
  lotNumber: string | null;
  productId: number | null;
  productName: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  chamberLocation: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
}

interface DbSampleRow {
  id: number;
  studyId: number;
  sampleNumber: string | null;
  timepoint: number;
  scheduledDate: string | null;
  actualDate: string | null;
  status: string;
  qualityTestId: number | null;
  oosDetected: number | null;
  oosInvestigationId: number | null;
  sampledBy: number | null;
  sampledByName: string | null;
  notes: string | null;
}

interface DbTrendRow {
  id: number;
  studyId: number;
  testParameter: string | null;
  dataPoints: string | null;
  trendSlope: number | null;
  projectedFailureMonth: number | null;
  lastUpdated: string | null;
}

// Helper function to parse JSON arrays safely
function parseJsonArray<T>(value: string | null, defaultValue: T[] = []): T[] {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

// ============================================
// Protocol Number Generation
// ============================================

export async function generateProtocolNumber(): Promise<string> {
  const database = await getDb();

  // Get highest protocol number
  const result = await database
    .select({ protocolNumber: sqliteStabilityProtocols.protocolNumber })
    .from(sqliteStabilityProtocols)
    .orderBy(desc(sqliteStabilityProtocols.id))
    .limit(1);

  let nextNum = 1;
  if (result.length > 0) {
    const match = result[0].protocolNumber.match(/STAB-PROT-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `STAB-PROT-${String(nextNum).padStart(3, '0')}`;
}

// ============================================
// Study Number Generation
// ============================================

export async function generateStudyNumber(): Promise<string> {
  const database = await getDb();
  const now = new Date();
  const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get highest study number this month
  const prefix = `STAB-${yearMonth}-`;
  const result = await database
    .select({ studyNumber: sqliteStabilityStudies.studyNumber })
    .from(sqliteStabilityStudies)
    .where(like(sqliteStabilityStudies.studyNumber, `${prefix}%`))
    .orderBy(desc(sqliteStabilityStudies.id))
    .limit(1);

  let nextNum = 1;
  if (result.length > 0) {
    const match = result[0].studyNumber.match(/STAB-\d{4}-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// ============================================
// Protocol CRUD
// ============================================

export async function createProtocol(
  data: StabilityProtocolCreate,
  userId: number
): Promise<StabilityProtocol> {
  const database = await getDb();
  const protocolNumber = await generateProtocolNumber();

  const insertResult = await database.insert(sqliteStabilityProtocols).values({
    protocolNumber,
    name: data.name,
    productId: data.productId,
    studyType: data.studyType,
    storageCondition: data.storageCondition,
    timepoints: JSON.stringify(data.timepoints),
    testsRequired: JSON.stringify(data.testsRequired),
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  const protocolId = Number(insertResult.lastInsertRowid);

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'stability_protocols',
    recordId: protocolId,
    newValue: JSON.stringify({ protocolNumber, ...data }),
  });

  const protocol = await getProtocolById(protocolId);
  if (!protocol) {
    throw new Error('Failed to create protocol');
  }
  return protocol;
}

export async function getProtocolById(id: number): Promise<StabilityProtocol | null> {
  const database = await getDb();

  const result = await database
    .select({
      id: sqliteStabilityProtocols.id,
      protocolNumber: sqliteStabilityProtocols.protocolNumber,
      name: sqliteStabilityProtocols.name,
      productId: sqliteStabilityProtocols.productId,
      productName: sqliteItems.nameTh,
      studyType: sqliteStabilityProtocols.studyType,
      storageCondition: sqliteStabilityProtocols.storageCondition,
      timepoints: sqliteStabilityProtocols.timepoints,
      testsRequired: sqliteStabilityProtocols.testsRequired,
      status: sqliteStabilityProtocols.status,
      approvedBy: sqliteStabilityProtocols.approvedBy,
      approvedByName: sqliteUsers.name,
      approvedAt: sqliteStabilityProtocols.approvedAt,
      createdAt: sqliteStabilityProtocols.createdAt,
    })
    .from(sqliteStabilityProtocols)
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteStabilityProtocols.approvedBy, sqliteUsers.id))
    .where(eq(sqliteStabilityProtocols.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0] as DbProtocolRow;
  return mapProtocolRow(row);
}

export async function listProtocols(
  params?: StabilityProtocolListParams
): Promise<StabilityProtocol[]> {
  const database = await getDb();

  const conditions = [];
  if (params?.productId) {
    conditions.push(eq(sqliteStabilityProtocols.productId, params.productId));
  }
  if (params?.studyType) {
    conditions.push(eq(sqliteStabilityProtocols.studyType, params.studyType));
  }
  if (params?.status) {
    conditions.push(eq(sqliteStabilityProtocols.status, params.status));
  }

  const result = await database
    .select({
      id: sqliteStabilityProtocols.id,
      protocolNumber: sqliteStabilityProtocols.protocolNumber,
      name: sqliteStabilityProtocols.name,
      productId: sqliteStabilityProtocols.productId,
      productName: sqliteItems.nameTh,
      studyType: sqliteStabilityProtocols.studyType,
      storageCondition: sqliteStabilityProtocols.storageCondition,
      timepoints: sqliteStabilityProtocols.timepoints,
      testsRequired: sqliteStabilityProtocols.testsRequired,
      status: sqliteStabilityProtocols.status,
      approvedBy: sqliteStabilityProtocols.approvedBy,
      approvedByName: sqliteUsers.name,
      approvedAt: sqliteStabilityProtocols.approvedAt,
      createdAt: sqliteStabilityProtocols.createdAt,
    })
    .from(sqliteStabilityProtocols)
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteStabilityProtocols.approvedBy, sqliteUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sqliteStabilityProtocols.id));

  return result.map((row) => mapProtocolRow(row as DbProtocolRow));
}

export async function updateProtocol(
  id: number,
  data: StabilityProtocolUpdate,
  userId: number
): Promise<StabilityProtocol | null> {
  const database = await getDb();

  const existing = await getProtocolById(id);
  if (!existing) return null;

  // Cannot update approved protocols except to mark obsolete
  if (existing.status === 'approved' && data.status !== 'obsolete') {
    throw new Error('Cannot modify approved protocol');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.storageCondition !== undefined) updateData.storageCondition = data.storageCondition;
  if (data.timepoints !== undefined) updateData.timepoints = JSON.stringify(data.timepoints);
  if (data.testsRequired !== undefined) updateData.testsRequired = JSON.stringify(data.testsRequired);
  if (data.status !== undefined) updateData.status = data.status;

  await database
    .update(sqliteStabilityProtocols)
    .set(updateData)
    .where(eq(sqliteStabilityProtocols.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'stability_protocols',
    recordId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(data),
  });

  return getProtocolById(id);
}

export async function approveProtocol(id: number, userId: number): Promise<StabilityProtocol | null> {
  const database = await getDb();

  const existing = await getProtocolById(id);
  if (!existing) return null;

  if (existing.status !== 'draft') {
    throw new Error('Only draft protocols can be approved');
  }

  const now = new Date().toISOString();
  await database
    .update(sqliteStabilityProtocols)
    .set({
      status: 'approved',
      approvedBy: userId,
      approvedAt: now,
    })
    .where(eq(sqliteStabilityProtocols.id, id));

  await createAuditLog({
    userId,
    action: 'APPROVE',
    tableName: 'stability_protocols',
    recordId: id,
    newValue: JSON.stringify({ status: 'approved', approvedBy: userId, approvedAt: now }),
  });

  return getProtocolById(id);
}

// ============================================
// Study CRUD
// ============================================

export async function createStudy(
  data: StabilityStudyCreate,
  userId: number
): Promise<StabilityStudy> {
  const database = await getDb();
  const studyNumber = await generateStudyNumber();

  // Verify protocol is approved
  const protocol = await getProtocolById(data.protocolId);
  if (!protocol) {
    throw new Error('Protocol not found');
  }
  if (protocol.status !== 'approved') {
    throw new Error('Protocol must be approved before creating study');
  }

  const insertResult = await database.insert(sqliteStabilityStudies).values({
    studyNumber,
    protocolId: data.protocolId,
    lotId: data.lotId,
    startDate: data.startDate,
    chamberLocation: data.chamberLocation || null,
    notes: data.notes || null,
    status: 'active',
    createdBy: userId,
    createdAt: new Date().toISOString(),
  });

  const studyId = Number(insertResult.lastInsertRowid);

  // Generate sample schedule based on protocol timepoints
  await generateSampleSchedule(studyId, data.protocolId, data.startDate);

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'stability_studies',
    recordId: studyId,
    newValue: JSON.stringify({ studyNumber, ...data }),
  });

  const study = await getStudyById(studyId);
  if (!study) {
    throw new Error('Failed to create study');
  }
  return study;
}

async function generateSampleSchedule(
  studyId: number,
  protocolId: number,
  startDate: string
): Promise<void> {
  const database = await getDb();
  const protocol = await getProtocolById(protocolId);
  if (!protocol) return;

  const studyStart = new Date(startDate);

  for (const timepoint of protocol.timepoints) {
    const scheduledDate = new Date(studyStart);
    scheduledDate.setMonth(scheduledDate.getMonth() + timepoint);

    const sampleNumber = `S${studyId}-T${timepoint}`;

    await database.insert(sqliteStabilitySamples).values({
      studyId,
      sampleNumber,
      timepoint,
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getStudyById(id: number): Promise<StabilityStudy | null> {
  const database = await getDb();

  const result = await database
    .select({
      id: sqliteStabilityStudies.id,
      studyNumber: sqliteStabilityStudies.studyNumber,
      protocolId: sqliteStabilityStudies.protocolId,
      protocolNumber: sqliteStabilityProtocols.protocolNumber,
      lotId: sqliteStabilityStudies.lotId,
      lotNumber: sqliteInventoryLots.lotNumber,
      productId: sqliteStabilityProtocols.productId,
      productName: sqliteItems.nameTh,
      startDate: sqliteStabilityStudies.startDate,
      endDate: sqliteStabilityStudies.endDate,
      status: sqliteStabilityStudies.status,
      chamberLocation: sqliteStabilityStudies.chamberLocation,
      notes: sqliteStabilityStudies.notes,
      createdBy: sqliteStabilityStudies.createdBy,
      createdByName: sqliteUsers.name,
      createdAt: sqliteStabilityStudies.createdAt,
    })
    .from(sqliteStabilityStudies)
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .leftJoin(sqliteInventoryLots, eq(sqliteStabilityStudies.lotId, sqliteInventoryLots.id))
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteStabilityStudies.createdBy, sqliteUsers.id))
    .where(eq(sqliteStabilityStudies.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0] as DbStudyRow;
  return mapStudyRow(row);
}

export async function getStudyDetails(id: number): Promise<StabilityStudyDetails | null> {
  const study = await getStudyById(id);
  if (!study) return null;

  const protocol = study.protocolId ? await getProtocolById(study.protocolId) : null;
  if (!protocol) {
    throw new Error('Protocol not found for study');
  }

  const samples = await getSamples({ studyId: id });
  const trends = await getStudyTrendData(id);

  return {
    ...study,
    protocol,
    samples: samples.samples,
    trends: trends?.parameters || [],
  };
}

export async function listStudies(
  params?: StabilityStudyListParams
): Promise<StabilityStudyListResponse> {
  const database = await getDb();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params?.protocolId) {
    conditions.push(eq(sqliteStabilityStudies.protocolId, params.protocolId));
  }
  if (params?.productId) {
    conditions.push(eq(sqliteStabilityProtocols.productId, params.productId));
  }
  if (params?.status) {
    conditions.push(eq(sqliteStabilityStudies.status, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await database
    .select({ count: count() })
    .from(sqliteStabilityStudies)
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get studies
  const result = await database
    .select({
      id: sqliteStabilityStudies.id,
      studyNumber: sqliteStabilityStudies.studyNumber,
      protocolId: sqliteStabilityStudies.protocolId,
      protocolNumber: sqliteStabilityProtocols.protocolNumber,
      lotId: sqliteStabilityStudies.lotId,
      lotNumber: sqliteInventoryLots.lotNumber,
      productId: sqliteStabilityProtocols.productId,
      productName: sqliteItems.nameTh,
      startDate: sqliteStabilityStudies.startDate,
      endDate: sqliteStabilityStudies.endDate,
      status: sqliteStabilityStudies.status,
      chamberLocation: sqliteStabilityStudies.chamberLocation,
      notes: sqliteStabilityStudies.notes,
      createdBy: sqliteStabilityStudies.createdBy,
      createdByName: sqliteUsers.name,
      createdAt: sqliteStabilityStudies.createdAt,
    })
    .from(sqliteStabilityStudies)
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .leftJoin(sqliteInventoryLots, eq(sqliteStabilityStudies.lotId, sqliteInventoryLots.id))
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteStabilityStudies.createdBy, sqliteUsers.id))
    .where(whereClause)
    .orderBy(desc(sqliteStabilityStudies.id))
    .limit(limit)
    .offset(offset);

  const studies = await Promise.all(
    result.map(async (row) => {
      const study = mapStudyRow(row as DbStudyRow);
      // Add computed fields
      const samples = await getSamples({ studyId: study.id });
      const oosCount = samples.samples.filter((s) => s.oosDetected).length;
      const testedSamples = samples.samples.filter((s) => s.status === 'tested');
      const currentTimepoint =
        testedSamples.length > 0
          ? Math.max(...testedSamples.map((s) => s.timepoint))
          : null;
      const pendingSamples = samples.samples.filter((s) => s.status === 'pending');
      const nextDueDate =
        pendingSamples.length > 0
          ? pendingSamples.sort(
              (a, b) =>
                new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
            )[0].scheduledDate
          : null;

      return {
        ...study,
        currentTimepoint,
        nextDueDate,
        oosCount,
      };
    })
  );

  return { studies, total };
}

export async function updateStudy(
  id: number,
  data: StabilityStudyUpdate,
  userId: number
): Promise<StabilityStudy | null> {
  const database = await getDb();

  const existing = await getStudyById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'completed') {
      updateData.endDate = new Date().toISOString().split('T')[0];
    }
  }
  if (data.chamberLocation !== undefined) updateData.chamberLocation = data.chamberLocation;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await database
    .update(sqliteStabilityStudies)
    .set(updateData)
    .where(eq(sqliteStabilityStudies.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'stability_studies',
    recordId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(data),
  });

  return getStudyById(id);
}

// ============================================
// Sample Management
// ============================================

export async function getSamples(
  params?: StabilitySampleListParams
): Promise<StabilitySampleListResponse> {
  const database = await getDb();
  const page = params?.page || 1;
  const limit = params?.limit || 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params?.studyId) {
    conditions.push(eq(sqliteStabilitySamples.studyId, params.studyId));
  }
  if (params?.status) {
    conditions.push(eq(sqliteStabilitySamples.status, params.status));
  }

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

  if (params?.dueSoon) {
    conditions.push(lte(sqliteStabilitySamples.scheduledDate, thirtyDaysLaterStr));
    conditions.push(gte(sqliteStabilitySamples.scheduledDate, today));
    conditions.push(eq(sqliteStabilitySamples.status, 'pending'));
  }

  if (params?.overdue) {
    conditions.push(lte(sqliteStabilitySamples.scheduledDate, today));
    conditions.push(eq(sqliteStabilitySamples.status, 'pending'));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await database
    .select({ count: count() })
    .from(sqliteStabilitySamples)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get samples
  const result = await database
    .select({
      id: sqliteStabilitySamples.id,
      studyId: sqliteStabilitySamples.studyId,
      sampleNumber: sqliteStabilitySamples.sampleNumber,
      timepoint: sqliteStabilitySamples.timepoint,
      scheduledDate: sqliteStabilitySamples.scheduledDate,
      actualDate: sqliteStabilitySamples.actualDate,
      status: sqliteStabilitySamples.status,
      qualityTestId: sqliteStabilitySamples.qualityTestId,
      oosDetected: sqliteStabilitySamples.oosDetected,
      oosInvestigationId: sqliteStabilitySamples.oosInvestigationId,
      sampledBy: sqliteStabilitySamples.sampledBy,
      sampledByName: sqliteUsers.name,
      notes: sqliteStabilitySamples.notes,
    })
    .from(sqliteStabilitySamples)
    .leftJoin(sqliteUsers, eq(sqliteStabilitySamples.sampledBy, sqliteUsers.id))
    .where(whereClause)
    .orderBy(sqliteStabilitySamples.timepoint)
    .limit(limit)
    .offset(offset);

  const samples = result.map((row) => mapSampleRow(row as DbSampleRow));

  return { samples, total };
}

export async function getSampleById(id: number): Promise<StabilitySample | null> {
  const database = await getDb();

  const result = await database
    .select({
      id: sqliteStabilitySamples.id,
      studyId: sqliteStabilitySamples.studyId,
      sampleNumber: sqliteStabilitySamples.sampleNumber,
      timepoint: sqliteStabilitySamples.timepoint,
      scheduledDate: sqliteStabilitySamples.scheduledDate,
      actualDate: sqliteStabilitySamples.actualDate,
      status: sqliteStabilitySamples.status,
      qualityTestId: sqliteStabilitySamples.qualityTestId,
      oosDetected: sqliteStabilitySamples.oosDetected,
      oosInvestigationId: sqliteStabilitySamples.oosInvestigationId,
      sampledBy: sqliteStabilitySamples.sampledBy,
      sampledByName: sqliteUsers.name,
      notes: sqliteStabilitySamples.notes,
    })
    .from(sqliteStabilitySamples)
    .leftJoin(sqliteUsers, eq(sqliteStabilitySamples.sampledBy, sqliteUsers.id))
    .where(eq(sqliteStabilitySamples.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return mapSampleRow(result[0] as DbSampleRow);
}

export async function updateSample(
  id: number,
  data: StabilitySampleUpdate,
  userId: number
): Promise<StabilitySample | null> {
  const database = await getDb();

  const existing = await getSampleById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.actualDate !== undefined) updateData.actualDate = data.actualDate;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.status === 'sampled') {
    updateData.sampledBy = userId;
    updateData.actualDate = data.actualDate || new Date().toISOString().split('T')[0];
  }

  await database
    .update(sqliteStabilitySamples)
    .set(updateData)
    .where(eq(sqliteStabilitySamples.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'stability_samples',
    recordId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(data),
  });

  return getSampleById(id);
}

export async function recordTest(
  sampleId: number,
  data: RecordTestRequest,
  userId: number
): Promise<StabilitySample | null> {
  const database = await getDb();

  const existing = await getSampleById(sampleId);
  if (!existing) return null;

  await database
    .update(sqliteStabilitySamples)
    .set({
      status: 'tested',
      qualityTestId: data.qualityTestId,
      oosDetected: data.oosDetected ? 1 : 0,
      notes: data.notes || null,
    })
    .where(eq(sqliteStabilitySamples.id, sampleId));

  await createAuditLog({
    userId,
    action: 'TEST_RECORDED',
    tableName: 'stability_samples',
    recordId: sampleId,
    newValue: JSON.stringify(data),
  });

  // TODO: Update trend data if applicable

  return getSampleById(sampleId);
}

// ============================================
// Sample Alerts
// ============================================

export async function getSampleAlerts(daysAhead: number = 30): Promise<SampleAlert[]> {
  const database = await getDb();

  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const todayStr = today.toISOString().split('T')[0];
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const result = await database
    .select({
      sampleId: sqliteStabilitySamples.id,
      studyId: sqliteStabilitySamples.studyId,
      studyNumber: sqliteStabilityStudies.studyNumber,
      productName: sqliteItems.nameTh,
      lotNumber: sqliteInventoryLots.lotNumber,
      timepoint: sqliteStabilitySamples.timepoint,
      scheduledDate: sqliteStabilitySamples.scheduledDate,
    })
    .from(sqliteStabilitySamples)
    .innerJoin(
      sqliteStabilityStudies,
      eq(sqliteStabilitySamples.studyId, sqliteStabilityStudies.id)
    )
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .leftJoin(sqliteInventoryLots, eq(sqliteStabilityStudies.lotId, sqliteInventoryLots.id))
    .where(
      and(
        eq(sqliteStabilitySamples.status, 'pending'),
        lte(sqliteStabilitySamples.scheduledDate, futureDateStr),
        eq(sqliteStabilityStudies.status, 'active')
      )
    )
    .orderBy(sqliteStabilitySamples.scheduledDate);

  return result.map((row) => {
    const scheduledDate = row.scheduledDate || todayStr;
    const daysUntilDue = Math.floor(
      (new Date(scheduledDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      sampleId: row.sampleId,
      studyId: row.studyId,
      studyNumber: row.studyNumber,
      productName: row.productName || 'Unknown',
      lotNumber: row.lotNumber || 'Unknown',
      timepoint: row.timepoint,
      scheduledDate,
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
    };
  });
}

// ============================================
// Trend Analysis
// ============================================

export async function getStabilityTrends(productId?: number): Promise<StabilityTrends> {
  const database = await getDb();

  // Get active studies count
  const conditions = [eq(sqliteStabilityStudies.status, 'active')];
  if (productId) {
    conditions.push(eq(sqliteStabilityProtocols.productId, productId));
  }

  const activeStudiesResult = await database
    .select({ count: count() })
    .from(sqliteStabilityStudies)
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .where(and(...conditions));

  const totalActiveStudies = activeStudiesResult[0]?.count || 0;

  // Get overdue samples
  const today = new Date().toISOString().split('T')[0];
  const overdueResult = await database
    .select({ count: count() })
    .from(sqliteStabilitySamples)
    .innerJoin(
      sqliteStabilityStudies,
      eq(sqliteStabilitySamples.studyId, sqliteStabilityStudies.id)
    )
    .where(
      and(
        eq(sqliteStabilitySamples.status, 'pending'),
        lte(sqliteStabilitySamples.scheduledDate, today),
        eq(sqliteStabilityStudies.status, 'active')
      )
    );

  const overduesamples = overdueResult[0]?.count || 0;

  // Get OOS this month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  const oosResult = await database
    .select({ count: count() })
    .from(sqliteStabilitySamples)
    .where(
      and(
        eq(sqliteStabilitySamples.oosDetected, 1),
        gte(sqliteStabilitySamples.actualDate, monthStartStr)
      )
    );

  const oosThisMonth = oosResult[0]?.count || 0;

  // Get studies by product
  const studiesByProductResult = await database
    .select({
      productId: sqliteStabilityProtocols.productId,
      productName: sqliteItems.nameTh,
      count: count(),
      status: sqliteStabilityStudies.status,
    })
    .from(sqliteStabilityStudies)
    .leftJoin(
      sqliteStabilityProtocols,
      eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
    )
    .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
    .groupBy(sqliteStabilityProtocols.productId, sqliteStabilityStudies.status);

  // Aggregate by product
  const productMap = new Map<
    number,
    { productId: number; productName: string; activeStudies: number; completedStudies: number }
  >();

  for (const row of studiesByProductResult) {
    if (!row.productId) continue;
    if (!productMap.has(row.productId)) {
      productMap.set(row.productId, {
        productId: row.productId,
        productName: row.productName || 'Unknown',
        activeStudies: 0,
        completedStudies: 0,
      });
    }
    const product = productMap.get(row.productId)!;
    if (row.status === 'active') {
      product.activeStudies = row.count;
    } else if (row.status === 'completed') {
      product.completedStudies = row.count;
    }
  }

  return {
    totalActiveStudies,
    overduesamples,
    oosThisMonth,
    studiesByProduct: Array.from(productMap.values()),
  };
}

export async function getStudyTrendData(studyId: number): Promise<StudyTrendData | null> {
  const database = await getDb();

  const study = await getStudyById(studyId);
  if (!study) return null;

  // Get trend data from stability_trends table
  const trendResult = await database
    .select({
      id: sqliteStabilityTrends.id,
      studyId: sqliteStabilityTrends.studyId,
      testParameter: sqliteStabilityTrends.testParameter,
      dataPoints: sqliteStabilityTrends.dataPoints,
      trendSlope: sqliteStabilityTrends.trendSlope,
      projectedFailureMonth: sqliteStabilityTrends.projectedFailureMonth,
      lastUpdated: sqliteStabilityTrends.lastUpdated,
    })
    .from(sqliteStabilityTrends)
    .where(eq(sqliteStabilityTrends.studyId, studyId));

  const parameters: TrendParameter[] = trendResult.map((row) => {
    const dataPoints = parseJsonArray<{ timepoint: number; value: number; date: string }>(
      row.dataPoints
    );

    return {
      parameter: row.testParameter || 'Unknown',
      unit: '', // Would need to come from test spec
      specification: {}, // Would need to come from test spec
      dataPoints,
      trendSlope: row.trendSlope || 0,
      projectedFailureMonth: row.projectedFailureMonth,
    };
  });

  // Generate projections
  const projections = parameters.map((param) => {
    const lastValue =
      param.dataPoints.length > 0
        ? param.dataPoints[param.dataPoints.length - 1].value
        : 0;
    const projectedValue = lastValue + param.trendSlope * 12; // Project 12 months

    return {
      parameter: param.parameter,
      projectedValue,
      atMonth: 12,
      withinSpec: true, // Would need actual spec comparison
    };
  });

  return {
    studyId,
    studyNumber: study.studyNumber,
    parameters,
    projections,
  };
}

// ============================================
// Row Mapping Helpers
// ============================================

function mapProtocolRow(row: DbProtocolRow): StabilityProtocol {
  return {
    id: row.id,
    protocolNumber: row.protocolNumber,
    name: row.name,
    productId: row.productId || 0,
    productName: row.productName || undefined,
    studyType: row.studyType as StabilityStudyType,
    storageCondition: row.storageCondition || '',
    timepoints: parseJsonArray<number>(row.timepoints),
    testsRequired: parseJsonArray<{ testId: number; testName?: string }>(row.testsRequired).map(
      (t) => (typeof t === 'number' ? { testId: t } : t)
    ),
    status: row.status as StabilityProtocolStatus,
    approvedBy: row.approvedBy,
    approvedByName: row.approvedByName || undefined,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
  };
}

function mapStudyRow(row: DbStudyRow): StabilityStudy {
  return {
    id: row.id,
    studyNumber: row.studyNumber,
    protocolId: row.protocolId || 0,
    protocolNumber: row.protocolNumber || undefined,
    lotId: row.lotId || 0,
    lotNumber: row.lotNumber || undefined,
    productId: row.productId || 0,
    productName: row.productName || undefined,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as StabilityStudyStatus,
    chamberLocation: row.chamberLocation,
    currentTimepoint: null, // Computed separately
    nextDueDate: null, // Computed separately
    oosCount: 0, // Computed separately
    createdBy: row.createdBy || 0,
    createdByName: row.createdByName || undefined,
    createdAt: row.createdAt,
  };
}

function mapSampleRow(row: DbSampleRow): StabilitySample {
  return {
    id: row.id,
    studyId: row.studyId,
    sampleNumber: row.sampleNumber || '',
    timepoint: row.timepoint,
    scheduledDate: row.scheduledDate || '',
    actualDate: row.actualDate,
    status: row.status as StabilitySampleStatus,
    qualityTestId: row.qualityTestId,
    oosDetected: row.oosDetected === 1,
    oosInvestigationId: row.oosInvestigationId,
    sampledBy: row.sampledBy,
    sampledByName: row.sampledByName || undefined,
    notes: row.notes,
  };
}
