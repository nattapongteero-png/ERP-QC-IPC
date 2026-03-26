/**
 * Document Control Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Manages GMP-compliant document control with version management,
 * approval workflows, and audit trail.
 */

import { getDb, isSqlite } from '../db';
import { eq, and, desc, asc, gte, lte, like, or, isNull, sql } from 'drizzle-orm';
import {
  sqliteDocumentTypes,
  sqliteDocuments,
  sqliteDocumentVersions,
  sqliteDocumentApprovals,
  sqliteUsers,
  sqliteHROrgUnits,
  sqliteHRTrainingCourses,
  mysqlDocumentTypes,
  mysqlDocuments,
  mysqlDocumentVersions,
  mysqlDocumentApprovals,
  mysqlUsers,
  mysqlHROrgUnits,
  mysqlHRTrainingCourses,
  sqliteHRTrainingRecords,
  mysqlHRTrainingRecords,
  sqliteHRNotifications,
  mysqlHRNotifications,
  sqliteHREmployees,
  mysqlHREmployees,
} from '../db/schema';
import { createAuditLog } from '../audit';

/**
 * Format date for database insert/update
 * SQLite uses ISO string, MySQL uses Date objects (Drizzle handles conversion)
 */
function formatDateForDb(date: Date = new Date()): string | Date {
  if (isSqlite()) {
    return date.toISOString();
  }
  // MySQL: Drizzle ORM expects Date objects for datetime columns
  return date;
}

import type {
  DocumentStatus,
  DocumentVersionStatus,
  Document as DocumentType,
  DocumentVersion,
  DocumentApproval,
  DocumentApprovalRole,
  DocumentApprovalStatus,
  DocumentCreate,
  DocumentUpdate,
  DocumentVersionCreate,
  DocumentListParams,
  DocumentListResponse,
  DocumentDetails,
} from '@/types/documents';

// Type for database query result rows
interface DbVersionRow {
  id: number;
  documentId: number;
  versionNumber: string;
  content: string | null;
  filePath: string | null;
  // BLOB storage fields
  fileData: Buffer | Uint8Array | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  changeDescription: string | null;
  status: string;
  effectiveDate: string | null;
  obsoleteDate: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
}

interface DbDocumentRow {
  id: number;
  documentNumber: string;
  title: string;
  typeId: number | null;
  typeName: string | null;
  typeCode: string | null;
  departmentId: number | null;
  departmentName: string | null;
  currentVersionId: number | null;
  status: string;
  retentionYears: number;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbApprovalRow {
  id: number;
  versionId: number;
  approverId: number;
  approverName: string | null;
  approvalRole: string;
  status: string;
  comments: string | null;
  signedAt: string | null;
  delegatedFrom: number | null;
  delegatedFromName?: string | null;
  createdAt?: string;
}

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      documentTypes: sqliteDocumentTypes,
      documents: sqliteDocuments,
      versions: sqliteDocumentVersions,
      approvals: sqliteDocumentApprovals,
      users: sqliteUsers,
      orgUnits: sqliteHROrgUnits,
      trainingCourses: sqliteHRTrainingCourses,
      trainingRecords: sqliteHRTrainingRecords,
      notifications: sqliteHRNotifications,
      employees: sqliteHREmployees,
    };
  }
  return {
    documentTypes: mysqlDocumentTypes,
    documents: mysqlDocuments,
    versions: mysqlDocumentVersions,
    approvals: mysqlDocumentApprovals,
    users: mysqlUsers,
    orgUnits: mysqlHROrgUnits,
    trainingCourses: mysqlHRTrainingCourses,
    trainingRecords: mysqlHRTrainingRecords,
    notifications: mysqlHRNotifications,
    employees: mysqlHREmployees,
  };
}

/**
 * Generate a unique document number based on type prefix
 * Format: {PREFIX}-{YYMM}-{SEQUENCE}
 */
