/**
 * COA (Certificate of Analysis) Service — Phase 4
 *
 * Generates COA documents from released QC samples and manages their
 * lifecycle: draft → review → approved → issued, plus supersede/revoke.
 *
 * Standards covered:
 *   - ISO/IEC 17025:2017          — laboratory competence, COA-issuing
 *   - FDA 21 CFR Part 11          — e-records / e-signatures, audit trail
 *   - WHO TRS 1010 Annex 4        — COA model template
 *   - USP <1080> / IPEC-PQG       — COA content for excipients
 *
 * Key design decisions:
 *   - Test result fields are SNAPSHOTTED at generation time into
 *     coa_test_results so the COA is immutable even if upstream sample
 *     tests are edited later.
 *   - User name + title are SNAPSHOTTED on every signature row so e-sig
 *     metadata survives later edits to the user record (21 CFR Part 11
 *     §11.50(b) — preserve originating-user identity).
 *   - QR token = randomBytes(32).toString('base64url') (~43 chars,
 *     URL-safe, brute-force resistant).
 */

import { eq, and, desc, asc, gte, lte, like, or, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { executeDbOperation, getInsertId } from '../db/db-helper';
import { isSqlite } from '../db';
import { getNow, toQueryDate, toDbDate } from '../db/date-utils';
import {
  // SQLite tables
  sqliteCoaDocuments,
  sqliteCoaTestResults,
  sqliteCoaTemplates,
  sqliteCoaSignatures,
  sqliteCoaPrintHistory,
  sqliteCoaVerifyLog,
  sqliteQcSamples,
  sqliteQcSampleTests,
  sqliteIPCCriteria,
  sqliteItems,
  sqliteCustomers,
  sqliteUsers,
  // MySQL tables
  mysqlCoaDocuments,
  mysqlCoaTestResults,
  mysqlCoaTemplates,
  mysqlCoaSignatures,
  mysqlCoaPrintHistory,
  mysqlCoaVerifyLog,
  mysqlQcSamples,
  mysqlQcSampleTests,
  mysqlIPCCriteria,
  mysqlItems,
  mysqlCustomers,
  mysqlUsers,
} from '../db/schema';

import type {
  CoaStatus,
  CoaConclusion,
  CoaTestConclusion,
  CoaLanguage,
  CoaAction,
  CoaPrintType,
  CoaSignatureRole,
  CreateCoaTemplateInput,
  UpdateCoaTemplateInput,
  ListCoaFilters,
} from '../validation/coa';

// ----------------------------------------------------------------------------
// Table-ref helper
// ----------------------------------------------------------------------------

function getTables() {
  if (isSqlite()) {
    return {
      coa: sqliteCoaDocuments,
      results: sqliteCoaTestResults,
      templates: sqliteCoaTemplates,
      signatures: sqliteCoaSignatures,
      prints: sqliteCoaPrintHistory,
      verify: sqliteCoaVerifyLog,
      samples: sqliteQcSamples,
      sampleTests: sqliteQcSampleTests,
      criteria: sqliteIPCCriteria,
      items: sqliteItems,
      customers: sqliteCustomers,
      users: sqliteUsers,
    };
  }
  return {
    coa: mysqlCoaDocuments,
    results: mysqlCoaTestResults,
    templates: mysqlCoaTemplates,
    signatures: mysqlCoaSignatures,
    prints: mysqlCoaPrintHistory,
    verify: mysqlCoaVerifyLog,
    samples: mysqlQcSamples,
    sampleTests: mysqlQcSampleTests,
    criteria: mysqlIPCCriteria,
    items: mysqlItems,
    customers: mysqlCustomers,
    users: mysqlUsers,
  };
}

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export interface CoaTestResultRow {
  id: number;
  coaId: number;
  sampleTestId: number | null;
  sequence: number;
  testName: string;
  testNameTh: string | null;
  testMethod: string | null;
  specification: string;
  result: string;
  resultUnit: string | null;
  conclusion: CoaTestConclusion;
  notes: string | null;
}

export interface CoaSignatureRow {
  id: number;
  coaId: number;
  role: string;
  userId: number;
  userNameSnapshot: string | null;
  userTitleSnapshot: string | null;
  signedAt: string | Date;
  signatureImagePath: string | null;
  signatureMeaning: string | null;
  ipAddress: string | null;
}

export interface CoaTemplate {
  id: number;
  name: string;
  productCategory: string | null;
  isDefault: boolean;
  isActive: boolean;
  headerLogoPath: string | null;
  headerHtml: string | null;
  footerHtml: string | null;
  signatoryRoles: string[];
  showStorageConditions: boolean;
  showExpiryDate: boolean;
  showRetestDate: boolean;
  showQrVerify: boolean;
  language: CoaLanguage;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CoaDocument {
  id: number;
  coaNumber: string;
  sampleId: number;
  templateId: number | null;
  productId: number;
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string;
  customerId: number | null;
  customerName: string | null;
  salesOrderRef: string | null;
  issueDate: string | Date;
  expiryDate: string | Date | null;
  retestDate: string | Date | null;
  manufactureDate: string | Date | null;
  conclusion: CoaConclusion;
  status: CoaStatus;
  supersededBy: number | null;
  revokeReason: string | null;
  qrCodeToken: string;
  createdAt: string | Date;
  createdBy: number;
  createdByName: string | null;
  approvedAt: string | Date | null;
  approvedBy: number | null;
  releasedAt: string | Date | null;
  releasedBy: number | null;
  pdfPath: string | null;
  pdfGeneratedAt: string | Date | null;
  updatedAt: string | Date;
}

export interface CoaDocumentFull extends CoaDocument {
  // Sample-level snapshot
  sampleNumber: string | null;
  storageConditions: string | null;
  quantityReceived: number | null;
  unit: string | null;
  customerCode: string | null;
  // Template
  template: CoaTemplate | null;
  // Children
  results: CoaTestResultRow[];
  signatures: CoaSignatureRow[];
  // Audit / metrics
  printCount: number;
}

export interface CoaListRow {
  id: number;
  coaNumber: string;
  sampleId: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  lotNumber: string;
  customerId: number | null;
  customerName: string | null;
  issueDate: string | Date;
  status: CoaStatus;
  conclusion: CoaConclusion;
  createdAt: string | Date;
}

export interface CoaListResult {
  items: CoaListRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CoaPublicView {
  coaNumber: string;
  status: CoaStatus;
  conclusion: CoaConclusion;
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string;
  manufactureDate: string | Date | null;
  expiryDate: string | Date | null;
  issueDate: string | Date;
  customerName: string | null;
  results: Array<{
    sequence: number;
    testName: string;
    testNameTh: string | null;
    specification: string;
    result: string;
    resultUnit: string | null;
    conclusion: CoaTestConclusion;
  }>;
  signatures: Array<{
    role: string;
    userName: string | null;
    userTitle: string | null;
    signedAt: string | Date;
    signatureMeaning: string | null;
  }>;
  supersededByCoaNumber: string | null;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/** COA-{YYYY}-{6digit-seq} — same scheme as QC sample numbering. */
async function generateCoaNumber(database: any): Promise<string> {
  const tables = getTables();
  const year = new Date().getFullYear();
  const prefix = `COA-${year}-`;
  const existing = await database
    .select({ coaNumber: tables.coa.coaNumber })
    .from(tables.coa)
    .where(like(tables.coa.coaNumber, `${prefix}%`))
    .orderBy(desc(tables.coa.id))
    .limit(1);
  if (existing.length === 0) return `${prefix}000001`;
  const last = String(existing[0].coaNumber);
  const seq = parseInt(last.replace(prefix, ''), 10);
  const next = (Number.isFinite(seq) ? seq + 1 : 1).toString().padStart(6, '0');
  return `${prefix}${next}`;
}

/** Generate a 32-byte URL-safe token for the public verify portal. */
function generateQrToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Format a spec range from a qc_sample_tests row to a human-readable spec string. */
function formatSpecification(test: {
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  specText: string | null;
  unit: string | null;
}): string {
  if (test.specText && test.specText.trim()) return test.specText.trim();
  const unit = test.unit ? ` ${test.unit}` : '';
  if (test.specMin != null && test.specMax != null) {
    return `${test.specMin} – ${test.specMax}${unit}`;
  }
  if (test.specMin != null) return `≥ ${test.specMin}${unit}`;
  if (test.specMax != null) return `≤ ${test.specMax}${unit}`;
  if (test.specTarget != null) return `${test.specTarget}${unit}`;
  return '—';
}

/** Format a result value (numeric or text) with optional unit. */
function formatResult(test: {
  numericResult: number | null;
  textResult: string | null;
  unit: string | null;
}): { result: string; unit: string | null } {
  if (test.numericResult != null && Number.isFinite(test.numericResult)) {
    return { result: String(test.numericResult), unit: test.unit ?? null };
  }
  if (test.textResult && String(test.textResult).trim()) {
    return { result: String(test.textResult).trim(), unit: null };
  }
  return { result: '—', unit: null };
}

/** Map qc_sample_tests.resultStatus → coa_test_results.conclusion. */
function mapTestConclusion(resultStatus: string): CoaTestConclusion {
  switch (resultStatus) {
    case 'pass':
      return 'conform';
    case 'fail':
      return 'non_conform';
    default:
      return 'na';
  }
}

/** Determine overall COA conclusion from per-test result_status values. */
function determineOverallConclusion(testStatuses: string[]): CoaConclusion {
  if (testStatuses.length === 0) return 'partial';
  const hasFail = testStatuses.some((s) => s === 'fail');
  if (hasFail) return 'does_not_comply';
  const hasPending = testStatuses.some(
    (s) => s !== 'pass' && s !== 'fail' && s !== 'na',
  );
  if (hasPending) return 'partial';
  return 'complies';
}

/** Parse signatoryRoles JSON column safely. */
function parseSignatoryRoles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.map((r) => String(r));
    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve the template to use for a COA.
 * Priority:
 *   1. Explicit templateId (must be active)
 *   2. is_active=true is_default=true template matching the product category
 *   3. Any is_active=true is_default=true template (global default)
 */
async function resolveTemplate(
  database: any,
  explicitTemplateId: number | null | undefined,
  productCategory: string | null | undefined,
): Promise<{ id: number; raw: any } | null> {
  const tables = getTables();
  if (explicitTemplateId) {
    const [tpl] = await database
      .select()
      .from(tables.templates)
      .where(eq(tables.templates.id, explicitTemplateId))
      .limit(1);
    if (!tpl) {
      throw new Error(`Template ${explicitTemplateId} not found`);
    }
    if (!tpl.isActive) {
      throw new Error(`Template ${explicitTemplateId} is not active`);
    }
    return { id: Number(tpl.id), raw: tpl };
  }
  // 2. Category-specific default
  if (productCategory) {
    const [categoryTpl] = await database
      .select()
      .from(tables.templates)
      .where(
        and(
          eq(tables.templates.isActive, true),
          eq(tables.templates.isDefault, true),
          eq(tables.templates.productCategory, productCategory),
        ),
      )
      .limit(1);
    if (categoryTpl) {
      return { id: Number(categoryTpl.id), raw: categoryTpl };
    }
  }
  // 3. Global default (productCategory IS NULL)
  const [globalTpl] = await database
    .select()
    .from(tables.templates)
    .where(
      and(
        eq(tables.templates.isActive, true),
        eq(tables.templates.isDefault, true),
      ),
    )
    .orderBy(asc(tables.templates.id))
    .limit(1);
  return globalTpl ? { id: Number(globalTpl.id), raw: globalTpl } : null;
}

function rawToTemplate(raw: any): CoaTemplate {
  return {
    id: Number(raw.id),
    name: String(raw.name),
    productCategory: raw.productCategory ?? null,
    isDefault: Boolean(raw.isDefault),
    isActive: Boolean(raw.isActive),
    headerLogoPath: raw.headerLogoPath ?? null,
    headerHtml: raw.headerHtml ?? null,
    footerHtml: raw.footerHtml ?? null,
    signatoryRoles: parseSignatoryRoles(raw.signatoryRoles),
    showStorageConditions: Boolean(raw.showStorageConditions),
    showExpiryDate: Boolean(raw.showExpiryDate),
    showRetestDate: Boolean(raw.showRetestDate),
    showQrVerify: Boolean(raw.showQrVerify),
    language: (raw.language as CoaLanguage) || 'bilingual',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// ----------------------------------------------------------------------------
// COA generation from a released QC sample
// ----------------------------------------------------------------------------

export interface GenerateCoaInput {
  sampleId: number;
  templateId?: number;
  customerId?: number;
  salesOrderRef?: string;
  generatedBy: number;
  language?: CoaLanguage;
}

export interface GenerateCoaResult {
  coaId: number;
  coaNumber: string;
  status: CoaStatus;
  conclusion: CoaConclusion;
}

export async function generateCoaFromSample(
  input: GenerateCoaInput,
): Promise<GenerateCoaResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Load sample with product info
    const [sample] = await db
      .select({
        id: tables.samples.id,
        sampleNumber: tables.samples.sampleNumber,
        productId: tables.samples.productId,
        productCategory: tables.items.category,
        lotNumber: tables.samples.lotNumber,
        manufactureDate: tables.samples.manufactureDate,
        expiryDate: tables.samples.expiryDate,
        retestDate: tables.samples.retestDate,
        customerId: tables.samples.customerId,
        salesOrderRef: tables.samples.salesOrderRef,
        status: tables.samples.status,
      })
      .from(tables.samples)
      .leftJoin(tables.items, eq(tables.samples.productId, tables.items.id))
      .where(eq(tables.samples.id, input.sampleId))
      .limit(1);

    if (!sample) {
      throw new Error(`QC sample ${input.sampleId} not found`);
    }
    if (sample.status !== 'released') {
      throw new Error(
        `Cannot generate COA — sample is ${sample.status}, must be 'released'`,
      );
    }

    // 2. Reject duplicate "active" COA for this sample (allow if previous was revoked/superseded)
    const existingCoa = await db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        status: tables.coa.status,
      })
      .from(tables.coa)
      .where(eq(tables.coa.sampleId, input.sampleId));
    const blocking = (existingCoa as any[]).find(
      (c) =>
        c.status !== 'revoked' && c.status !== 'superseded',
    );
    if (blocking) {
      throw new Error(
        `An active COA already exists for sample #${input.sampleId}: ${blocking.coaNumber} (${blocking.status})`,
      );
    }

    // 3. Resolve template
    const template = await resolveTemplate(
      db,
      input.templateId,
      sample.productCategory ?? null,
    );
    if (!template) {
      throw new Error(
        `No active default COA template found. Set up a default template at /quality/coa/templates first.`,
      );
    }

    // 4. Load all sample tests (with criteria for English test names)
    const testRows = await db
      .select({
        id: tables.sampleTests.id,
        sequence: tables.sampleTests.sequence,
        criteriaId: tables.sampleTests.criteriaId,
        criteriaCode: tables.criteria.code,
        criteriaName: tables.criteria.name,
        criteriaNameTh: tables.criteria.nameTh,
        specMin: tables.sampleTests.specMin,
        specMax: tables.sampleTests.specMax,
        specTarget: tables.sampleTests.specTarget,
        specText: tables.sampleTests.specText,
        unit: tables.sampleTests.unit,
        testMethod: tables.sampleTests.testMethod,
        numericResult: tables.sampleTests.numericResult,
        textResult: tables.sampleTests.textResult,
        resultStatus: tables.sampleTests.resultStatus,
      })
      .from(tables.sampleTests)
      .leftJoin(
        tables.criteria,
        eq(tables.sampleTests.criteriaId, tables.criteria.id),
      )
      .where(eq(tables.sampleTests.sampleId, input.sampleId))
      .orderBy(asc(tables.sampleTests.sequence), asc(tables.sampleTests.id));

    if ((testRows as any[]).length === 0) {
      throw new Error(
        `Sample ${input.sampleId} has no test results — cannot generate COA`,
      );
    }

    // 5. Determine overall conclusion
    const statuses = (testRows as any[]).map((t) => String(t.resultStatus));
    const conclusion = determineOverallConclusion(statuses);

    // 6. Insert coa_documents row
    const coaNumber = await generateCoaNumber(db);
    const qrToken = generateQrToken();
    const now = getNow();
    const issueDate = toDbDate(new Date());

    const insertResult = await db.insert(tables.coa).values({
      coaNumber,
      sampleId: input.sampleId,
      templateId: template.id,
      productId: sample.productId,
      lotNumber: sample.lotNumber ?? '',
      customerId: input.customerId ?? sample.customerId ?? null,
      salesOrderRef: input.salesOrderRef ?? sample.salesOrderRef ?? null,
      issueDate,
      expiryDate: sample.expiryDate ?? null,
      retestDate: sample.retestDate ?? null,
      manufactureDate: sample.manufactureDate ?? null,
      conclusion,
      status: 'draft' as CoaStatus,
      qrCodeToken: qrToken,
      createdAt: now,
      createdBy: input.generatedBy,
      updatedAt: now,
    });
    const coaId = Number(getInsertId(insertResult));

    // 6b. Record the analyst signature ("Tested by") at generation time so the
    // COA shows a real signature rather than just the creator's name fallback.
    // The user who generates the COA from completed QC results is the analyst
    // attesting to the test data.
    if (input.generatedBy) {
      const [analyst] = await db
        .select({ name: tables.users.name, department: tables.users.department })
        .from(tables.users)
        .where(eq(tables.users.id, input.generatedBy))
        .limit(1);
      await db.insert(tables.signatures).values({
        coaId,
        role: 'analyst',
        userId: input.generatedBy,
        userNameSnapshot: analyst?.name ? String(analyst.name) : null,
        userTitleSnapshot: analyst?.department ? String(analyst.department) : null,
        signedAt: now,
        signatureMeaning: 'Tested / analysed',
        ipAddress: null,
        createdAt: now,
      });
    }

    // 7. Snapshot every test result into coa_test_results
    let seq = 1;
    for (const t of testRows as any[]) {
      const numericResult = t.numericResult != null ? Number(t.numericResult) : null;
      const formatted = formatResult({
        numericResult,
        textResult: t.textResult ?? null,
        unit: t.unit ?? null,
      });
      const spec = formatSpecification({
        specMin: t.specMin != null ? Number(t.specMin) : null,
        specMax: t.specMax != null ? Number(t.specMax) : null,
        specTarget: t.specTarget != null ? Number(t.specTarget) : null,
        specText: t.specText ?? null,
        unit: t.unit ?? null,
      });
      const testName = String(
        t.criteriaName || t.criteriaNameTh || t.criteriaCode || `Test #${t.id}`,
      );
      await db.insert(tables.results).values({
        coaId,
        sampleTestId: Number(t.id),
        sequence: Number(t.sequence) || seq,
        testName,
        testNameTh: t.criteriaNameTh ?? null,
        testMethod: t.testMethod ?? null,
        specification: spec,
        result: formatted.result,
        resultUnit: formatted.unit,
        conclusion: mapTestConclusion(String(t.resultStatus)),
        notes: null,
        createdAt: now,
      });
      seq++;
    }

    return {
      coaId,
      coaNumber,
      status: 'draft',
      conclusion,
    };
  });
}

// ----------------------------------------------------------------------------
// Read: getCoaById (full detail)
// ----------------------------------------------------------------------------

export async function getCoaById(id: number): Promise<CoaDocumentFull | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [header] = await db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        sampleId: tables.coa.sampleId,
        sampleNumber: tables.samples.sampleNumber,
        storageConditions: tables.samples.storageConditions,
        quantityReceived: tables.samples.quantityReceived,
        unit: tables.samples.unit,
        templateId: tables.coa.templateId,
        productId: tables.coa.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        productNameEn: tables.items.nameEn,
        lotNumber: tables.coa.lotNumber,
        customerId: tables.coa.customerId,
        customerCode: tables.customers.code,
        customerName: tables.customers.name,
        salesOrderRef: tables.coa.salesOrderRef,
        issueDate: tables.coa.issueDate,
        expiryDate: tables.coa.expiryDate,
        retestDate: tables.coa.retestDate,
        manufactureDate: tables.coa.manufactureDate,
        conclusion: tables.coa.conclusion,
        status: tables.coa.status,
        supersededBy: tables.coa.supersededBy,
        revokeReason: tables.coa.revokeReason,
        qrCodeToken: tables.coa.qrCodeToken,
        createdAt: tables.coa.createdAt,
        createdBy: tables.coa.createdBy,
        createdByName: tables.users.name,
        approvedAt: tables.coa.approvedAt,
        approvedBy: tables.coa.approvedBy,
        releasedAt: tables.coa.releasedAt,
        releasedBy: tables.coa.releasedBy,
        pdfPath: tables.coa.pdfPath,
        pdfGeneratedAt: tables.coa.pdfGeneratedAt,
        updatedAt: tables.coa.updatedAt,
      })
      .from(tables.coa)
      .leftJoin(tables.samples, eq(tables.coa.sampleId, tables.samples.id))
      .leftJoin(tables.items, eq(tables.coa.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.coa.customerId, tables.customers.id))
      .leftJoin(tables.users, eq(tables.coa.createdBy, tables.users.id))
      .where(eq(tables.coa.id, id))
      .limit(1);

    if (!header) return null;
    const h: any = header;

    // Test results
    const resultRows = await db
      .select()
      .from(tables.results)
      .where(eq(tables.results.coaId, id))
      .orderBy(asc(tables.results.sequence), asc(tables.results.id));

    const results: CoaTestResultRow[] = (resultRows as any[]).map((r) => ({
      id: Number(r.id),
      coaId: Number(r.coaId),
      sampleTestId: r.sampleTestId != null ? Number(r.sampleTestId) : null,
      sequence: Number(r.sequence) || 1,
      testName: String(r.testName),
      testNameTh: r.testNameTh ?? null,
      testMethod: r.testMethod ?? null,
      specification: String(r.specification),
      result: String(r.result),
      resultUnit: r.resultUnit ?? null,
      conclusion: (r.conclusion as CoaTestConclusion) || 'na',
      notes: r.notes ?? null,
    }));

    // Signatures
    const sigRows = await db
      .select()
      .from(tables.signatures)
      .where(eq(tables.signatures.coaId, id))
      .orderBy(asc(tables.signatures.signedAt));

    const signatures: CoaSignatureRow[] = (sigRows as any[]).map((s) => ({
      id: Number(s.id),
      coaId: Number(s.coaId),
      role: String(s.role),
      userId: Number(s.userId),
      userNameSnapshot: s.userNameSnapshot ?? null,
      userTitleSnapshot: s.userTitleSnapshot ?? null,
      signedAt: s.signedAt,
      signatureImagePath: s.signatureImagePath ?? null,
      signatureMeaning: s.signatureMeaning ?? null,
      ipAddress: s.ipAddress ?? null,
    }));

    // Template (lazy load if templateId set)
    let template: CoaTemplate | null = null;
    if (h.templateId != null) {
      const [tplRow] = await db
        .select()
        .from(tables.templates)
        .where(eq(tables.templates.id, Number(h.templateId)))
        .limit(1);
      if (tplRow) template = rawToTemplate(tplRow);
    }

    // Print count
    const countRow = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tables.prints)
      .where(eq(tables.prints.coaId, id));
    const printCount = Number((countRow as any[])[0]?.n ?? 0);

    return {
      id: Number(h.id),
      coaNumber: String(h.coaNumber),
      sampleId: Number(h.sampleId),
      sampleNumber: h.sampleNumber ?? null,
      storageConditions: h.storageConditions ?? null,
      quantityReceived: h.quantityReceived != null ? Number(h.quantityReceived) : null,
      unit: h.unit ?? null,
      templateId: h.templateId != null ? Number(h.templateId) : null,
      productId: Number(h.productId),
      productCode: h.productCode ?? null,
      productName: h.productName ?? null,
      productNameEn: h.productNameEn ?? null,
      lotNumber: String(h.lotNumber || ''),
      customerId: h.customerId != null ? Number(h.customerId) : null,
      customerCode: h.customerCode ?? null,
      customerName: h.customerName ?? null,
      salesOrderRef: h.salesOrderRef ?? null,
      issueDate: h.issueDate,
      expiryDate: h.expiryDate ?? null,
      retestDate: h.retestDate ?? null,
      manufactureDate: h.manufactureDate ?? null,
      conclusion: h.conclusion as CoaConclusion,
      status: h.status as CoaStatus,
      supersededBy: h.supersededBy != null ? Number(h.supersededBy) : null,
      revokeReason: h.revokeReason ?? null,
      qrCodeToken: String(h.qrCodeToken),
      createdAt: h.createdAt,
      createdBy: Number(h.createdBy),
      createdByName: h.createdByName ?? null,
      approvedAt: h.approvedAt ?? null,
      approvedBy: h.approvedBy != null ? Number(h.approvedBy) : null,
      releasedAt: h.releasedAt ?? null,
      releasedBy: h.releasedBy != null ? Number(h.releasedBy) : null,
      pdfPath: h.pdfPath ?? null,
      pdfGeneratedAt: h.pdfGeneratedAt ?? null,
      updatedAt: h.updatedAt,
      template,
      results,
      signatures,
      printCount,
    };
  });
}

// ----------------------------------------------------------------------------
// List COA documents
// ----------------------------------------------------------------------------

export async function listCoa(filters: ListCoaFilters = {}): Promise<CoaListResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0
      ? Math.min(filters.limit, 200)
      : 50;

    const conds: any[] = [];
    if (filters.status) conds.push(eq(tables.coa.status, filters.status));
    if (filters.productId) conds.push(eq(tables.coa.productId, filters.productId));
    if (filters.customerId) conds.push(eq(tables.coa.customerId, filters.customerId));
    if (filters.dateFrom) {
      conds.push(gte(tables.coa.issueDate, toQueryDate(filters.dateFrom) as any));
    }
    if (filters.dateTo) {
      conds.push(lte(tables.coa.issueDate, toQueryDate(filters.dateTo) as any));
    }
    if (filters.search) {
      const q = `%${filters.search}%`;
      conds.push(
        or(
          like(tables.coa.coaNumber, q),
          like(tables.coa.lotNumber, q),
          like(tables.coa.salesOrderRef, q),
        ),
      );
    }
    const where = conds.length > 0 ? and(...conds) : undefined;

    let countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tables.coa);
    if (where) countQuery = countQuery.where(where);
    const totalRow = await countQuery;
    const total = Number((totalRow as any[])[0]?.count ?? 0);

    let pageQuery = db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        sampleId: tables.coa.sampleId,
        productId: tables.coa.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        lotNumber: tables.coa.lotNumber,
        customerId: tables.coa.customerId,
        customerName: tables.customers.name,
        issueDate: tables.coa.issueDate,
        status: tables.coa.status,
        conclusion: tables.coa.conclusion,
        createdAt: tables.coa.createdAt,
      })
      .from(tables.coa)
      .leftJoin(tables.items, eq(tables.coa.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.coa.customerId, tables.customers.id));
    if (where) pageQuery = pageQuery.where(where);

    const rows = await pageQuery
      .orderBy(desc(tables.coa.id))
      .limit(limit)
      .offset((page - 1) * limit);

    const items: CoaListRow[] = (rows as any[]).map((r) => ({
      id: Number(r.id),
      coaNumber: String(r.coaNumber),
      sampleId: Number(r.sampleId),
      productId: Number(r.productId),
      productCode: r.productCode ?? null,
      productName: r.productName ?? null,
      lotNumber: String(r.lotNumber || ''),
      customerId: r.customerId != null ? Number(r.customerId) : null,
      customerName: r.customerName ?? null,
      issueDate: r.issueDate,
      status: r.status as CoaStatus,
      conclusion: r.conclusion as CoaConclusion,
      createdAt: r.createdAt,
    }));

    return { items, total, page, limit };
  });
}