export async function generateDocumentNumber(typeId: number): Promise<string> {
  const { documentTypes, documents } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get document type with prefix
  const [docType] = await database
    .select({ prefix: documentTypes.prefix, code: documentTypes.code })
    .from(documentTypes)
    .where(eq(documentTypes.id, typeId));

  const prefix = docType?.prefix || docType?.code || 'DOC';

  // Get current year/month
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pattern = `${prefix}-${yymm}-%`;

  // Count existing documents with this pattern
  const existing = await database
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(like(documents.documentNumber, pattern));

  const sequence = (existing[0]?.count || 0) + 1;
  const sequenceStr = String(sequence).padStart(4, '0');

  return `${prefix}-${yymm}-${sequenceStr}`;
}

/**
 * Get all document types
 */
export async function getDocumentTypes(): Promise<Array<{
  id: number;
  code: string;
  name: string;
  prefix: string | null;
  reviewPeriodMonths: number | null;
}>> {
  const { documentTypes } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  return database
    .select({
      id: documentTypes.id,
      code: documentTypes.code,
      name: documentTypes.name,
      prefix: documentTypes.prefix,
      reviewPeriodMonths: documentTypes.reviewPeriodMonths,
    })
    .from(documentTypes)
    .orderBy(asc(documentTypes.code));
}

/**
 * Create a new document
 */
export async function createDocument(
  data: DocumentCreate,
  userId: number
): Promise<{ id: number; documentNumber: string }> {
  const { documents, documentTypes } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Generate document number
  const documentNumber = await generateDocumentNumber(data.typeId);

  // Get retention period from document type if not specified
  let retentionYears = data.retentionYears;
  if (!retentionYears) {
    const [docType] = await database
      .select({ reviewPeriodMonths: documentTypes.reviewPeriodMonths })
      .from(documentTypes)
      .where(eq(documentTypes.id, data.typeId));

    // Default to 7 years (Thai FDA GMP requirement)
    retentionYears = 7;
  }

  // Create document
  const nowStr = formatDateForDb();
  const insertValues = {
    documentNumber,
    title: data.title,
    typeId: data.typeId,
    departmentId: data.departmentId || null,
    trainingCourseId: data.trainingCourseId || null,
    status: 'draft',
    retentionYears,
    createdBy: userId,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  let newDocId: number;

  if (isSqlite()) {
    // SQLite supports returning
    const [newDoc] = await database
      .insert(documents)
      .values(insertValues)
      .returning({ id: documents.id });
    newDocId = newDoc.id;
  } else {
    // MySQL - insert and get last insert ID
    const result = await database.insert(documents).values(insertValues);
    newDocId = (result as any)[0]?.insertId;
  }

  const newDoc = { id: newDocId };

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'documents',
    recordId: newDoc.id,
    newValue: {
      documentNumber,
      title: data.title,
      status: 'draft',
    },
  });

  return { id: newDoc.id, documentNumber };
}

/**
 * Get document by ID with full details
 */