// ----------------------------------------------------------------------------
// Status transitions
// ----------------------------------------------------------------------------

const COA_TRANSITIONS: Record<CoaStatus, CoaStatus[]> = {
  draft: ['review', 'revoked'],
  review: ['approved', 'draft', 'revoked'],
  approved: ['issued', 'revoked'],
  issued: ['superseded', 'revoked'],
  superseded: [],
  revoked: [],
};

const ACTION_TO_TARGET: Record<CoaAction, CoaStatus> = {
  submit_for_review: 'review',
  approve: 'approved',
  issue: 'issued',
  supersede: 'superseded',
  revoke: 'revoked',
};

/**
 * Map an action → which signature role should be auto-recorded.
 * approve → approver, issue → qa_release. Other actions don't sign.
 */
const ACTION_TO_SIGNATURE: Partial<Record<CoaAction, CoaSignatureRole>> = {
  approve: 'approver',
  issue: 'qa_release',
};

export interface TransitionCoaParams {
  action: CoaAction;
  signatureMeaning?: string;
  notes?: string;
  supersededBy?: number;
  reason?: string;
  ipAddress?: string;
}

export async function transitionCoaStatus(
  id: number,
  params: TransitionCoaParams,
  userId: number,
): Promise<{ id: number; fromStatus: CoaStatus; toStatus: CoaStatus }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [current] = await db
      .select({
        id: tables.coa.id,
        status: tables.coa.status,
      })
      .from(tables.coa)
      .where(eq(tables.coa.id, id))
      .limit(1);
    if (!current) {
      throw new Error(`COA ${id} not found`);
    }

    const fromStatus = String(current.status) as CoaStatus;
    const toStatus = ACTION_TO_TARGET[params.action];
    if (!toStatus) {
      throw new Error(`Unknown COA action: ${params.action}`);
    }

    const allowed = COA_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Cannot transition COA from "${fromStatus}" to "${toStatus}" (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }

    if (params.action === 'revoke' && (!params.reason || params.reason.trim().length === 0)) {
      throw new Error(`Revocation reason is required`);
    }
    if (params.action === 'supersede' && !params.supersededBy) {
      throw new Error(`supersededBy (id of replacement COA) is required`);
    }

    // Snapshot user name + title for the signature row (preserves identity per
    // 21 CFR Part 11 §11.50(b) even if the user record is later renamed).
    let userNameSnapshot: string | null = null;
    let userTitleSnapshot: string | null = null;
    const sigRole = ACTION_TO_SIGNATURE[params.action];
    if (sigRole) {
      const [user] = await db
        .select({ name: tables.users.name, department: tables.users.department })
        .from(tables.users)
        .where(eq(tables.users.id, userId))
        .limit(1);
      userNameSnapshot = user?.name ? String(user.name) : null;
      userTitleSnapshot = user?.department ? String(user.department) : null;
    }

    // Build the update set
    const now = getNow();
    const updates: Record<string, any> = {
      status: toStatus,
      updatedAt: now,
    };
    if (params.action === 'approve') {
      updates.approvedAt = now;
      updates.approvedBy = userId;
    }
    if (params.action === 'issue') {
      updates.releasedAt = now;
      updates.releasedBy = userId;
    }
    if (params.action === 'supersede') {
      updates.supersededBy = params.supersededBy;
    }
    if (params.action === 'revoke') {
      updates.revokeReason = params.reason;
    }

    await db.update(tables.coa).set(updates).where(eq(tables.coa.id, id));

    // Insert signature row when applicable
    if (sigRole) {
      // Reject duplicate signature for the same role
      const dupes = await db
        .select({ id: tables.signatures.id })
        .from(tables.signatures)
        .where(
          and(
            eq(tables.signatures.coaId, id),
            eq(tables.signatures.role, sigRole),
          ),
        )
        .limit(1);
      if ((dupes as any[]).length === 0) {
        await db.insert(tables.signatures).values({
          coaId: id,
          role: sigRole,
          userId,
          userNameSnapshot,
          userTitleSnapshot,
          signedAt: now,
          signatureMeaning: params.signatureMeaning ?? defaultSignatureMeaning(params.action),
          ipAddress: params.ipAddress ?? null,
          createdAt: now,
        });
      }
    }

    return { id, fromStatus, toStatus };
  });
}