export async function getDocumentById(id: number): Promise<DocumentDetails | null> {
  const { documents, documentTypes, versions, approvals, users, orgUnits, trainingCourses } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get document with related data
  const [doc] = await database
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      title: documents.title,
      typeId: documents.typeId,
      typeName: documentTypes.name,
      typeCode: documentTypes.code,
      departmentId: documents.departmentId,
      departmentName: orgUnits.name,
      currentVersionId: documents.currentVersionId,
      status: documents.status,
      retentionYears: documents.retentionYears,
      createdBy: documents.createdBy,
      createdByName: users.name,
      trainingCourseId: documents.trainingCourseId,
      trainingCourseName: trainingCourses.name,
      trainingCourseCode: trainingCourses.code,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .leftJoin(orgUnits, eq(documents.departmentId, orgUnits.id))
    .leftJoin(users, eq(documents.createdBy, users.id))
    .leftJoin(trainingCourses, eq(documents.trainingCourseId, trainingCourses.id))
    .where(eq(documents.id, id));

  if (!doc) {
    return null;
  }

  // Get all versions (excluding fileData for list - fetch separately when needed)
  const docVersions = await database
    .select({
      id: versions.id,
      documentId: versions.documentId,
      versionNumber: versions.versionNumber,
      content: versions.content,
      filePath: versions.filePath,
      // BLOB metadata (not the actual data)
      fileName: versions.fileName,
      fileSize: versions.fileSize,
      mimeType: versions.mimeType,
      changeDescription: versions.changeDescription,
      status: versions.status,
      effectiveDate: versions.effectiveDate,
      obsoleteDate: versions.obsoleteDate,
      createdBy: versions.createdBy,
      createdByName: users.name,
      createdAt: versions.createdAt,
    })
    .from(versions)
    .leftJoin(users, eq(versions.createdBy, users.id))
    .where(eq(versions.documentId, id))
    .orderBy(desc(versions.createdAt));

  // Get current version details
  let currentVersion: DocumentVersion | null = null;
  if (doc.currentVersionId) {
    const cv = docVersions.find((v: DbVersionRow) => v.id === doc.currentVersionId);
    if (cv) {
      currentVersion = {
        id: cv.id,
        documentId: cv.documentId,
        versionNumber: cv.versionNumber,
        content: cv.content,
        filePath: cv.filePath,
        // BLOB metadata
        fileName: cv.fileName,
        fileSize: cv.fileSize,
        mimeType: cv.mimeType,
        hasFileData: !!(cv.fileName && cv.fileSize), // Indicates file data exists
        changeDescription: cv.changeDescription,
        status: cv.status as DocumentVersionStatus,
        effectiveDate: cv.effectiveDate,
        obsoleteDate: cv.obsoleteDate,
        createdBy: cv.createdBy!,
        createdByName: cv.createdByName || undefined,
        createdAt: cv.createdAt,
        approvals: [],
      };
    }
  }

  return {
    id: doc.id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    typeId: doc.typeId!,
    typeName: doc.typeName || undefined,
    typeCode: doc.typeCode || undefined,
    departmentId: doc.departmentId,
    departmentName: doc.departmentName || undefined,
    currentVersionId: doc.currentVersionId,
    status: doc.status as DocumentStatus,
    retentionYears: doc.retentionYears,
    trainingCourseId: doc.trainingCourseId || null,
    trainingCourseName: doc.trainingCourseName || undefined,
    trainingCourseCode: doc.trainingCourseCode || undefined,
    createdBy: doc.createdBy!,
    createdByName: doc.createdByName || undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    currentVersion,
    versions: docVersions.map((v: DbVersionRow) => ({
      id: v.id,
      documentId: v.documentId,
      versionNumber: v.versionNumber,
      content: v.content,
      filePath: v.filePath,
      // BLOB metadata
      fileName: v.fileName,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      hasFileData: !!(v.fileName && v.fileSize), // Indicates file data exists
      changeDescription: v.changeDescription,
      status: v.status as DocumentVersionStatus,
      effectiveDate: v.effectiveDate,
      obsoleteDate: v.obsoleteDate,
      createdBy: v.createdBy!,
      createdByName: v.createdByName || undefined,
      createdAt: v.createdAt,
      approvals: [],
    })),
  };
}

/**
 * List documents with filters and pagination
 */
export async function getDocuments(params: DocumentListParams): Promise<DocumentListResponse> {
  const { documents, documentTypes, users, orgUnits, versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const conditions = [];

  if (params.typeId) {
    conditions.push(eq(documents.typeId, params.typeId));
  }
  if (params.status) {
    conditions.push(eq(documents.status, params.status));
  }
  if (params.departmentId) {
    conditions.push(eq(documents.departmentId, params.departmentId));
  }
  if (params.search) {
    conditions.push(
      or(
        like(documents.documentNumber, `%${params.search}%`),
        like(documents.title, `%${params.search}%`)
      )
    );
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  // Get total count
  const [countResult] = await database
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Handle MySQL BigInt by converting to Number
  const total = Number(countResult?.count) || 0;

  // Get documents with current version number
  const docs = await database
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      title: documents.title,
      typeId: documents.typeId,
      typeName: documentTypes.name,
      typeCode: documentTypes.code,
      departmentId: documents.departmentId,
      departmentName: orgUnits.name,
      currentVersionId: documents.currentVersionId,
      currentVersionNumber: versions.versionNumber,
      status: documents.status,
      retentionYears: documents.retentionYears,
      createdBy: documents.createdBy,
      createdByName: users.name,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .leftJoin(orgUnits, eq(documents.departmentId, orgUnits.id))
    .leftJoin(users, eq(documents.createdBy, users.id))
    .leftJoin(versions, eq(documents.currentVersionId, versions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(documents.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    documents: docs.map((d: any) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      title: d.title,
      typeId: d.typeId!,
      typeName: d.typeName || undefined,
      typeCode: d.typeCode || undefined,
      departmentId: d.departmentId,
      departmentName: d.departmentName || undefined,
      currentVersionId: d.currentVersionId,
      currentVersionNumber: d.currentVersionNumber || undefined,
      status: d.status as DocumentStatus,
      retentionYears: d.retentionYears,
      trainingCourseId: d.trainingCourseId || null,
      createdBy: d.createdBy!,
      createdByName: d.createdByName || undefined,
      // Handle Date objects from MySQL
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    })),
    total,
  };
}

/**
 * Update document metadata
 */
export async function updateDocument(
  id: number,
  data: DocumentUpdate,
  userId: number
): Promise<boolean> {
  const { documents } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get current document
  const [current] = await database
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!current) {
    throw new Error(`Document ${id} not found`);
  }

  // Only allow updates to draft documents
  if (current.status !== 'draft') {
    throw new Error('Cannot update non-draft documents. Create a new version instead.');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: formatDateForDb(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
  if (data.trainingCourseId !== undefined) updateData.trainingCourseId = data.trainingCourseId;

  await database
    .update(documents)
    .set(updateData)
    .where(eq(documents.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'documents',
    recordId: id,
    oldValue: { title: current.title },
    newValue: updateData,
  });

  return true;
}

/**
 * Create a new version of a document
 */
export async function createVersion(
  data: DocumentVersionCreate,
  userId: number
): Promise<{ id: number; versionNumber: string }> {
  const { documents, versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get document
  const [doc] = await database
    .select()
    .from(documents)
    .where(eq(documents.id, data.documentId));

  if (!doc) {
    throw new Error(`Document ${data.documentId} not found`);
  }

  // Get latest version number
  const [latestVersion] = await database
    .select({ versionNumber: versions.versionNumber })
    .from(versions)
    .where(eq(versions.documentId, data.documentId))
    .orderBy(desc(versions.createdAt))
    .limit(1);

  // Calculate new version number
  let newVersionNumber = '1.0';
  if (latestVersion?.versionNumber) {
    const parts = latestVersion.versionNumber.split('.');
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;

    if (data.isMajorRevision) {
      newVersionNumber = `${major + 1}.0`;
    } else {
      newVersionNumber = `${major}.${minor + 1}`;
    }
  }

  // Create version
  const nowStr = formatDateForDb();
  const versionInsertValues = {
    documentId: data.documentId,
    versionNumber: newVersionNumber,
    content: data.content || null,
    filePath: data.filePath || null,
    // BLOB storage fields
    fileData: data.fileData || null,
    fileName: data.fileName || null,
    fileSize: data.fileSize || null,
    mimeType: data.mimeType || null,
    changeDescription: data.changeDescription || null,
    status: 'draft',
    createdBy: userId,
    createdAt: nowStr,
  };

  let newVersionId: number;

  if (isSqlite()) {
    // SQLite supports returning
    const [result] = await database
      .insert(versions)
      .values(versionInsertValues)
      .returning({ id: versions.id });
    newVersionId = result.id;
  } else {
    // MySQL - insert and get last insert ID
    const result = await database.insert(versions).values(versionInsertValues);
    newVersionId = (result as any)[0]?.insertId;
  }

  const newVersion = { id: newVersionId };

  // Update document's current version
  await database
    .update(documents)
    .set({
      currentVersionId: newVersion.id,
      updatedAt: formatDateForDb(),
    })
    .where(eq(documents.id, data.documentId));

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'document_versions',
    recordId: newVersion.id,
    newValue: {
      documentId: data.documentId,
      versionNumber: newVersionNumber,
      changeDescription: data.changeDescription,
    },
  });

  // Check if document is linked to a training course → create re-training alerts
  if (doc.trainingCourseId) {
    try {
      await createRetrainingAlerts(
        database,
        doc.trainingCourseId,
        data.documentId,
        doc.documentNumber || `Doc #${data.documentId}`,
        doc.title || '',
        newVersionNumber
      );
    } catch (err) {
      // Don't fail version creation if alerts fail
      console.error('Failed to create re-training alerts:', err);
    }
  }

  return { id: newVersion.id, versionNumber: newVersionNumber };
}

/**
 * Create re-training notifications for employees who completed
 * a training course linked to an updated document
 */
async function createRetrainingAlerts(
  database: ReturnType<typeof Object>,
  courseId: number,
  documentId: number,
  documentNumber: string,
  documentTitle: string,
  newVersion: string
): Promise<void> {
  const { trainingRecords, notifications, employees, trainingCourses } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = database as any;

  // Get course name
  const [course] = await db
    .select({ name: trainingCourses.name, code: trainingCourses.code })
    .from(trainingCourses)
    .where(eq(trainingCourses.id, courseId))
    .limit(1);

  const courseName = course ? `${course.code} - ${course.name}` : `Course #${courseId}`;

  // Find employees who completed this training course
  const trainedEmployees = await db
    .select({
      employeeId: trainingRecords.employeeId,
      employeeName: employees.firstName,
    })
    .from(trainingRecords)
    .leftJoin(employees, eq(trainingRecords.employeeId, employees.id))
    .where(
      and(
        eq(trainingRecords.courseId, courseId),
        eq(trainingRecords.result, 'pass')
      )
    );

  if (trainedEmployees.length === 0) return;

  // Deduplicate by employeeId
  const uniqueEmployeeIds = [...new Set(trainedEmployees.map((r: { employeeId: number }) => r.employeeId))];

  const nowStr = formatDateForDb();
  const notificationValues = uniqueEmployeeIds.map((empId) => ({
    employeeId: empId as number,
    type: 'retraining_required',
    title: `เอกสาร ${documentNumber} มีการอัปเดตเวอร์ชัน - ต้อง Re-training`,
    message: `เอกสาร "${documentTitle}" ได้อัปเดตเป็นเวอร์ชัน ${newVersion} กรุณาเข้ารับการอบรมหลักสูตร "${courseName}" อีกครั้ง`,
    referenceType: 'document',
    referenceId: documentId,
    isRead: false,
    createdAt: nowStr,
  }));

  // Batch insert notifications
  if (notificationValues.length > 0) {
    await db.insert(notifications).values(notificationValues);
  }
}

/**
 * Get version history for a document
 */
export async function getVersionHistory(documentId: number): Promise<DocumentVersion[]> {
  const { versions, approvals, users } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const docVersions = await database
    .select({
      id: versions.id,
      documentId: versions.documentId,
      versionNumber: versions.versionNumber,
      content: versions.content,
      filePath: versions.filePath,
      fileName: versions.fileName,
      fileSize: versions.fileSize,
      mimeType: versions.mimeType,
      changeDescription: versions.changeDescription,
      status: versions.status,
      effectiveDate: versions.effectiveDate,
      obsoleteDate: versions.obsoleteDate,
      createdBy: versions.createdBy,
      createdByName: users.name,
      createdAt: versions.createdAt,
    })
    .from(versions)
    .leftJoin(users, eq(versions.createdBy, users.id))
    .where(eq(versions.documentId, documentId))
    .orderBy(desc(versions.createdAt));

  // Get approvals for each version
  const result: DocumentVersion[] = [];
  for (const v of docVersions) {
    const versionApprovals = await database
      .select({
        id: approvals.id,
        versionId: approvals.versionId,
        approverId: approvals.approverId,
        approverName: users.name,
        approvalRole: approvals.approvalRole,
        status: approvals.status,
        comments: approvals.comments,
        signedAt: approvals.signedAt,
        delegatedFrom: approvals.delegatedFrom,
        createdAt: approvals.createdAt,
      })
      .from(approvals)
      .leftJoin(users, eq(approvals.approverId, users.id))
      .where(eq(approvals.versionId, v.id))
      .orderBy(asc(approvals.createdAt));

    result.push({
      id: v.id,
      documentId: v.documentId,
      versionNumber: v.versionNumber,
      content: v.content,
      filePath: v.filePath,
      fileName: v.fileName,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      hasFileData: !!(v.fileName && v.fileSize),
      changeDescription: v.changeDescription,
      status: v.status as DocumentVersionStatus,
      effectiveDate: v.effectiveDate,
      obsoleteDate: v.obsoleteDate,
      createdBy: v.createdBy!,
      createdByName: v.createdByName || undefined,
      createdAt: v.createdAt,
      approvals: versionApprovals.map((a: DbApprovalRow) => ({
        id: a.id,
        versionId: a.versionId,
        approverId: a.approverId,
        approverName: a.approverName || undefined,
        approvalRole: a.approvalRole,
        status: a.status as 'pending' | 'approved' | 'rejected',
        comments: a.comments,
        signedAt: a.signedAt,
        delegatedFrom: a.delegatedFrom,
        createdAt: a.createdAt,
      })),
    });
  }

  return result;
}

/**
 * Submit a version for approval
 */
export async function submitForApproval(
  versionId: number,
  approverIds: number[],
  userId: number
): Promise<boolean> {
  const { versions, approvals, documents, documentTypes } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get version with document
  const [version] = await database
    .select({
      id: versions.id,
      documentId: versions.documentId,
      status: versions.status,
      typeId: documents.typeId,
      approvalChain: documentTypes.approvalChain,
    })
    .from(versions)
    .innerJoin(documents, eq(versions.documentId, documents.id))
    .leftJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .where(eq(versions.id, versionId));

  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  if (version.status !== 'draft') {
    throw new Error('Only draft versions can be submitted for approval');
  }

  // Parse approval chain from document type
  let roles = ['reviewer', 'approver'];
  if (version.approvalChain) {
    try {
      roles = JSON.parse(version.approvalChain);
    } catch {
      // Use default roles
    }
  }

  // Create approval records
  for (let i = 0; i < approverIds.length; i++) {
    await database.insert(approvals).values({
      versionId,
      approverId: approverIds[i],
      approvalRole: roles[i] || 'approver',
      status: 'pending',
    });
  }

  // Update version status
  await database
    .update(versions)
    .set({ status: 'pending_approval' })
    .where(eq(versions.id, versionId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'document_versions',
    recordId: versionId,
    newValue: {
      status: 'pending_approval',
      approvers: approverIds,
    },
  });

  return true;
}

/**
 * Approve or reject a document version
 */
export async function processApproval(
  approvalId: number,
  decision: 'approved' | 'rejected',
  comments: string | null,
  userId: number
): Promise<{ versionStatus: DocumentVersionStatus }> {
  const { approvals, versions, documents } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get approval
  const [approval] = await database
    .select({
      id: approvals.id,
      versionId: approvals.versionId,
      approverId: approvals.approverId,
      status: approvals.status,
    })
    .from(approvals)
    .where(eq(approvals.id, approvalId));

  if (!approval) {
    throw new Error(`Approval ${approvalId} not found`);
  }

  if (approval.approverId !== userId) {
    throw new Error('You are not authorized to process this approval');
  }

  if (approval.status !== 'pending') {
    throw new Error('This approval has already been processed');
  }

  // Update approval
  await database
    .update(approvals)
    .set({
      status: decision,
      comments,
      signedAt: formatDateForDb(),
    })
    .where(eq(approvals.id, approvalId));

  // Check if all approvals are complete
  const allApprovals = await database
    .select({ status: approvals.status })
    .from(approvals)
    .where(eq(approvals.versionId, approval.versionId));

  let versionStatus: DocumentVersionStatus = 'pending_approval';

  if (decision === 'rejected') {
    // If any approval is rejected, version is rejected
    versionStatus = 'rejected';
  } else if (allApprovals.every((a: { status: string }) => a.status === 'approved' || a.status === decision)) {
    // All approvals complete
    versionStatus = 'approved';
  }

  // Update version status
  await database
    .update(versions)
    .set({ status: versionStatus })
    .where(eq(versions.id, approval.versionId));

  // If approved, update document status to active
  if (versionStatus === 'approved') {
    const [version] = await database
      .select({ documentId: versions.documentId })
      .from(versions)
      .where(eq(versions.id, approval.versionId));

    if (version) {
      // Mark any previous active versions as superseded
      await database
        .update(versions)
        .set({
          status: 'superseded',
          obsoleteDate: formatDateForDb(),
        })
        .where(
          and(
            eq(versions.documentId, version.documentId),
            eq(versions.status, 'approved')
          )
        );

      // Update version effective date
      await database
        .update(versions)
        .set({ effectiveDate: formatDateForDb() })
        .where(eq(versions.id, approval.versionId));

      // Update document status
      await database
        .update(documents)
        .set({
          status: 'active',
          currentVersionId: approval.versionId,
          updatedAt: formatDateForDb(),
        })
        .where(eq(documents.id, version.documentId));
    }
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'document_approvals',
    recordId: approvalId,
    newValue: {
      decision,
      comments,
      versionStatus,
    },
  });

  return { versionStatus };
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(userId: number): Promise<Array<{
  id: number;
  versionId: number;
  documentId: number;
  documentNumber: string;
  documentTitle: string;
  versionNumber: string;
  approvalRole: string | null;
  submittedBy: string | null;
  submittedAt: string;
}>> {
  const { approvals, versions, documents, users } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const pending = await database
    .select({
      id: approvals.id,
      versionId: approvals.versionId,
      documentId: documents.id,
      documentNumber: documents.documentNumber,
      documentTitle: documents.title,
      versionNumber: versions.versionNumber,
      approvalRole: approvals.approvalRole,
      submittedBy: users.name,
      submittedAt: approvals.createdAt,
    })
    .from(approvals)
    .innerJoin(versions, eq(approvals.versionId, versions.id))
    .innerJoin(documents, eq(versions.documentId, documents.id))
    .leftJoin(users, eq(versions.createdBy, users.id))
    .where(
      and(
        eq(approvals.approverId, userId),
        eq(approvals.status, 'pending')
      )
    )
    .orderBy(desc(approvals.createdAt));

  return pending;
}

/**
 * Mark document as obsolete
 */
export async function markDocumentObsolete(
  documentId: number,
  reason: string,
  userId: number
): Promise<boolean> {
  const { documents, versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get document
  const [doc] = await database
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  if (doc.status === 'obsolete') {
    throw new Error('Document is already obsolete');
  }

  // Update document
  await database
    .update(documents)
    .set({
      status: 'obsolete',
      updatedAt: formatDateForDb(),
    })
    .where(eq(documents.id, documentId));

  // Mark current version as obsolete
  if (doc.currentVersionId) {
    await database
      .update(versions)
      .set({
        status: 'superseded',
        obsoleteDate: formatDateForDb(),
      })
      .where(eq(versions.id, doc.currentVersionId));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'documents',
    recordId: documentId,
    oldValue: { status: doc.status },
    newValue: { status: 'obsolete', reason },
  });

  return true;
}

/**
 * Update document status
 * Allows direct status changes for administrative purposes
 */
export async function updateDocumentStatus(
  documentId: number,
  newStatus: DocumentStatus,
  userId: number
): Promise<boolean> {
  const { documents, versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get document
  const [doc] = await database
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  if (doc.status === newStatus) {
    throw new Error(`Document is already ${newStatus}`);
  }

  // Update document status
  await database
    .update(documents)
    .set({
      status: newStatus,
      updatedAt: formatDateForDb(),
    })
    .where(eq(documents.id, documentId));

  // Handle version status based on document status change
  if (doc.currentVersionId) {
    if (newStatus === 'obsolete' || newStatus === 'archived') {
      // Mark current version as superseded
      await database
        .update(versions)
        .set({
          status: 'superseded',
          obsoleteDate: formatDateForDb(),
        })
        .where(eq(versions.id, doc.currentVersionId));
    } else if (newStatus === 'active') {
      // Mark current version as approved if not already
      await database
        .update(versions)
        .set({
          status: 'approved',
          effectiveDate: formatDateForDb(),
        })
        .where(eq(versions.id, doc.currentVersionId));
    } else if (newStatus === 'draft') {
      // Mark current version as draft
      await database
        .update(versions)
        .set({
          status: 'draft',
        })
        .where(eq(versions.id, doc.currentVersionId));
    }
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'documents',
    recordId: documentId,
    oldValue: { status: doc.status },
    newValue: { status: newStatus },
  });

  return true;
}

/**
 * Get document statistics
 */
export async function getDocumentStatistics(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  pendingApprovals: number;
  upForReview: number;
}> {
  const { documents, documentTypes, approvals } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get all documents with type
  const allDocs = await database
    .select({
      status: documents.status,
      typeCode: documentTypes.code,
    })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.typeId, documentTypes.id));

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const doc of allDocs) {
    byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    if (doc.typeCode) {
      byType[doc.typeCode] = (byType[doc.typeCode] || 0) + 1;
    }
  }

  // Get pending approvals count
  const [pendingCount] = await database
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(eq(approvals.status, 'pending'));

  // TODO: Calculate documents up for review based on effective date + review period

  return {
    total: allDocs.length,
    byStatus,
    byType,
    pendingApprovals: pendingCount?.count || 0,
    upForReview: 0, // Placeholder
  };
}