function defaultSignatureMeaning(action: CoaAction): string {
  switch (action) {
    case 'approve':
      return 'Approved';
    case 'issue':
      return 'Released';
    default:
      return action;
  }
}

// ----------------------------------------------------------------------------
// Public verify portal — token lookup
// ----------------------------------------------------------------------------

export interface VerifyContext {
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
}

export async function getCoaByQrToken(
  token: string,
  ctx: VerifyContext = {},
): Promise<CoaPublicView | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    if (!token || typeof token !== 'string' || token.length < 8) {
      await db.insert(tables.verify).values({
        coaId: null,
        qrTokenAttempted: token ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        result: 'not_found',
        verifiedAt: getNow(),
        createdAt: getNow(),
      });
      return null;
    }

    const [coa] = await db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        status: tables.coa.status,
        conclusion: tables.coa.conclusion,
        productId: tables.coa.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        productNameEn: tables.items.nameEn,
        lotNumber: tables.coa.lotNumber,
        manufactureDate: tables.coa.manufactureDate,
        expiryDate: tables.coa.expiryDate,
        issueDate: tables.coa.issueDate,
        customerName: tables.customers.name,
        supersededBy: tables.coa.supersededBy,
      })
      .from(tables.coa)
      .leftJoin(tables.items, eq(tables.coa.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.coa.customerId, tables.customers.id))
      .where(eq(tables.coa.qrCodeToken, token))
      .limit(1);

    if (!coa) {
      await db.insert(tables.verify).values({
        coaId: null,
        qrTokenAttempted: token,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        result: 'not_found',
        verifiedAt: getNow(),
        createdAt: getNow(),
      });
      return null;
    }

    const status = String(coa.status) as CoaStatus;

    // Public portal only exposes issued (and superseded — to alert receiver).
    // draft/review/approved/revoked → 404 to consumer.
    if (status !== 'issued' && status !== 'superseded') {
      await db.insert(tables.verify).values({
        coaId: Number(coa.id),
        qrTokenAttempted: token,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        result: status === 'revoked' ? 'revoked' : 'not_found',
        verifiedAt: getNow(),
        createdAt: getNow(),
      });
      return null;
    }

    // Log success
    await db.insert(tables.verify).values({
      coaId: Number(coa.id),
      qrTokenAttempted: token,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      referer: ctx.referer ?? null,
      result: status === 'superseded' ? 'superseded' : 'found',
      verifiedAt: getNow(),
      createdAt: getNow(),
    });

    // Pull results + signatures (no signature_image_path in public view)
    const resultRows = await db
      .select()
      .from(tables.results)
      .where(eq(tables.results.coaId, Number(coa.id)))
      .orderBy(asc(tables.results.sequence), asc(tables.results.id));
    const sigRows = await db
      .select()
      .from(tables.signatures)
      .where(eq(tables.signatures.coaId, Number(coa.id)))
      .orderBy(asc(tables.signatures.signedAt));

    let supersededByCoaNumber: string | null = null;
    if (coa.supersededBy != null) {
      const [r] = await db
        .select({ coaNumber: tables.coa.coaNumber })
        .from(tables.coa)
        .where(eq(tables.coa.id, Number(coa.supersededBy)))
        .limit(1);
      supersededByCoaNumber = r?.coaNumber ? String(r.coaNumber) : null;
    }

    return {
      coaNumber: String(coa.coaNumber),
      status,
      conclusion: coa.conclusion as CoaConclusion,
      productCode: coa.productCode ?? null,
      productName: coa.productName ?? null,
      productNameEn: coa.productNameEn ?? null,
      lotNumber: String(coa.lotNumber || ''),
      manufactureDate: coa.manufactureDate ?? null,
      expiryDate: coa.expiryDate ?? null,
      issueDate: coa.issueDate,
      customerName: coa.customerName ?? null,
      results: (resultRows as any[]).map((r) => ({
        sequence: Number(r.sequence) || 1,
        testName: String(r.testName),
        testNameTh: r.testNameTh ?? null,
        specification: String(r.specification),
        result: String(r.result),
        resultUnit: r.resultUnit ?? null,
        conclusion: (r.conclusion as CoaTestConclusion) || 'na',
      })),
      signatures: (sigRows as any[]).map((s) => ({
        role: String(s.role),
        userName: s.userNameSnapshot ?? null,
        userTitle: s.userTitleSnapshot ?? null,
        signedAt: s.signedAt,
        signatureMeaning: s.signatureMeaning ?? null,
      })),
      supersededByCoaNumber,
    };
  });
}