/**
 * Get file data (BLOB) for a specific version
 * Returns the binary file data along with metadata
 */
export async function getVersionFileData(
  versionId: number
): Promise<{ data: Buffer | Uint8Array; fileName: string; mimeType: string; fileSize: number } | null> {
  const { versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const [version] = await database
    .select({
      fileData: versions.fileData,
      fileName: versions.fileName,
      fileSize: versions.fileSize,
      mimeType: versions.mimeType,
    })
    .from(versions)
    .where(eq(versions.id, versionId));

  if (!version || !version.fileData) {
    return null;
  }

  return {
    data: version.fileData,
    fileName: version.fileName || 'document',
    mimeType: version.mimeType || 'application/octet-stream',
    fileSize: version.fileSize || 0,
  };
}

/**
 * Update file data for an existing version
 */
export async function updateVersionFileData(
  versionId: number,
  fileData: Buffer | Uint8Array,
  fileName: string,
  fileSize: number,
  mimeType: string,
  userId: number
): Promise<boolean> {
  const { versions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  await database
    .update(versions)
    .set({
      fileData,
      fileName,
      fileSize,
      mimeType,
    })
    .where(eq(versions.id, versionId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'document_versions',
    recordId: versionId,
    newValue: { fileName, fileSize, mimeType, action: 'file_upload' },
  });

  return true;
}