// ----------------------------------------------------------------------------
// Print history audit
// ----------------------------------------------------------------------------

export async function logCoaPrint(input: {
  coaId: number;
  printedBy: number;
  printType: CoaPrintType;
  customerEmail?: string;
  ipAddress?: string;
}): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();
    await db.insert(tables.prints).values({
      coaId: input.coaId,
      printedBy: input.printedBy,
      printedAt: now,
      printType: input.printType,
      customerEmail: input.customerEmail ?? null,
      ipAddress: input.ipAddress ?? null,
      createdAt: now,
    });
  });
}

// ----------------------------------------------------------------------------
// COA Templates CRUD
// ----------------------------------------------------------------------------

export async function listCoaTemplates(filters?: {
  isActive?: boolean;
  productCategory?: string;
}): Promise<CoaTemplate[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conds: any[] = [];
    if (filters?.isActive !== undefined) conds.push(eq(tables.templates.isActive, filters.isActive));
    if (filters?.productCategory) conds.push(eq(tables.templates.productCategory, filters.productCategory));
    let q = db.select().from(tables.templates);
    if (conds.length > 0) q = q.where(and(...conds));
    const rows = await q.orderBy(asc(tables.templates.name));
    return (rows as any[]).map(rawToTemplate);
  });
}

export async function getCoaTemplate(id: number): Promise<CoaTemplate | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [row] = await db
      .select()
      .from(tables.templates)
      .where(eq(tables.templates.id, id))
      .limit(1);
    return row ? rawToTemplate(row) : null;
  });
}

export async function createCoaTemplate(
  input: CreateCoaTemplateInput,
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // If isDefault=true and productCategory is set, clear is_default on
    // siblings with the same category to avoid two defaults at the same level.
    if (input.isDefault === true) {
      if (input.productCategory) {
        await db
          .update(tables.templates)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(tables.templates.productCategory, input.productCategory),
              eq(tables.templates.isDefault, true),
            ),
          );
      } else {
        // Global default — reset all other global defaults.
        await db
          .update(tables.templates)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              sql`${tables.templates.productCategory} IS NULL`,
              eq(tables.templates.isDefault, true),
            ),
          );
      }
    }

    const result = await db.insert(tables.templates).values({
      name: input.name,
      productCategory: input.productCategory ?? null,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      headerLogoPath: input.headerLogoPath ?? null,
      headerHtml: input.headerHtml ?? null,
      footerHtml: input.footerHtml ?? null,
      signatoryRoles: input.signatoryRoles
        ? JSON.stringify(input.signatoryRoles)
        : null,
      showStorageConditions: input.showStorageConditions ?? true,
      showExpiryDate: input.showExpiryDate ?? true,
      showRetestDate: input.showRetestDate ?? false,
      showQrVerify: input.showQrVerify ?? true,
      language: input.language ?? 'bilingual',
      createdAt: now,
      updatedAt: now,
    });
    return { id: Number(getInsertId(result)) };
  });
}

export async function updateCoaTemplate(
  id: number,
  updates: UpdateCoaTemplateInput,
): Promise<{ updated: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();
    const set: Record<string, any> = { updatedAt: now };

    // Clear sibling defaults if marking this as default at category-level
    if (updates.isDefault === true) {
      const [existing] = await db
        .select({ productCategory: tables.templates.productCategory })
        .from(tables.templates)
        .where(eq(tables.templates.id, id))
        .limit(1);
      const cat = existing?.productCategory as string | null | undefined;
      if (cat) {
        await db
          .update(tables.templates)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(tables.templates.productCategory, cat),
              eq(tables.templates.isDefault, true),
            ),
          );
      } else {
        await db
          .update(tables.templates)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              sql`${tables.templates.productCategory} IS NULL`,
              eq(tables.templates.isDefault, true),
            ),
          );
      }
    }

    const allowed: Array<keyof UpdateCoaTemplateInput> = [
      'name',
      'productCategory',
      'isDefault',
      'isActive',
      'headerLogoPath',
      'headerHtml',
      'footerHtml',
      'showStorageConditions',
      'showExpiryDate',
      'showRetestDate',
      'showQrVerify',
      'language',
    ];
    for (const k of allowed) {
      if (updates[k] !== undefined) set[k as string] = updates[k];
    }
    if (updates.signatoryRoles !== undefined) {
      set.signatoryRoles = updates.signatoryRoles
        ? JSON.stringify(updates.signatoryRoles)
        : null;
    }
    await db.update(tables.templates).set(set).where(eq(tables.templates.id, id));
    return { updated: true };
  });
}

// Used by CoaDocumentPdf to render the QR target.
export function buildVerifyUrl(token: string, baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/api/coa/verify/${encodeURIComponent(token)}`;
}

// ----------------------------------------------------------------------------
// Public verify portal — COA number lookup (alternate to QR token)
// ----------------------------------------------------------------------------

/**
 * Resolve a COA by its human-readable COA number (e.g. "COA-2026-000123") and
 * return the same public-safe view as `getCoaByQrToken`. Used by the public
 * verify search page when a customer types the number printed on the
 * certificate instead of scanning the QR code.
 *
 * Like `getCoaByQrToken`, this:
 *   - Returns null for unknown / draft / review / approved / revoked COAs
 *   - Logs every attempt to coa_verify_log (success or failure)
 *   - Strips internal-only fields (signature image paths, IP-traceable refs)
 */
export async function getCoaByCoaNumber(
  coaNumber: string,
  ctx: VerifyContext = {},
): Promise<CoaPublicView | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const trimmed = String(coaNumber || '').trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 64) {
      await db.insert(tables.verify).values({
        coaId: null,
        qrTokenAttempted: trimmed || null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        result: 'not_found',
        verifiedAt: getNow(),
        createdAt: getNow(),
      });
      return null;
    }

    // Lookup by coa_number — case-insensitive normalize
    const [row] = await db
      .select({ qrCodeToken: tables.coa.qrCodeToken })
      .from(tables.coa)
      .where(eq(tables.coa.coaNumber, trimmed))
      .limit(1);

    if (!row || !row.qrCodeToken) {
      await db.insert(tables.verify).values({
        coaId: null,
        qrTokenAttempted: trimmed,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        result: 'not_found',
        verifiedAt: getNow(),
        createdAt: getNow(),
      });
      return null;
    }

    // Delegate to the canonical token-based lookup so verify-log + filtering
    // logic stays in one place.
    return getCoaByQrToken(String(row.qrCodeToken), ctx);
  });
}

// ----------------------------------------------------------------------------
// Internal — used by the public PDF endpoint
// ----------------------------------------------------------------------------

/**
 * Return the COA full detail by QR token IF AND ONLY IF the COA is in
 * status='issued'. Returns null for any other state. Does NOT log to
 * coa_verify_log — the caller (public PDF route) is expected to log a
 * `coa_print_history` row instead so we don't double-count verify hits.
 *
 * Use carefully: this exposes the internal CoaDocumentFull shape (which
 * includes signature image paths). Only the server-side PDF renderer should
 * receive this — never return it to the public API as JSON.
 */
export async function getIssuedCoaForPublicPdf(
  token: string,
): Promise<CoaDocumentFull | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    if (!token || typeof token !== 'string' || token.length < 8) {
      return null;
    }
    const [row] = await db
      .select({ id: tables.coa.id, status: tables.coa.status })
      .from(tables.coa)
      .where(eq(tables.coa.qrCodeToken, token))
      .limit(1);
    if (!row) return null;
    if (String(row.status) !== 'issued') return null;
    return getCoaById(Number(row.id));
  });
}

// ----------------------------------------------------------------------------
// Phase 5 — Set default template (atomic)
// ----------------------------------------------------------------------------

/**
 * Atomically mark `templateId` as the default template for its product
 * category. Unsets `is_default` on every other template that shares the
 * same category (or is global, when category is null).
 *
 * Throws if the template doesn't exist or is inactive.
 */
export async function setDefaultCoaTemplate(
  templateId: number,
): Promise<{ id: number; productCategory: string | null }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [tpl] = await db
      .select({
        id: tables.templates.id,
        productCategory: tables.templates.productCategory,
        isActive: tables.templates.isActive,
      })
      .from(tables.templates)
      .where(eq(tables.templates.id, templateId))
      .limit(1);
    if (!tpl) throw new Error(`Template ${templateId} not found`);
    if (!tpl.isActive) {
      throw new Error(`Template ${templateId} is inactive — cannot set as default`);
    }

    const now = getNow();
    const cat = tpl.productCategory as string | null;
    if (cat) {
      await db
        .update(tables.templates)
        .set({ isDefault: false, updatedAt: now })
        .where(
          and(
            eq(tables.templates.productCategory, cat),
            eq(tables.templates.isDefault, true),
          ),
        );
    } else {
      await db
        .update(tables.templates)
        .set({ isDefault: false, updatedAt: now })
        .where(
          and(
            sql`${tables.templates.productCategory} IS NULL`,
            eq(tables.templates.isDefault, true),
          ),
        );
    }
    await db
      .update(tables.templates)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(tables.templates.id, templateId));
    return { id: templateId, productCategory: cat ?? null };
  });
}

// ----------------------------------------------------------------------------
// Phase 8 — Customer linkage + Sales-order cross-listing
// ----------------------------------------------------------------------------

/**
 * List COA documents that reference a given sales-order ref. Used by the
 * Sales Order detail page to show "Quality Certificates" attached to the
 * order so customer-service can hand them off at shipment time.
 *
 * Matches `coa_documents.sales_order_ref` against the supplied identifier
 * as a string (so callers can pass either the SO number "SO-2026-001" or
 * a numeric id; we cast to string).
 */
export async function listCoaForOrder(
  salesOrderRef: string | number,
): Promise<CoaListRow[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const ref = String(salesOrderRef ?? '').trim();
    if (!ref) return [];
    const rows = await db
      .select({
        id: tables.coa.id,
        coaNumber: tables.coa.coaNumber,
        sampleId: tables.coa.sampleId,
        productId: tables.coa.productId,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
        lotNumber: tables.coa.lotNumber,
        customerId: tables.coa.customerId,
        customerName: tables.customers.name,
        issueDate: tables.coa.issueDate,
        status: tables.coa.status,
        conclusion: tables.coa.conclusion,
        createdAt: tables.coa.createdAt,
      })
      .from(tables.coa)
      .leftJoin(tables.items, eq(tables.coa.productId, tables.items.id))
      .leftJoin(tables.customers, eq(tables.coa.customerId, tables.customers.id))
      .where(eq(tables.coa.salesOrderRef, ref))
      .orderBy(desc(tables.coa.id));
    return (rows as any[]).map((r) => ({
      id: Number(r.id),
      coaNumber: String(r.coaNumber),
      sampleId: Number(r.sampleId),
      productId: Number(r.productId),
      productCode: r.productCode ?? null,
      productName: r.productName ?? null,
      lotNumber: String(r.lotNumber || ''),
      customerId: r.customerId != null ? Number(r.customerId) : null,
      customerName: r.customerName ?? null,
      issueDate: r.issueDate,
      status: r.status as CoaStatus,
      conclusion: r.conclusion as CoaConclusion,
      createdAt: r.createdAt,
    }));
  });
}

/**
 * Link a COA to a customer + sales order. Allowed only for COAs that are
 * already in status='issued' — operators should never re-route a draft
 * because the printed certificate would already be in transit.
 */
export async function linkCoaToOrder(
  coaId: number,
  customerId: number | null,
  salesOrderRef: string | null,
): Promise<{ updated: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const [coa] = await db
      .select({ id: tables.coa.id, status: tables.coa.status })
      .from(tables.coa)
      .where(eq(tables.coa.id, coaId))
      .limit(1);
    if (!coa) throw new Error(`COA ${coaId} not found`);
    if (coa.status !== 'issued') {
      throw new Error(
        `Can only link COA when status='issued' (current: ${coa.status})`,
      );
    }
    const now = getNow();
    await db
      .update(tables.coa)
      .set({
        customerId: customerId ?? null,
        salesOrderRef: salesOrderRef ?? null,
        updatedAt: now,
      })
      .where(eq(tables.coa.id, coaId));
    return { updated: true };
  });
}

// ----------------------------------------------------------------------------
// Phase 8 — Email COA to customer
// ----------------------------------------------------------------------------

export interface EmailCoaInput {
  coaId: number;
  recipientEmail: string;
  ccEmails?: string[];
  subject?: string;
  bodyText?: string;
  attachOfficial: boolean;
  sentBy: number;
  ipAddress?: string;
}

export interface EmailCoaResult {
  messageId: string | null;
  deliveredAt: string | Date;
  /** True if SMTP wasn't configured — caller can show a graceful warning. */
  smtpUnavailable: boolean;
}

/**
 * Send the COA to a customer email.
 *
 * SMTP configuration is read from env at call time:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
 *   SMTP_SECURE ('true'|'false', default true if port=465)
 *
 * If SMTP_HOST is unset, we DO NOT crash — we log a warning and return
 * `smtpUnavailable: true`. The print history row is still recorded with
 * the customer email so operators have a paper trail.
 *
 * If `attachOfficial` is true and the COA is in status='issued', we render
 * the official PDF (no watermark) and attach as `COA-{number}.pdf`. If
 * Chromium isn't available we fall back to "no attachment" but still send
 * the email with the verify-portal URL embedded in the body.
 */
export async function emailCoaToCustomer(
  input: EmailCoaInput,
): Promise<EmailCoaResult> {
  // 1. Load COA
  const coa = await getCoaById(input.coaId);
  if (!coa) throw new Error(`COA ${input.coaId} not found`);

  // 2. Build subject + body defaults
  const subject =
    input.subject?.trim() ||
    `Certificate of Analysis — ${coa.coaNumber}`;
  const verifyUrl =
    `${(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:33021').replace(
      /\/$/,
      '',
    )}/coa/verify/${coa.coaNumber}`;
  const defaultBody =
    `Dear Customer,\n\n` +
    `Please find attached the Certificate of Analysis for the following lot:\n\n` +
    `  Product : ${coa.productName ?? coa.productCode ?? `#${coa.productId}`}\n` +
    `  Lot     : ${coa.lotNumber}\n` +
    `  COA No  : ${coa.coaNumber}\n` +
    `  Issued  : ${coa.issueDate}\n\n` +
    `You can verify this certificate online at:\n` +
    `  ${verifyUrl}\n\n` +
    `Best regards,\nQA Department`;
  const bodyText = input.bodyText?.trim() || defaultBody;

  // 3. Optionally render official PDF
  let attachment: { filename: string; content: Buffer } | null = null;
  if (input.attachOfficial && coa.status === 'issued') {
    try {
      const { renderCoaPdf } = await import('@/lib/coa/pdf-renderer');
      const pdf = await renderCoaPdf(coa, { watermark: null });
      attachment = {
        filename: `${coa.coaNumber}.pdf`,
        content: pdf,
      };
    } catch (err) {
      console.warn(
        `[coa-email] PDF render failed — sending without attachment: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // 4. Send via nodemailer if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  let messageId: string | null = null;
  let smtpUnavailable = false;

  if (!smtpHost || !smtpFrom) {
    console.warn(
      '[coa-email] SMTP_HOST or SMTP_FROM not configured — email will not be sent. ' +
        `(coaId=${input.coaId}, to=${input.recipientEmail})`,
    );
    smtpUnavailable = true;
  } else {
    try {
      const nm = await import('nodemailer');
      const port = Number(process.env.SMTP_PORT || 587);
      const secureEnv = process.env.SMTP_SECURE;
      const secure =
        secureEnv != null
          ? String(secureEnv).toLowerCase() === 'true'
          : port === 465;
      const transporter = nm.createTransport({
        host: smtpHost,
        port,
        secure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: input.recipientEmail,
        cc:
          input.ccEmails && input.ccEmails.length > 0
            ? input.ccEmails.join(', ')
            : undefined,
        subject,
        text: bodyText,
        attachments: attachment ? [attachment] : undefined,
      });
      messageId = info.messageId ?? null;
    } catch (err) {
      console.error(
        '[coa-email] sendMail failed:',
        err instanceof Error ? err.message : err,
      );
      smtpUnavailable = true;
    }
  }

  // 5. Log to print history regardless of SMTP outcome (paper trail).
  await logCoaPrint({
    coaId: input.coaId,
    printedBy: input.sentBy,
    printType: 'customer_email',
    customerEmail: input.recipientEmail,
    ipAddress: input.ipAddress,
  });

  return {
    messageId,
    deliveredAt: getNow(),
    smtpUnavailable,
  };
}

// ----------------------------------------------------------------------------
// Phase 5 — Distinct product categories (powering template productCategory SelectBox)
// ----------------------------------------------------------------------------

/**
 * List all distinct product categories from the items master so the COA
 * template editor can offer them as a picker. Returns sorted, deduplicated,
 * non-null values (free-text strings, not enum).
 */
export async function listProductCategories(): Promise<string[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .selectDistinct({ category: tables.items.category })
      .from(tables.items)
      .orderBy(asc(tables.items.category));
    const out = (rows as any[])
      .map((r) => (r.category != null ? String(r.category).trim() : ''))
      .filter((s) => s.length > 0);
    return Array.from(new Set(out));
  });
}
