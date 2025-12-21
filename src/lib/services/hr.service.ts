// HR/Personnel Management Service
// Feature: 007-hr-personnel-management

import { eq, and, like, or, sql, isNull, desc, SQL } from 'drizzle-orm';
import { getDb, useSqlite } from '../db';
import { createAuditLog } from '../audit';
import {
  sqliteHROrgUnits,
  sqliteHRPositions,
  sqliteHRJobDescriptions,
  sqliteHREmployees,
  sqliteHREmployeeAssignments,
  sqliteHRTrainingCourses,
  sqliteHRTrainingSessions,
  sqliteHRTrainingRecords,
  sqliteHRAuthorizations,
  sqliteHRDelegations,
  sqliteHRHealthRecords,
  sqliteHRAppRoles,
  sqliteHRAppPermissions,
  sqliteHRRolePermissions,
  sqliteHREmployeeRoles,
  sqliteHRNotifications,
  sqliteHRAuditLog,
  mysqlHROrgUnits,
  mysqlHRPositions,
  mysqlHRJobDescriptions,
  mysqlHREmployees,
  mysqlHREmployeeAssignments,
  mysqlHRTrainingCourses,
  mysqlHRTrainingSessions,
  mysqlHRTrainingRecords,
  mysqlHRAuthorizations,
  mysqlHRDelegations,
  mysqlHRHealthRecords,
  mysqlHRAppRoles,
  mysqlHRAppPermissions,
  mysqlHRRolePermissions,
  mysqlHREmployeeRoles,
  mysqlHRNotifications,
  mysqlHRAuditLog,
} from '../db/schema';
import type {
  OrgUnit,
  OrgUnitCreate,
  OrgUnitUpdate,
  OrgUnitTreeNode,
  Position,
  PositionCreate,
  PositionUpdate,
  PositionWithDetails,
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeSummary,
  EmployeeProfile,
  JobDescription,
  JobDescriptionCreate,
  JobDescriptionStatus,
  TrainingCourse,
  TrainingCourseCreate,
  TrainingSession,
  TrainingSessionCreate,
  TrainingSessionStatus,
  TrainingRecord,
  TrainingRecordCreate,
  TrainingRecordWithStatus,
  TrainingRecordStatus,
  TrainingResult,
  CompetencyMatrix,
  CompetencyMatrixEntry,
  Authorization,
  AuthorizationCreate,
  AuthorizationUpdate,
  AuthorizationWithDetails,
  AuthorizationType,
  AuthorizationCheckResult,
  AuthorizationScope,
  Delegation,
  DelegationCreate,
  DelegationWithDetails,
  HealthRecord,
  HealthRecordCreate,
  HealthRecordPublic,
  ExaminationType,
  FitnessStatus,
  AppRole,
  AppRoleCreate,
  AppRoleWithPermissions,
  AppPermission,
  EmployeeRole,
  EmployeeRoleCreate,
} from '@/types/hr';

// ============================================
// Helper Functions
// ============================================

function getHRTables() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isSqlite = useSqlite();
  return {
    orgUnits: isSqlite ? sqliteHROrgUnits : mysqlHROrgUnits,
    positions: isSqlite ? sqliteHRPositions : mysqlHRPositions,
    jobDescriptions: isSqlite ? sqliteHRJobDescriptions : mysqlHRJobDescriptions,
    employees: isSqlite ? sqliteHREmployees : mysqlHREmployees,
    employeeAssignments: isSqlite ? sqliteHREmployeeAssignments : mysqlHREmployeeAssignments,
    trainingCourses: isSqlite ? sqliteHRTrainingCourses : mysqlHRTrainingCourses,
    trainingSessions: isSqlite ? sqliteHRTrainingSessions : mysqlHRTrainingSessions,
    trainingRecords: isSqlite ? sqliteHRTrainingRecords : mysqlHRTrainingRecords,
    authorizations: isSqlite ? sqliteHRAuthorizations : mysqlHRAuthorizations,
    delegations: isSqlite ? sqliteHRDelegations : mysqlHRDelegations,
    healthRecords: isSqlite ? sqliteHRHealthRecords : mysqlHRHealthRecords,
    appRoles: isSqlite ? sqliteHRAppRoles : mysqlHRAppRoles,
    appPermissions: isSqlite ? sqliteHRAppPermissions : mysqlHRAppPermissions,
    rolePermissions: isSqlite ? sqliteHRRolePermissions : mysqlHRRolePermissions,
    employeeRoles: isSqlite ? sqliteHREmployeeRoles : mysqlHREmployeeRoles,
    notifications: isSqlite ? sqliteHRNotifications : mysqlHRNotifications,
    auditLog: isSqlite ? sqliteHRAuditLog : mysqlHRAuditLog,
    isSqlite,
  };
}

// GMP Compliance: QC/QA cannot be under Production
const QC_QA_CODES = ['QC', 'QA', 'QUALITY'];
const PRODUCTION_CODES = ['PROD', 'PRODUCTION', 'MFG', 'MANUFACTURING'];

async function checkSeparationOfDuties(
  orgUnitCode: string,
  parentId: number | null | undefined
): Promise<void> {
  if (!parentId) return;

  const tables = getHRTables();
  const db = await getDb();

  // Check if this is a QC/QA unit
  const isQcQa = QC_QA_CODES.some((code) =>
    orgUnitCode.toUpperCase().includes(code)
  );

  if (!isQcQa) return;

  // Check if any ancestor is Production
  let currentParentId: number | null = parentId;
  while (currentParentId) {
    const parentResult: { id: number; code: string; parentId: number | null }[] = await db
      .select({
        id: tables.orgUnits.id,
        code: tables.orgUnits.code,
        parentId: tables.orgUnits.parentId,
      })
      .from(tables.orgUnits)
      .where(eq(tables.orgUnits.id, currentParentId))
      .limit(1);

    if (parentResult.length === 0) break;

    const parentCode = parentResult[0].code.toUpperCase();
    const isProductionParent = PRODUCTION_CODES.some((code) =>
      parentCode.includes(code)
    );

    if (isProductionParent) {
      throw new Error(
        'Separation of duties violation: QC/QA units cannot report to Production'
      );
    }

    currentParentId = parentResult[0].parentId;
  }
}

// ============================================
// Organization Unit Service
// ============================================

export async function getOrgUnits(filters?: {
  type?: string;
  parentId?: number | null;
  siteId?: number;
  isActive?: boolean;
  search?: string;
}): Promise<OrgUnit[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions = [];

  if (filters?.type) {
    conditions.push(eq(tables.orgUnits.type, filters.type));
  }
  if (filters?.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push(isNull(tables.orgUnits.parentId));
    } else {
      conditions.push(eq(tables.orgUnits.parentId, filters.parentId));
    }
  }
  if (filters?.siteId) {
    conditions.push(eq(tables.orgUnits.siteId, filters.siteId));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.orgUnits.isActive, filters.isActive));
  }
  if (filters?.search) {
    conditions.push(
      or(
        like(tables.orgUnits.code, `%${filters.search}%`),
        like(tables.orgUnits.name, `%${filters.search}%`),
        like(tables.orgUnits.nameEn, `%${filters.search}%`)
      )
    );
  }

  let query = db.select().from(tables.orgUnits);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query;
  return results as unknown as OrgUnit[];
}

export async function getOrgUnitById(id: number): Promise<OrgUnit | null> {
  const tables = getHRTables();
  const db = await getDb();

  const results = await db
    .select()
    .from(tables.orgUnits)
    .where(eq(tables.orgUnits.id, id))
    .limit(1);

  return results.length > 0 ? (results[0] as unknown as OrgUnit) : null;
}

export async function getOrgUnitChildren(parentId: number): Promise<OrgUnit[]> {
  const tables = getHRTables();
  const db = await getDb();

  const results = await db
    .select()
    .from(tables.orgUnits)
    .where(
      and(
        eq(tables.orgUnits.parentId, parentId),
        eq(tables.orgUnits.isActive, true)
      )
    );

  return results as unknown as OrgUnit[];
}

export async function getOrgUnitTree(): Promise<OrgUnitTreeNode[]> {
  const orgUnits = await getOrgUnits({ isActive: true });

  // Build tree structure
  const orgUnitMap = new Map<number, OrgUnitTreeNode>();
  const rootNodes: OrgUnitTreeNode[] = [];

  // First pass: create nodes
  for (const unit of orgUnits) {
    orgUnitMap.set(unit.id, { ...unit, children: [] });
  }

  // Second pass: build tree
  for (const unit of orgUnits) {
    const node = orgUnitMap.get(unit.id)!;
    if (unit.parentId && orgUnitMap.has(unit.parentId)) {
      orgUnitMap.get(unit.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

export async function createOrgUnit(data: OrgUnitCreate): Promise<OrgUnit> {
  const tables = getHRTables();
  const db = await getDb();

  // GMP: Check separation of duties
  await checkSeparationOfDuties(data.code, data.parentId);

  // Validate hierarchy rules
  if (data.parentId) {
    const parent = await getOrgUnitById(data.parentId);
    if (!parent) {
      throw new Error('Parent organization unit not found');
    }

    // Validate type hierarchy (company > site > division > department > section > unit)
    const typeHierarchy = [
      'company',
      'site',
      'division',
      'department',
      'section',
      'unit',
    ];
    const parentTypeIndex = typeHierarchy.indexOf(parent.type);
    const childTypeIndex = typeHierarchy.indexOf(data.type);

    if (childTypeIndex <= parentTypeIndex) {
      throw new Error(
        `Invalid hierarchy: ${data.type} cannot be under ${parent.type}`
      );
    }

    // Inherit siteId from parent if not specified
    if (!data.siteId && parent.type === 'site') {
      data.siteId = parent.id;
    } else if (!data.siteId && parent.siteId) {
      data.siteId = parent.siteId;
    }
  }

  const insertData = {
    code: data.code,
    name: data.name,
    nameEn: data.nameEn || null,
    type: data.type,
    parentId: data.parentId || null,
    siteId: data.siteId || null,
    isGmpCritical: data.isGmpCritical ?? false,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || null,
    isActive: true,
  };

  const result = await db.insert(tables.orgUnits).values(insertData);

  const insertedId = tables.isSqlite
    ? (result as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_org_units',
    recordId: Number(insertedId),
    newValue: insertData as Record<string, unknown>,
  });

  return (await getOrgUnitById(Number(insertedId)))!;
}

export async function updateOrgUnit(
  id: number,
  data: OrgUnitUpdate
): Promise<OrgUnit> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getOrgUnitById(id);
  if (!existing) {
    throw new Error('Organization unit not found');
  }

  // If changing parent, validate separation of duties
  if (data.parentId !== undefined && data.parentId !== existing.parentId) {
    await checkSeparationOfDuties(existing.code, data.parentId);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.isGmpCritical !== undefined)
    updateData.isGmpCritical = data.isGmpCritical;
  if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.orgUnits)
      .set(updateData)
      .where(eq(tables.orgUnits.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_org_units',
      recordId: id,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updateData,
    });
  }

  return (await getOrgUnitById(id))!;
}

export async function deactivateOrgUnit(id: number): Promise<void> {
  const tables = getHRTables();
  const db = await getDb();

  // Check for active children
  const children = await getOrgUnits({ parentId: id, isActive: true });
  if (children.length > 0) {
    throw new Error(
      'Cannot deactivate organization unit with active children'
    );
  }

  // Check for active employees
  const employees = await getEmployees({ orgUnitId: id });
  const activeEmployees = employees.filter((e) => e.status === 'active');
  if (activeEmployees.length > 0) {
    throw new Error(
      'Cannot deactivate organization unit with active employees'
    );
  }

  const existing = await getOrgUnitById(id);

  await db
    .update(tables.orgUnits)
    .set({ isActive: false })
    .where(eq(tables.orgUnits.id, id));

  // Audit log
  await createAuditLog({
    action: 'DELETE',
    tableName: 'hr_org_units',
    recordId: id,
    oldValue: existing as unknown as Record<string, unknown>,
    newValue: { isActive: false },
  });
}

// ============================================
// Position Service
// ============================================

export async function getPositions(filters?: {
  orgUnitId?: number;
  isActive?: boolean;
  search?: string;
}): Promise<Position[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions = [];

  if (filters?.orgUnitId) {
    conditions.push(eq(tables.positions.orgUnitId, filters.orgUnitId));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.positions.isActive, filters.isActive));
  }
  if (filters?.search) {
    conditions.push(
      or(
        like(tables.positions.code, `%${filters.search}%`),
        like(tables.positions.title, `%${filters.search}%`),
        like(tables.positions.titleEn, `%${filters.search}%`)
      )
    );
  }

  let query = db.select().from(tables.positions);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query;
  return results as unknown as Position[];
}

export async function getPositionById(id: number): Promise<Position | null> {
  const tables = getHRTables();
  const db = await getDb();

  const results = await db
    .select()
    .from(tables.positions)
    .where(eq(tables.positions.id, id))
    .limit(1);

  return results.length > 0 ? (results[0] as unknown as Position) : null;
}

export async function getPositionWithDetails(
  id: number
): Promise<PositionWithDetails | null> {
  const position = await getPositionById(id);
  if (!position) return null;

  const orgUnit = position.orgUnitId
    ? await getOrgUnitById(position.orgUnitId)
    : undefined;

  // Get employee count for this position
  const employees = await getEmployees({ positionId: id });

  return {
    ...position,
    orgUnit: orgUnit || undefined,
    employeeCount: employees.length,
  };
}

export async function createPosition(data: PositionCreate): Promise<Position> {
  const tables = getHRTables();
  const db = await getDb();

  // Validate org unit exists
  const orgUnit = await getOrgUnitById(data.orgUnitId);
  if (!orgUnit) {
    throw new Error('Organization unit not found');
  }

  const insertData = {
    code: data.code,
    title: data.title,
    titleEn: data.titleEn || null,
    orgUnitId: data.orgUnitId,
    jobGrade: data.jobGrade || null,
    isGmpCritical: data.isGmpCritical ?? false,
    isActive: true,
  };

  const result = await db.insert(tables.positions).values(insertData);

  const insertedId = tables.isSqlite
    ? (result as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  const position = (await getPositionById(Number(insertedId)))!;

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_positions',
    recordId: Number(insertedId),
    newValue: insertData as unknown as Record<string, unknown>,
  });

  return position;
}

export async function updatePosition(
  id: number,
  data: PositionUpdate
): Promise<Position> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getPositionById(id);
  if (!existing) {
    throw new Error('Position not found');
  }

  // Validate org unit if changing
  if (data.orgUnitId !== undefined && data.orgUnitId !== existing.orgUnitId) {
    const orgUnit = await getOrgUnitById(data.orgUnitId);
    if (!orgUnit) {
      throw new Error('Organization unit not found');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
  if (data.orgUnitId !== undefined) updateData.orgUnitId = data.orgUnitId;
  if (data.jobGrade !== undefined) updateData.jobGrade = data.jobGrade;
  if (data.isGmpCritical !== undefined)
    updateData.isGmpCritical = data.isGmpCritical;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.positions)
      .set(updateData)
      .where(eq(tables.positions.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_positions',
      recordId: id,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updateData,
    });
  }

  return (await getPositionById(id))!;
}

// ============================================
// Employee Service
// ============================================

export async function getEmployees(filters?: {
  orgUnitId?: number;
  positionId?: number;
  siteId?: number;
  status?: string;
  search?: string;
  skip?: number;
  take?: number;
}): Promise<Employee[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions = [];

  if (filters?.orgUnitId) {
    conditions.push(eq(tables.employees.orgUnitId, filters.orgUnitId));
  }
  if (filters?.positionId) {
    conditions.push(eq(tables.employees.positionId, filters.positionId));
  }
  if (filters?.siteId) {
    conditions.push(eq(tables.employees.siteId, filters.siteId));
  }
  if (filters?.status) {
    conditions.push(eq(tables.employees.status, filters.status));
  }
  if (filters?.search) {
    conditions.push(
      or(
        like(tables.employees.employeeCode, `%${filters.search}%`),
        like(tables.employees.firstName, `%${filters.search}%`),
        like(tables.employees.lastName, `%${filters.search}%`),
        like(tables.employees.email, `%${filters.search}%`)
      )
    );
  }

  let query = db.select().from(tables.employees);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Pagination
  const skip = filters?.skip || 0;
  const take = filters?.take || 100;
  query = query.limit(take).offset(skip) as typeof query;

  const results = await query;
  return results as unknown as Employee[];
}

export async function getEmployeeById(id: number): Promise<Employee | null> {
  const tables = getHRTables();
  const db = await getDb();

  const results = await db
    .select()
    .from(tables.employees)
    .where(eq(tables.employees.id, id))
    .limit(1);

  return results.length > 0 ? (results[0] as unknown as Employee) : null;
}

export async function getEmployeeProfile(
  id: number
): Promise<EmployeeProfile | null> {
  const employee = await getEmployeeById(id);
  if (!employee) return null;

  const position = employee.positionId
    ? await getPositionById(employee.positionId)
    : undefined;

  const orgUnit = employee.orgUnitId
    ? await getOrgUnitById(employee.orgUnitId)
    : undefined;

  // Get authorizations
  const tables = getHRTables();
  const db = await getDb();
  const authorizations = await db
    .select()
    .from(tables.authorizations)
    .where(
      and(
        eq(tables.authorizations.employeeId, id),
        eq(tables.authorizations.isActive, true)
      )
    );

  return {
    ...employee,
    position: position || undefined,
    orgUnit: orgUnit || undefined,
    authorizations: authorizations as unknown as EmployeeProfile['authorizations'],
  };
}

export async function createEmployee(data: EmployeeCreate): Promise<Employee> {
  const tables = getHRTables();
  const db = await getDb();

  // Check for duplicate employee code
  const existing = await db
    .select()
    .from(tables.employees)
    .where(eq(tables.employees.employeeCode, data.employeeCode))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Employee code already exists');
  }

  const insertData = {
    userId: data.userId || null,
    employeeCode: data.employeeCode,
    firstName: data.firstName,
    lastName: data.lastName,
    firstNameEn: data.firstNameEn || null,
    lastNameEn: data.lastNameEn || null,
    email: data.email || null,
    phone: data.phone || null,
    positionId: data.positionId || null,
    orgUnitId: data.orgUnitId || null,
    siteId: data.siteId || null,
    hireDate: data.hireDate,
    status: 'active',
  };

  const result = await db.insert(tables.employees).values(insertData);

  const insertedId = tables.isSqlite
    ? (result as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  const employee = (await getEmployeeById(Number(insertedId)))!;

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_employees',
    recordId: Number(insertedId),
    newValue: insertData as unknown as Record<string, unknown>,
  });

  return employee;
}

export async function updateEmployee(
  id: number,
  data: EmployeeUpdate
): Promise<Employee> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getEmployeeById(id);
  if (!existing) {
    throw new Error('Employee not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.firstNameEn !== undefined) updateData.firstNameEn = data.firstNameEn;
  if (data.lastNameEn !== undefined) updateData.lastNameEn = data.lastNameEn;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.positionId !== undefined) updateData.positionId = data.positionId;
  if (data.orgUnitId !== undefined) updateData.orgUnitId = data.orgUnitId;
  if (data.siteId !== undefined) updateData.siteId = data.siteId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.terminationDate !== undefined)
    updateData.terminationDate = data.terminationDate;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.employees)
      .set(updateData)
      .where(eq(tables.employees.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_employees',
      recordId: id,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updateData,
    });
  }

  return (await getEmployeeById(id))!;
}

export async function getEmployeeSummaries(
  employeeIds: number[]
): Promise<EmployeeSummary[]> {
  if (employeeIds.length === 0) return [];

  const employees = await Promise.all(
    employeeIds.map((id) => getEmployeeById(id))
  );

  return employees
    .filter((e): e is Employee => e !== null)
    .map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      fullName: `${e.firstName} ${e.lastName}`,
      status: e.status as EmployeeSummary['status'],
    }));
}

// ============================================
// Employee Count Helpers
// ============================================

export async function getEmployeeCountByOrgUnit(
  orgUnitId: number
): Promise<number> {
  const tables = getHRTables();
  const db = await getDb();

  const result = await db
    .select({ count: sql`count(*)` })
    .from(tables.employees)
    .where(
      and(
        eq(tables.employees.orgUnitId, orgUnitId),
        eq(tables.employees.status, 'active')
      )
    );

  return Number(result[0]?.count || 0);
}

export async function getEmployeeCountByPosition(
  positionId: number
): Promise<number> {
  const tables = getHRTables();
  const db = await getDb();

  const result = await db
    .select({ count: sql`count(*)` })
    .from(tables.employees)
    .where(
      and(
        eq(tables.employees.positionId, positionId),
        eq(tables.employees.status, 'active')
      )
    );

  return Number(result[0]?.count || 0);
}

// ============================================
// Employee Assignment Service
// ============================================

export interface EmployeeAssignmentWithDetails {
  id: number;
  employeeId: number;
  positionId: number | null;
  orgUnitId: number | null;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  createdAt: string;
  positionTitle?: string;
  orgUnitName?: string;
}

export async function getEmployeeAssignments(
  employeeId: number
): Promise<EmployeeAssignmentWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const assignments = await db
    .select()
    .from(tables.employeeAssignments)
    .where(eq(tables.employeeAssignments.employeeId, employeeId))
    .orderBy(desc(tables.employeeAssignments.effectiveFrom));

  // Enrich with position and org unit names
  const enrichedAssignments = await Promise.all(
    (assignments as unknown as EmployeeAssignmentWithDetails[]).map(
      async (assignment) => {
        let positionTitle: string | undefined;
        let orgUnitName: string | undefined;

        if (assignment.positionId) {
          const position = await getPositionById(assignment.positionId);
          positionTitle = position?.title;
        }

        if (assignment.orgUnitId) {
          const orgUnit = await getOrgUnitById(assignment.orgUnitId);
          orgUnitName = orgUnit?.name;
        }

        return {
          ...assignment,
          positionTitle,
          orgUnitName,
        };
      }
    )
  );

  return enrichedAssignments;
}

export async function createEmployeeAssignment(data: {
  employeeId: number;
  positionId?: number;
  orgUnitId?: number;
  isPrimary?: boolean;
  effectiveFrom: string;
  reason?: string;
}): Promise<EmployeeAssignmentWithDetails> {
  const tables = getHRTables();
  const db = await getDb();

  // If marking as primary, set other assignments to non-primary
  if (data.isPrimary) {
    await db
      .update(tables.employeeAssignments)
      .set({ isPrimary: false })
      .where(eq(tables.employeeAssignments.employeeId, data.employeeId));
  }

  const insertData = {
    employeeId: data.employeeId,
    positionId: data.positionId || null,
    orgUnitId: data.orgUnitId || null,
    isPrimary: data.isPrimary ?? true,
    effectiveFrom: data.effectiveFrom,
    reason: data.reason || null,
  };

  const result = await db
    .insert(tables.employeeAssignments)
    .values(insertData);

  const insertedId = tables.isSqlite
    ? (result as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  // Get the created assignment
  const assignments = await getEmployeeAssignments(data.employeeId);
  return assignments.find((a) => a.id === Number(insertedId))!;
}

// ============================================
// Job Description Service
// ============================================

export async function getJobDescriptions(filters?: {
  positionId?: number;
  status?: JobDescriptionStatus;
}): Promise<JobDescription[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions = [];

  if (filters?.positionId) {
    conditions.push(eq(tables.jobDescriptions.positionId, filters.positionId));
  }
  if (filters?.status) {
    conditions.push(eq(tables.jobDescriptions.status, filters.status));
  }

  let query = db.select().from(tables.jobDescriptions);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query.orderBy(desc(tables.jobDescriptions.createdAt));
  return results as unknown as JobDescription[];
}

export async function getJobDescriptionById(id: number): Promise<JobDescription | null> {
  const tables = getHRTables();
  const db = await getDb();

  const results = await db
    .select()
    .from(tables.jobDescriptions)
    .where(eq(tables.jobDescriptions.id, id))
    .limit(1);

  return results.length > 0 ? (results[0] as unknown as JobDescription) : null;
}

export async function getCurrentJobDescription(positionId: number): Promise<JobDescription | null> {
  const tables = getHRTables();
  const db = await getDb();

  // Get the most recent approved JD for this position
  const results = await db
    .select()
    .from(tables.jobDescriptions)
    .where(
      and(
        eq(tables.jobDescriptions.positionId, positionId),
        eq(tables.jobDescriptions.status, 'approved')
      )
    )
    .orderBy(desc(tables.jobDescriptions.effectiveFrom))
    .limit(1);

  return results.length > 0 ? (results[0] as unknown as JobDescription) : null;
}

export async function getNextJDVersion(positionId: number): Promise<string> {
  const tables = getHRTables();
  const db = await getDb();

  // Get all JDs for this position to determine next version
  const existing = await db
    .select({ version: tables.jobDescriptions.version })
    .from(tables.jobDescriptions)
    .where(eq(tables.jobDescriptions.positionId, positionId))
    .orderBy(desc(tables.jobDescriptions.version));

  if (existing.length === 0) {
    return '1.0';
  }

  // Parse current highest version and increment
  const currentVersion = existing[0].version;
  const parts = currentVersion.split('.');
  const major = parseInt(parts[0], 10) || 1;
  const minor = parseInt(parts[1], 10) || 0;

  return `${major}.${minor + 1}`;
}

export async function createJobDescription(data: JobDescriptionCreate): Promise<JobDescription> {
  const tables = getHRTables();
  const db = await getDb();

  // Validate position exists
  const position = await getPositionById(data.positionId);
  if (!position) {
    throw new Error('Position not found');
  }

  // Auto-generate version if not provided
  const version = data.version || await getNextJDVersion(data.positionId);

  const insertData = {
    positionId: data.positionId,
    version,
    responsibilities: data.responsibilities || null,
    authorities: data.authorities || null,
    qualifications: data.qualifications || null,
    documentPath: data.documentPath || null,
    status: 'draft' as const,
    effectiveFrom: null,
    effectiveTo: null,
    approvedBy: null,
    approvedAt: null,
  };

  const result = await db.insert(tables.jobDescriptions).values(insertData);

  const insertedId = tables.isSqlite
    ? (result as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  const jd = (await getJobDescriptionById(Number(insertedId)))!;

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_job_descriptions',
    recordId: Number(insertedId),
    newValue: insertData as unknown as Record<string, unknown>,
  });

  return jd;
}

export async function updateJobDescription(
  id: number,
  data: Partial<JobDescriptionCreate>
): Promise<JobDescription> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getJobDescriptionById(id);
  if (!existing) {
    throw new Error('Job description not found');
  }

  // Only allow updates to draft JDs
  if (existing.status !== 'draft') {
    throw new Error('Can only update draft job descriptions');
  }

  const updateData: Record<string, unknown> = {};
  if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
  if (data.authorities !== undefined) updateData.authorities = data.authorities;
  if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
  if (data.documentPath !== undefined) updateData.documentPath = data.documentPath;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.jobDescriptions)
      .set(updateData)
      .where(eq(tables.jobDescriptions.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_job_descriptions',
      recordId: id,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updateData,
    });
  }

  return (await getJobDescriptionById(id))!;
}

export async function submitJobDescriptionForApproval(id: number): Promise<JobDescription> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getJobDescriptionById(id);
  if (!existing) {
    throw new Error('Job description not found');
  }

  if (existing.status !== 'draft') {
    throw new Error('Only draft job descriptions can be submitted for approval');
  }

  await db
    .update(tables.jobDescriptions)
    .set({ status: 'pending_approval' })
    .where(eq(tables.jobDescriptions.id, id));

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_job_descriptions',
    recordId: id,
    oldValue: { status: existing.status },
    newValue: { status: 'pending_approval' },
  });

  return (await getJobDescriptionById(id))!;
}

export async function approveJobDescription(
  id: number,
  approverId: number,
  effectiveFrom: string
): Promise<JobDescription> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getJobDescriptionById(id);
  if (!existing) {
    throw new Error('Job description not found');
  }

  if (existing.status !== 'pending_approval') {
    throw new Error('Only pending job descriptions can be approved');
  }

  // Mark previous approved JDs as obsolete
  await db
    .update(tables.jobDescriptions)
    .set({
      status: 'obsolete',
      effectiveTo: effectiveFrom,
    })
    .where(
      and(
        eq(tables.jobDescriptions.positionId, existing.positionId),
        eq(tables.jobDescriptions.status, 'approved')
      )
    );

  // Approve current JD
  const now = new Date().toISOString();
  await db
    .update(tables.jobDescriptions)
    .set({
      status: 'approved',
      effectiveFrom,
      approvedBy: approverId,
      approvedAt: now,
    })
    .where(eq(tables.jobDescriptions.id, id));

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_job_descriptions',
    recordId: id,
    oldValue: { status: existing.status },
    newValue: {
      status: 'approved',
      effectiveFrom,
      approvedBy: approverId,
      approvedAt: now,
    },
  });

  return (await getJobDescriptionById(id))!;
}

export async function rejectJobDescription(id: number): Promise<JobDescription> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getJobDescriptionById(id);
  if (!existing) {
    throw new Error('Job description not found');
  }

  if (existing.status !== 'pending_approval') {
    throw new Error('Only pending job descriptions can be rejected');
  }

  // Reset back to draft
  await db
    .update(tables.jobDescriptions)
    .set({ status: 'draft' })
    .where(eq(tables.jobDescriptions.id, id));

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_job_descriptions',
    recordId: id,
    oldValue: { status: existing.status },
    newValue: { status: 'draft' },
  });

  return (await getJobDescriptionById(id))!;
}

// ============================================
// Training Course Functions (T056)
// ============================================

export interface TrainingCourseFilters {
  category?: string;
  isMandatory?: boolean;
  isActive?: boolean;
  search?: string;
}

export async function getTrainingCourses(
  filters?: TrainingCourseFilters
): Promise<TrainingCourse[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];

  if (filters?.category) {
    conditions.push(eq(tables.trainingCourses.category, filters.category));
  }
  if (filters?.isMandatory !== undefined) {
    conditions.push(eq(tables.trainingCourses.isMandatory, filters.isMandatory));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.trainingCourses.isActive, filters.isActive));
  }
  if (filters?.search) {
    conditions.push(
      or(
        sql`${tables.trainingCourses.code} LIKE ${'%' + filters.search + '%'}`,
        sql`${tables.trainingCourses.name} LIKE ${'%' + filters.search + '%'}`,
        sql`${tables.trainingCourses.nameEn} LIKE ${'%' + filters.search + '%'}`
      )!
    );
  }

  const courses = await db
    .select()
    .from(tables.trainingCourses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tables.trainingCourses.name);

  return courses as TrainingCourse[];
}

export async function getTrainingCourseById(
  id: number
): Promise<TrainingCourse | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [course] = await db
    .select()
    .from(tables.trainingCourses)
    .where(eq(tables.trainingCourses.id, id));

  return course as TrainingCourse | null;
}

export async function createTrainingCourse(
  data: TrainingCourseCreate
): Promise<TrainingCourse> {
  const tables = getHRTables();
  const db = await getDb();

  const insertData = {
    code: data.code,
    name: data.name,
    nameEn: data.nameEn || null,
    description: data.description || null,
    category: data.category || null,
    validityDays: data.validityDays || null,
    isMandatory: data.isMandatory ?? false,
    targetPositions: data.targetPositions ? JSON.stringify(data.targetPositions) : null,
    durationHours: data.durationHours || null,
    isActive: true,
  };

  const result = await db.insert(tables.trainingCourses).values(insertData);
  const id = useSqlite() ? Number(result.lastInsertRowid) : Number(result[0].insertId);

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_training_courses',
    recordId: id,
    newValue: insertData,
  });

  return (await getTrainingCourseById(id))!;
}

export async function updateTrainingCourse(
  id: number,
  data: Partial<TrainingCourseCreate>
): Promise<TrainingCourse> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getTrainingCourseById(id);
  if (!existing) {
    throw new Error('Training course not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn || null;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.category !== undefined) updateData.category = data.category || null;
  if (data.validityDays !== undefined) updateData.validityDays = data.validityDays || null;
  if (data.isMandatory !== undefined) updateData.isMandatory = data.isMandatory;
  if (data.targetPositions !== undefined) {
    updateData.targetPositions = data.targetPositions ? JSON.stringify(data.targetPositions) : null;
  }
  if (data.durationHours !== undefined) updateData.durationHours = data.durationHours || null;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.trainingCourses)
      .set(updateData)
      .where(eq(tables.trainingCourses.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_training_courses',
      recordId: id,
      oldValue: existing,
      newValue: updateData,
    });
  }

  return (await getTrainingCourseById(id))!;
}

export async function deactivateTrainingCourse(id: number): Promise<TrainingCourse> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getTrainingCourseById(id);
  if (!existing) {
    throw new Error('Training course not found');
  }

  await db
    .update(tables.trainingCourses)
    .set({ isActive: false })
    .where(eq(tables.trainingCourses.id, id));

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_training_courses',
    recordId: id,
    oldValue: { isActive: true },
    newValue: { isActive: false },
  });

  return (await getTrainingCourseById(id))!;
}

// ============================================
// Training Session Functions (T057)
// ============================================

export interface TrainingSessionWithDetails extends TrainingSession {
  courseName?: string;
  courseCode?: string;
  instructorName?: string;
  participantCount?: number;
}

export interface TrainingSessionFilters {
  courseId?: number;
  status?: TrainingSessionStatus;
  instructorId?: number;
  fromDate?: string;
  toDate?: string;
}

export async function getTrainingSessions(
  filters?: TrainingSessionFilters
): Promise<TrainingSessionWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];

  if (filters?.courseId) {
    conditions.push(eq(tables.trainingSessions.courseId, filters.courseId));
  }
  if (filters?.status) {
    conditions.push(eq(tables.trainingSessions.status, filters.status));
  }
  if (filters?.instructorId) {
    conditions.push(eq(tables.trainingSessions.instructorId, filters.instructorId));
  }
  if (filters?.fromDate) {
    conditions.push(sql`${tables.trainingSessions.sessionDate} >= ${filters.fromDate}`);
  }
  if (filters?.toDate) {
    conditions.push(sql`${tables.trainingSessions.sessionDate} <= ${filters.toDate}`);
  }

  const sessions = await db
    .select()
    .from(tables.trainingSessions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tables.trainingSessions.sessionDate));

  // Enrich with course and instructor details
  const enriched: TrainingSessionWithDetails[] = [];
  for (const session of sessions) {
    const course = await getTrainingCourseById(session.courseId);
    let instructorName: string | undefined;
    if (session.instructorId) {
      const instructor = await getEmployeeById(session.instructorId);
      instructorName = instructor ? `${instructor.firstName} ${instructor.lastName}` : undefined;
    } else if (session.instructorExternal) {
      instructorName = session.instructorExternal;
    }

    // Count participants
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tables.trainingRecords)
      .where(eq(tables.trainingRecords.sessionId, session.id));

    enriched.push({
      ...session,
      courseName: course?.name,
      courseCode: course?.code,
      instructorName,
      participantCount: Number(countResult?.count || 0),
    } as TrainingSessionWithDetails);
  }

  return enriched;
}

export async function getTrainingSessionById(
  id: number
): Promise<TrainingSessionWithDetails | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [session] = await db
    .select()
    .from(tables.trainingSessions)
    .where(eq(tables.trainingSessions.id, id));

  if (!session) return null;

  const course = await getTrainingCourseById(session.courseId);
  let instructorName: string | undefined;
  if (session.instructorId) {
    const instructor = await getEmployeeById(session.instructorId);
    instructorName = instructor ? `${instructor.firstName} ${instructor.lastName}` : undefined;
  } else if (session.instructorExternal) {
    instructorName = session.instructorExternal;
  }

  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tables.trainingRecords)
    .where(eq(tables.trainingRecords.sessionId, session.id));

  return {
    ...session,
    courseName: course?.name,
    courseCode: course?.code,
    instructorName,
    participantCount: Number(countResult?.count || 0),
  } as TrainingSessionWithDetails;
}

export async function createTrainingSession(
  data: TrainingSessionCreate
): Promise<TrainingSession> {
  const tables = getHRTables();
  const db = await getDb();

  // Verify course exists
  const course = await getTrainingCourseById(data.courseId);
  if (!course) {
    throw new Error('Training course not found');
  }

  const insertData = {
    courseId: data.courseId,
    sessionDate: data.sessionDate,
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    location: data.location || null,
    instructorId: data.instructorId || null,
    instructorExternal: data.instructorExternal || null,
    maxParticipants: data.maxParticipants || null,
    status: 'scheduled' as const,
    notes: null,
  };

  const result = await db.insert(tables.trainingSessions).values(insertData);
  const id = useSqlite() ? Number(result.lastInsertRowid) : Number(result[0].insertId);

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_training_sessions',
    recordId: id,
    newValue: insertData,
  });

  return (await getTrainingSessionById(id)) as TrainingSession;
}

export async function updateTrainingSession(
  id: number,
  data: Partial<TrainingSessionCreate & { status?: TrainingSessionStatus; notes?: string }>
): Promise<TrainingSession> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getTrainingSessionById(id);
  if (!existing) {
    throw new Error('Training session not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.sessionDate !== undefined) updateData.sessionDate = data.sessionDate;
  if (data.startTime !== undefined) updateData.startTime = data.startTime || null;
  if (data.endTime !== undefined) updateData.endTime = data.endTime || null;
  if (data.location !== undefined) updateData.location = data.location || null;
  if (data.instructorId !== undefined) updateData.instructorId = data.instructorId || null;
  if (data.instructorExternal !== undefined) updateData.instructorExternal = data.instructorExternal || null;
  if (data.maxParticipants !== undefined) updateData.maxParticipants = data.maxParticipants || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.trainingSessions)
      .set(updateData)
      .where(eq(tables.trainingSessions.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_training_sessions',
      recordId: id,
      oldValue: existing,
      newValue: updateData,
    });
  }

  return (await getTrainingSessionById(id)) as TrainingSession;
}

export async function cancelTrainingSession(id: number): Promise<TrainingSession> {
  return updateTrainingSession(id, { status: 'cancelled' });
}

export async function completeTrainingSession(id: number): Promise<TrainingSession> {
  return updateTrainingSession(id, { status: 'completed' });
}

// ============================================
// Training Record Functions (T058)
// ============================================

export interface TrainingRecordFilters {
  employeeId?: number;
  courseId?: number;
  sessionId?: number;
  result?: TrainingResult;
  status?: TrainingRecordStatus;
}

/**
 * Calculate training record status based on expiry date
 */
export function calculateTrainingStatus(expiryDate: string | null): TrainingRecordStatus {
  if (!expiryDate) {
    return 'valid'; // No expiry means always valid
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry < now) {
    return 'expired';
  } else if (expiry <= thirtyDaysFromNow) {
    return 'expiring_soon';
  }
  return 'valid';
}

/**
 * Calculate expiry date based on course validity and completion date
 */
export function calculateExpiryDate(
  completionDate: string,
  validityDays: number | null
): string | null {
  if (!validityDays) return null;

  const expiry = new Date(completionDate);
  expiry.setDate(expiry.getDate() + validityDays);
  return expiry.toISOString().split('T')[0];
}

export async function getTrainingRecords(
  filters?: TrainingRecordFilters
): Promise<TrainingRecordWithStatus[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];

  if (filters?.employeeId) {
    conditions.push(eq(tables.trainingRecords.employeeId, filters.employeeId));
  }
  if (filters?.courseId) {
    conditions.push(eq(tables.trainingRecords.courseId, filters.courseId));
  }
  if (filters?.sessionId) {
    conditions.push(eq(tables.trainingRecords.sessionId, filters.sessionId));
  }
  if (filters?.result) {
    conditions.push(eq(tables.trainingRecords.result, filters.result));
  }

  const records = await db
    .select()
    .from(tables.trainingRecords)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tables.trainingRecords.completionDate));

  // Enrich with course and employee details
  const enriched: TrainingRecordWithStatus[] = [];
  for (const record of records) {
    const course = await getTrainingCourseById(record.courseId);
    const employee = await getEmployeeById(record.employeeId);
    const status = calculateTrainingStatus(record.expiryDate);

    // Filter by status if provided
    if (filters?.status && status !== filters.status) {
      continue;
    }

    enriched.push({
      ...record,
      status,
      courseName: course?.name,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
    } as TrainingRecordWithStatus);
  }

  return enriched;
}

export async function getTrainingRecordById(
  id: number
): Promise<TrainingRecordWithStatus | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [record] = await db
    .select()
    .from(tables.trainingRecords)
    .where(eq(tables.trainingRecords.id, id));

  if (!record) return null;

  const course = await getTrainingCourseById(record.courseId);
  const employee = await getEmployeeById(record.employeeId);
  const status = calculateTrainingStatus(record.expiryDate);

  return {
    ...record,
    status,
    courseName: course?.name,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
  } as TrainingRecordWithStatus;
}

export async function createTrainingRecord(
  data: TrainingRecordCreate
): Promise<TrainingRecord> {
  const tables = getHRTables();
  const db = await getDb();

  // Verify employee exists
  const employee = await getEmployeeById(data.employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Verify course exists and get validity days
  const course = await getTrainingCourseById(data.courseId);
  if (!course) {
    throw new Error('Training course not found');
  }

  // Calculate expiry date if course has validity
  const expiryDate = calculateExpiryDate(data.completionDate, course.validityDays);

  const insertData = {
    employeeId: data.employeeId,
    sessionId: data.sessionId || null,
    courseId: data.courseId,
    completionDate: data.completionDate,
    expiryDate,
    result: data.result,
    score: data.score || null,
    assessedBy: data.assessedBy || null,
    certificateNumber: data.certificateNumber || null,
    notes: data.notes || null,
  };

  const result = await db.insert(tables.trainingRecords).values(insertData);
  const id = useSqlite() ? Number(result.lastInsertRowid) : Number(result[0].insertId);

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_training_records',
    recordId: id,
    newValue: {
      ...insertData,
      courseName: course.name,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    },
  });

  return (await getTrainingRecordById(id)) as TrainingRecord;
}

export async function updateTrainingRecord(
  id: number,
  data: Partial<TrainingRecordCreate>
): Promise<TrainingRecord> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getTrainingRecordById(id);
  if (!existing) {
    throw new Error('Training record not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.completionDate !== undefined) {
    updateData.completionDate = data.completionDate;
    // Recalculate expiry if completion date changes
    const course = await getTrainingCourseById(existing.courseId);
    if (course) {
      updateData.expiryDate = calculateExpiryDate(data.completionDate, course.validityDays);
    }
  }
  if (data.result !== undefined) updateData.result = data.result;
  if (data.score !== undefined) updateData.score = data.score || null;
  if (data.assessedBy !== undefined) updateData.assessedBy = data.assessedBy || null;
  if (data.certificateNumber !== undefined) updateData.certificateNumber = data.certificateNumber || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(tables.trainingRecords)
      .set(updateData)
      .where(eq(tables.trainingRecords.id, id));

    // Audit log
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'hr_training_records',
      recordId: id,
      oldValue: existing,
      newValue: updateData,
    });
  }

  return (await getTrainingRecordById(id)) as TrainingRecord;
}

// ============================================
// Competency Matrix Functions (T059)
// ============================================

/**
 * Get competency matrix for an employee showing all required training and status
 */
export async function getEmployeeCompetencyMatrix(
  employeeId: number
): Promise<CompetencyMatrix | null> {
  const tables = getHRTables();
  const db = await getDb();

  const employee = await getEmployeeById(employeeId);
  if (!employee) return null;

  // Get all active courses
  const courses = await getTrainingCourses({ isActive: true });

  // Get all training records for this employee
  const records = await getTrainingRecords({ employeeId });

  // Build competency entries
  const courseEntries: CompetencyMatrixEntry[] = [];

  for (const course of courses) {
    // Check if course is required for this employee's position
    let isRequired = course.isMandatory;
    if (!isRequired && course.targetPositions && employee.positionId) {
      try {
        const targetPositions = JSON.parse(course.targetPositions) as number[];
        isRequired = targetPositions.includes(employee.positionId);
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Find the most recent record for this course
    const courseRecords = records.filter((r) => r.courseId === course.id && r.result === 'pass');
    const latestRecord = courseRecords[0]; // Already sorted by date desc

    let status: TrainingRecordStatus;
    if (!latestRecord) {
      status = 'not_taken';
    } else {
      status = latestRecord.status;
    }

    courseEntries.push({
      courseId: course.id,
      courseName: course.name,
      isRequired,
      status,
      expiryDate: latestRecord?.expiryDate || null,
      lastCompletionDate: latestRecord?.completionDate || null,
    });
  }

  return {
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    courses: courseEntries,
  };
}

/**
 * Get competency matrix for multiple employees (for grid display)
 */
export async function getCompetencyMatrixGrid(
  employeeIds?: number[],
  courseIds?: number[]
): Promise<CompetencyMatrix[]> {
  const tables = getHRTables();
  const db = await getDb();

  // Get employees
  let employees: Employee[];
  if (employeeIds && employeeIds.length > 0) {
    employees = [];
    for (const id of employeeIds) {
      const emp = await getEmployeeById(id);
      if (emp) employees.push(emp);
    }
  } else {
    employees = await getEmployees({ status: 'active' });
  }

  // Build matrix for each employee
  const matrices: CompetencyMatrix[] = [];
  for (const employee of employees) {
    const matrix = await getEmployeeCompetencyMatrix(employee.id);
    if (matrix) {
      // Filter courses if specific IDs requested
      if (courseIds && courseIds.length > 0) {
        matrix.courses = matrix.courses.filter((c) => courseIds.includes(c.courseId));
      }
      matrices.push(matrix);
    }
  }

  return matrices;
}

// ============================================
// Training Expiration Check (T060)
// ============================================

export interface ExpiringTrainingRecord {
  recordId: number;
  employeeId: number;
  employeeName: string;
  employeeEmail?: string | null;
  courseId: number;
  courseName: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

/**
 * Get training records that are expiring within specified days
 */
export async function getExpiringTrainingRecords(
  withinDays: number = 30
): Promise<ExpiringTrainingRecord[]> {
  const tables = getHRTables();
  const db = await getDb();

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + withinDays);

  // Get all records with expiry dates
  const records = await db
    .select()
    .from(tables.trainingRecords)
    .where(
      and(
        sql`${tables.trainingRecords.expiryDate} IS NOT NULL`,
        sql`${tables.trainingRecords.expiryDate} >= ${now.toISOString().split('T')[0]}`,
        sql`${tables.trainingRecords.expiryDate} <= ${futureDate.toISOString().split('T')[0]}`,
        eq(tables.trainingRecords.result, 'pass')
      )
    );

  const expiring: ExpiringTrainingRecord[] = [];

  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    const course = await getTrainingCourseById(record.courseId);

    if (employee && course && record.expiryDate) {
      const expiryDate = new Date(record.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      expiring.push({
        recordId: record.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeEmail: employee.email,
        courseId: course.id,
        courseName: course.name,
        expiryDate: record.expiryDate,
        daysUntilExpiry,
      });
    }
  }

  // Sort by expiry date ascending
  return expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Get expired training records
 */
export async function getExpiredTrainingRecords(): Promise<ExpiringTrainingRecord[]> {
  const tables = getHRTables();
  const db = await getDb();

  const now = new Date().toISOString().split('T')[0];

  // Get all expired records
  const records = await db
    .select()
    .from(tables.trainingRecords)
    .where(
      and(
        sql`${tables.trainingRecords.expiryDate} IS NOT NULL`,
        sql`${tables.trainingRecords.expiryDate} < ${now}`,
        eq(tables.trainingRecords.result, 'pass')
      )
    );

  const expired: ExpiringTrainingRecord[] = [];
  const today = new Date();

  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    const course = await getTrainingCourseById(record.courseId);

    if (employee && course && record.expiryDate) {
      const expiryDate = new Date(record.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expired.push({
        recordId: record.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeEmail: employee.email,
        courseId: course.id,
        courseName: course.name,
        expiryDate: record.expiryDate,
        daysUntilExpiry, // Will be negative
      });
    }
  }

  return expired.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Check if employee has valid training for a specific course
 */
export async function hasValidTraining(
  employeeId: number,
  courseId: number
): Promise<boolean> {
  const records = await getTrainingRecords({ employeeId, courseId, result: 'pass' });
  return records.some((r) => r.status === 'valid' || r.status === 'expiring_soon');
}

// ============================================
// Authorization Service (T070-T072)
// ============================================

interface AuthorizationFilters {
  employeeId?: number;
  authType?: AuthorizationType;
  scopeSiteId?: number;
  scopeOrgUnitId?: number;
  isActive?: boolean;
  includeExpired?: boolean;
}

// In-memory cache for authorization checks (<200ms requirement)
const authorizationCache = new Map<string, { result: AuthorizationCheckResult; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(employeeId: number, authType: AuthorizationType, scope?: AuthorizationScope): string {
  return `${employeeId}:${authType}:${scope?.siteId || ''}:${scope?.orgUnitId || ''}:${scope?.productLine || ''}`;
}

function clearAuthorizationCache(employeeId?: number): void {
  if (employeeId) {
    // Clear only entries for specific employee
    for (const key of authorizationCache.keys()) {
      if (key.startsWith(`${employeeId}:`)) {
        authorizationCache.delete(key);
      }
    }
  } else {
    authorizationCache.clear();
  }
}

/**
 * Get authorizations with filters
 */
export async function getAuthorizations(
  filters?: AuthorizationFilters
): Promise<AuthorizationWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];
  const now = new Date().toISOString().split('T')[0];

  if (filters?.employeeId) {
    conditions.push(eq(tables.authorizations.employeeId, filters.employeeId));
  }

  if (filters?.authType) {
    conditions.push(eq(tables.authorizations.authType, filters.authType));
  }

  if (filters?.scopeSiteId) {
    conditions.push(eq(tables.authorizations.scopeSiteId, filters.scopeSiteId));
  }

  if (filters?.scopeOrgUnitId) {
    conditions.push(eq(tables.authorizations.scopeOrgUnitId, filters.scopeOrgUnitId));
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.authorizations.isActive, filters.isActive));
  }

  if (!filters?.includeExpired) {
    // Only get non-expired authorizations
    conditions.push(
      or(
        isNull(tables.authorizations.effectiveTo),
        sql`${tables.authorizations.effectiveTo} >= ${now}`
      )!
    );
  }

  const query = conditions.length > 0
    ? db.select().from(tables.authorizations).where(and(...conditions))
    : db.select().from(tables.authorizations);

  const authorizations = await query.orderBy(desc(tables.authorizations.createdAt));

  // Enrich with details
  const enriched: AuthorizationWithDetails[] = [];
  for (const auth of authorizations) {
    const employee = await getEmployeeById(auth.employeeId);
    const delegations = await getDelegations({ authorizationId: auth.id });

    enriched.push({
      ...auth,
      authType: auth.authType as AuthorizationType,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
      delegations,
    });
  }

  return enriched;
}

/**
 * Get authorization by ID
 */
export async function getAuthorizationById(id: number): Promise<AuthorizationWithDetails | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [authorization] = await db
    .select()
    .from(tables.authorizations)
    .where(eq(tables.authorizations.id, id))
    .limit(1);

  if (!authorization) return null;

  const employee = await getEmployeeById(authorization.employeeId);
  const delegations = await getDelegations({ authorizationId: id });

  return {
    ...authorization,
    authType: authorization.authType as AuthorizationType,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
    delegations,
  };
}

/**
 * Create a new authorization
 */
export async function createAuthorization(
  data: AuthorizationCreate,
  grantedBy: number
): Promise<Authorization> {
  const tables = getHRTables();
  const db = await getDb();

  const now = new Date().toISOString();

  const insertData = {
    employeeId: data.employeeId,
    authType: data.authType,
    scopeSiteId: data.scopeSiteId || null,
    scopeOrgUnitId: data.scopeOrgUnitId || null,
    scopeProductLines: data.scopeProductLines ? JSON.stringify(data.scopeProductLines) : null,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || null,
    grantedBy,
    grantedAt: now,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const [result] = await db.insert(tables.authorizations).values(insertData).returning();

  // Clear cache for this employee
  clearAuthorizationCache(data.employeeId);

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_authorizations',
    recordId: result.id,
    newValue: insertData,
  });

  return {
    ...result,
    authType: result.authType as AuthorizationType,
  };
}

/**
 * Update authorization
 */
export async function updateAuthorization(
  id: number,
  data: AuthorizationUpdate
): Promise<Authorization> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getAuthorizationById(id);
  if (!existing) {
    throw new Error('Authorization not found');
  }

  const updateData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const [result] = await db
    .update(tables.authorizations)
    .set(updateData)
    .where(eq(tables.authorizations.id, id))
    .returning();

  // Clear cache for this employee
  clearAuthorizationCache(existing.employeeId);

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_authorizations',
    recordId: id,
    oldValue: { isActive: existing.isActive, effectiveTo: existing.effectiveTo },
    newValue: { isActive: result.isActive, effectiveTo: result.effectiveTo },
  });

  return {
    ...result,
    authType: result.authType as AuthorizationType,
  };
}

/**
 * Revoke authorization
 */
export async function revokeAuthorization(
  id: number,
  revokedBy: number
): Promise<Authorization> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getAuthorizationById(id);
  if (!existing) {
    throw new Error('Authorization not found');
  }

  const now = new Date().toISOString();

  const [result] = await db
    .update(tables.authorizations)
    .set({
      isActive: false,
      revokedBy,
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(tables.authorizations.id, id))
    .returning();

  // Clear cache for this employee
  clearAuthorizationCache(existing.employeeId);

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_authorizations',
    recordId: id,
    oldValue: { isActive: true },
    newValue: { isActive: false, revokedBy, revokedAt: now },
  });

  return {
    ...result,
    authType: result.authType as AuthorizationType,
  };
}

/**
 * Check if employee has authorization (with caching for <200ms requirement)
 */
export async function checkAuthorization(
  employeeId: number,
  authType: AuthorizationType,
  scope?: AuthorizationScope
): Promise<AuthorizationCheckResult> {
  const cacheKey = getCacheKey(employeeId, authType, scope);
  const cached = authorizationCache.get(cacheKey);

  // Return cached result if still valid
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const tables = getHRTables();
  const db = await getDb();
  const now = new Date().toISOString().split('T')[0];

  // Check direct authorization
  const directConditions: SQL[] = [
    eq(tables.authorizations.employeeId, employeeId),
    eq(tables.authorizations.authType, authType),
    eq(tables.authorizations.isActive, true),
    sql`${tables.authorizations.effectiveFrom} <= ${now}`,
    or(
      isNull(tables.authorizations.effectiveTo),
      sql`${tables.authorizations.effectiveTo} >= ${now}`
    )!,
  ];

  // Add scope conditions if specified
  if (scope?.siteId) {
    directConditions.push(
      or(
        isNull(tables.authorizations.scopeSiteId),
        eq(tables.authorizations.scopeSiteId, scope.siteId)
      )!
    );
  }

  if (scope?.orgUnitId) {
    directConditions.push(
      or(
        isNull(tables.authorizations.scopeOrgUnitId),
        eq(tables.authorizations.scopeOrgUnitId, scope.orgUnitId)
      )!
    );
  }

  const [directAuth] = await db
    .select()
    .from(tables.authorizations)
    .where(and(...directConditions))
    .limit(1);

  if (directAuth) {
    // Check product line scope if specified
    if (scope?.productLine && directAuth.scopeProductLines) {
      const allowedProductLines = JSON.parse(directAuth.scopeProductLines) as string[];
      if (!allowedProductLines.includes(scope.productLine)) {
        const result: AuthorizationCheckResult = {
          authorized: false,
          source: null,
          authorizationId: null,
          expiresAt: null,
        };
        authorizationCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL_MS });
        return result;
      }
    }

    const result: AuthorizationCheckResult = {
      authorized: true,
      source: 'direct',
      authorizationId: directAuth.id,
      expiresAt: directAuth.effectiveTo,
    };
    authorizationCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // Check delegation
  const delegationResult = await db
    .select({
      delegationId: tables.delegations.id,
      authorizationId: tables.delegations.authorizationId,
      effectiveTo: tables.delegations.effectiveTo,
    })
    .from(tables.delegations)
    .innerJoin(
      tables.authorizations,
      eq(tables.delegations.authorizationId, tables.authorizations.id)
    )
    .where(
      and(
        eq(tables.delegations.delegateId, employeeId),
        eq(tables.authorizations.authType, authType),
        eq(tables.authorizations.isActive, true),
        sql`${tables.delegations.effectiveFrom} <= ${now}`,
        sql`${tables.delegations.effectiveTo} >= ${now}`
      )
    )
    .limit(1);

  if (delegationResult.length > 0) {
    const delegation = delegationResult[0];
    const result: AuthorizationCheckResult = {
      authorized: true,
      source: 'delegation',
      authorizationId: delegation.authorizationId,
      expiresAt: delegation.effectiveTo,
    };
    authorizationCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // Not authorized
  const result: AuthorizationCheckResult = {
    authorized: false,
    source: null,
    authorizationId: null,
    expiresAt: null,
  };
  authorizationCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}

/**
 * Get all active authorizations for an employee
 */
export async function getEmployeeAuthorizations(
  employeeId: number
): Promise<AuthorizationWithDetails[]> {
  return getAuthorizations({ employeeId, isActive: true });
}

/**
 * Check if employee has any active authorization of a specific type
 */
export async function hasActiveAuthorization(
  employeeId: number,
  authType: AuthorizationType
): Promise<boolean> {
  const result = await checkAuthorization(employeeId, authType);
  return result.authorized;
}

/**
 * Get authorizations expiring within specified days
 */
export async function getExpiringAuthorizations(
  withinDays: number = 30
): Promise<AuthorizationWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const nowStr = now.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  const authorizations = await db
    .select()
    .from(tables.authorizations)
    .where(
      and(
        eq(tables.authorizations.isActive, true),
        sql`${tables.authorizations.effectiveTo} IS NOT NULL`,
        sql`${tables.authorizations.effectiveTo} >= ${nowStr}`,
        sql`${tables.authorizations.effectiveTo} <= ${futureStr}`
      )
    )
    .orderBy(tables.authorizations.effectiveTo);

  const enriched: AuthorizationWithDetails[] = [];
  for (const auth of authorizations) {
    const employee = await getEmployeeById(auth.employeeId);
    enriched.push({
      ...auth,
      authType: auth.authType as AuthorizationType,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
    });
  }

  return enriched;
}

// ============================================
// Delegation Service (T071)
// ============================================

interface DelegationFilters {
  authorizationId?: number;
  delegatorId?: number;
  delegateId?: number;
  isActive?: boolean;
}

/**
 * Validate delegation date range
 */
function validateDelegationDates(effectiveFrom: string, effectiveTo: string): void {
  const fromDate = new Date(effectiveFrom);
  const toDate = new Date(effectiveTo);
  const now = new Date();

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error('Invalid date format');
  }

  if (fromDate >= toDate) {
    throw new Error('effectiveFrom must be before effectiveTo');
  }

  if (toDate <= now) {
    throw new Error('effectiveTo must be in the future');
  }
}

/**
 * Get delegations with filters
 */
export async function getDelegations(
  filters?: DelegationFilters
): Promise<DelegationWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];
  const now = new Date().toISOString().split('T')[0];

  if (filters?.authorizationId) {
    conditions.push(eq(tables.delegations.authorizationId, filters.authorizationId));
  }

  if (filters?.delegatorId) {
    conditions.push(eq(tables.delegations.delegatorId, filters.delegatorId));
  }

  if (filters?.delegateId) {
    conditions.push(eq(tables.delegations.delegateId, filters.delegateId));
  }

  if (filters?.isActive !== undefined) {
    if (filters.isActive) {
      conditions.push(sql`${tables.delegations.effectiveTo} >= ${now}`);
    } else {
      conditions.push(sql`${tables.delegations.effectiveTo} < ${now}`);
    }
  }

  const query = conditions.length > 0
    ? db.select().from(tables.delegations).where(and(...conditions))
    : db.select().from(tables.delegations);

  const delegations = await query.orderBy(desc(tables.delegations.createdAt));

  // Enrich with details
  const enriched: DelegationWithDetails[] = [];
  for (const del of delegations) {
    const authorization = await getAuthorizationById(del.authorizationId);
    const delegator = await getEmployeeById(del.delegatorId);
    const delegate = await getEmployeeById(del.delegateId);
    const today = new Date().toISOString().split('T')[0];

    enriched.push({
      ...del,
      authType: authorization?.authType,
      delegatorName: delegator ? `${delegator.firstName} ${delegator.lastName}` : undefined,
      delegateName: delegate ? `${delegate.firstName} ${delegate.lastName}` : undefined,
      isActive: del.effectiveTo >= today,
    });
  }

  return enriched;
}

/**
 * Get delegation by ID
 */
export async function getDelegationById(id: number): Promise<DelegationWithDetails | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [delegation] = await db
    .select()
    .from(tables.delegations)
    .where(eq(tables.delegations.id, id))
    .limit(1);

  if (!delegation) return null;

  const authorization = await getAuthorizationById(delegation.authorizationId);
  const delegator = await getEmployeeById(delegation.delegatorId);
  const delegate = await getEmployeeById(delegation.delegateId);
  const today = new Date().toISOString().split('T')[0];

  return {
    ...delegation,
    authType: authorization?.authType,
    delegatorName: delegator ? `${delegator.firstName} ${delegator.lastName}` : undefined,
    delegateName: delegate ? `${delegate.firstName} ${delegate.lastName}` : undefined,
    isActive: delegation.effectiveTo >= today,
  };
}

/**
 * Create a new delegation
 */
export async function createDelegation(
  data: DelegationCreate,
  delegatorId: number
): Promise<Delegation> {
  const tables = getHRTables();
  const db = await getDb();

  // Validate dates
  validateDelegationDates(data.effectiveFrom, data.effectiveTo);

  // Check that authorization exists and belongs to delegator
  const authorization = await getAuthorizationById(data.authorizationId);
  if (!authorization) {
    throw new Error('Authorization not found');
  }

  if (authorization.employeeId !== delegatorId) {
    throw new Error('Cannot delegate authorization that does not belong to you');
  }

  if (!authorization.isActive) {
    throw new Error('Cannot delegate inactive authorization');
  }

  // Check that delegate exists
  const delegate = await getEmployeeById(data.delegateId);
  if (!delegate) {
    throw new Error('Delegate employee not found');
  }

  // Cannot delegate to self
  if (data.delegateId === delegatorId) {
    throw new Error('Cannot delegate to yourself');
  }

  const now = new Date().toISOString();

  const insertData = {
    authorizationId: data.authorizationId,
    delegatorId,
    delegateId: data.delegateId,
    reason: data.reason || null,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo,
    createdAt: now,
    updatedAt: now,
  };

  const [result] = await db.insert(tables.delegations).values(insertData).returning();

  // Clear cache for delegate
  clearAuthorizationCache(data.delegateId);

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_delegations',
    recordId: result.id,
    newValue: insertData,
  });

  return result;
}

/**
 * Cancel/revoke a delegation
 */
export async function cancelDelegation(id: number): Promise<Delegation> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getDelegationById(id);
  if (!existing) {
    throw new Error('Delegation not found');
  }

  // Set effectiveTo to now to cancel
  const now = new Date().toISOString().split('T')[0];

  const [result] = await db
    .update(tables.delegations)
    .set({
      effectiveTo: now,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.delegations.id, id))
    .returning();

  // Clear cache for delegate
  clearAuthorizationCache(existing.delegateId);

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_delegations',
    recordId: id,
    oldValue: { effectiveTo: existing.effectiveTo },
    newValue: { effectiveTo: now },
  });

  return result;
}

/**
 * Get delegations created by an employee
 */
export async function getEmployeeDelegations(
  employeeId: number
): Promise<DelegationWithDetails[]> {
  return getDelegations({ delegatorId: employeeId });
}

/**
 * Get delegations assigned to an employee (as delegate)
 */
export async function getDelegatedToEmployee(
  employeeId: number
): Promise<DelegationWithDetails[]> {
  return getDelegations({ delegateId: employeeId, isActive: true });
}

// ============================================
// Health Record Service (T080-T082)
// ============================================

export interface HealthRecordWithDetails extends HealthRecord {
  employeeName?: string;
  recordedByName?: string;
}

interface HealthRecordFilters {
  employeeId?: number;
  examinationType?: ExaminationType;
  fitnessStatus?: FitnessStatus;
  fromDate?: string;
  toDate?: string;
}

/**
 * Convert full health record to public version (strips sensitive fields)
 */
function toPublicHealthRecord(record: HealthRecord): HealthRecordPublic {
  return {
    id: record.id,
    employeeId: record.employeeId,
    examinationType: record.examinationType,
    examinationDate: record.examinationDate,
    nextExamDue: record.nextExamDue,
    fitnessStatus: record.fitnessStatus,
    restrictions: record.restrictions,
  };
}

/**
 * Get health records with privacy filtering
 * @param filters - Filter options
 * @param includePrivate - If true, includes medical details (requires health_staff role)
 */
export async function getHealthRecords(
  filters?: HealthRecordFilters,
  includePrivate: boolean = false
): Promise<HealthRecordWithDetails[] | HealthRecordPublic[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];

  if (filters?.employeeId) {
    conditions.push(eq(tables.healthRecords.employeeId, filters.employeeId));
  }

  if (filters?.examinationType) {
    conditions.push(eq(tables.healthRecords.examinationType, filters.examinationType));
  }

  if (filters?.fitnessStatus) {
    conditions.push(eq(tables.healthRecords.fitnessStatus, filters.fitnessStatus));
  }

  if (filters?.fromDate) {
    conditions.push(sql`${tables.healthRecords.examinationDate} >= ${filters.fromDate}`);
  }

  if (filters?.toDate) {
    conditions.push(sql`${tables.healthRecords.examinationDate} <= ${filters.toDate}`);
  }

  const query = conditions.length > 0
    ? db.select().from(tables.healthRecords).where(and(...conditions))
    : db.select().from(tables.healthRecords);

  const records = await query.orderBy(desc(tables.healthRecords.examinationDate));

  if (!includePrivate) {
    // Return only public fields
    return records.map((r) => toPublicHealthRecord(r as HealthRecord));
  }

  // Enrich with employee and recorder names
  const enriched: HealthRecordWithDetails[] = [];
  for (const record of records) {
    const employee = await getEmployeeById(record.employeeId);
    let recordedByName: string | undefined;
    if (record.recordedBy) {
      const recorder = await getEmployeeById(record.recordedBy);
      recordedByName = recorder ? `${recorder.firstName} ${recorder.lastName}` : undefined;
    }

    enriched.push({
      ...(record as HealthRecord),
      examinationType: record.examinationType as ExaminationType,
      fitnessStatus: record.fitnessStatus as FitnessStatus,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
      recordedByName,
    });
  }

  return enriched;
}

/**
 * Get health record by ID with privacy filtering
 */
export async function getHealthRecordById(
  id: number,
  includePrivate: boolean = false
): Promise<HealthRecordWithDetails | HealthRecordPublic | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [record] = await db
    .select()
    .from(tables.healthRecords)
    .where(eq(tables.healthRecords.id, id))
    .limit(1);

  if (!record) return null;

  if (!includePrivate) {
    return toPublicHealthRecord(record as HealthRecord);
  }

  const employee = await getEmployeeById(record.employeeId);
  let recordedByName: string | undefined;
  if (record.recordedBy) {
    const recorder = await getEmployeeById(record.recordedBy);
    recordedByName = recorder ? `${recorder.firstName} ${recorder.lastName}` : undefined;
  }

  return {
    ...(record as HealthRecord),
    examinationType: record.examinationType as ExaminationType,
    fitnessStatus: record.fitnessStatus as FitnessStatus,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
    recordedByName,
  };
}

/**
 * Create a new health record
 */
export async function createHealthRecord(
  data: HealthRecordCreate,
  recordedBy: number
): Promise<HealthRecord> {
  const tables = getHRTables();
  const db = await getDb();

  // Verify employee exists
  const employee = await getEmployeeById(data.employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  const now = new Date().toISOString();

  const insertData = {
    employeeId: data.employeeId,
    examinationType: data.examinationType,
    examinationDate: data.examinationDate,
    nextExamDue: data.nextExamDue || null,
    fitnessStatus: data.fitnessStatus,
    restrictions: data.restrictions || null,
    affectedAreas: data.affectedAreas ? JSON.stringify(data.affectedAreas) : null,
    medicalDetails: data.medicalDetails || null,
    examinerName: data.examinerName || null,
    examinerNotes: data.examinerNotes || null,
    recordedBy,
    createdAt: now,
    updatedAt: now,
  };

  const [result] = await db.insert(tables.healthRecords).values(insertData).returning();

  // Audit log (without sensitive medical details)
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_health_records',
    recordId: result.id,
    newValue: {
      employeeId: data.employeeId,
      examinationType: data.examinationType,
      examinationDate: data.examinationDate,
      fitnessStatus: data.fitnessStatus,
      recordedBy,
    },
  });

  return {
    ...result,
    examinationType: result.examinationType as ExaminationType,
    fitnessStatus: result.fitnessStatus as FitnessStatus,
  };
}

/**
 * Update a health record
 */
export async function updateHealthRecord(
  id: number,
  data: Partial<HealthRecordCreate>
): Promise<HealthRecord> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getHealthRecordById(id, true);
  if (!existing) {
    throw new Error('Health record not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.examinationType !== undefined) updateData.examinationType = data.examinationType;
  if (data.examinationDate !== undefined) updateData.examinationDate = data.examinationDate;
  if (data.nextExamDue !== undefined) updateData.nextExamDue = data.nextExamDue || null;
  if (data.fitnessStatus !== undefined) updateData.fitnessStatus = data.fitnessStatus;
  if (data.restrictions !== undefined) updateData.restrictions = data.restrictions || null;
  if (data.affectedAreas !== undefined) {
    updateData.affectedAreas = data.affectedAreas ? JSON.stringify(data.affectedAreas) : null;
  }
  if (data.medicalDetails !== undefined) updateData.medicalDetails = data.medicalDetails || null;
  if (data.examinerName !== undefined) updateData.examinerName = data.examinerName || null;
  if (data.examinerNotes !== undefined) updateData.examinerNotes = data.examinerNotes || null;

  const [result] = await db
    .update(tables.healthRecords)
    .set(updateData)
    .where(eq(tables.healthRecords.id, id))
    .returning();

  // Audit log (without sensitive details)
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_health_records',
    recordId: id,
    oldValue: {
      examinationType: (existing as HealthRecord).examinationType,
      fitnessStatus: (existing as HealthRecord).fitnessStatus,
    },
    newValue: {
      examinationType: result.examinationType,
      fitnessStatus: result.fitnessStatus,
    },
  });

  return {
    ...result,
    examinationType: result.examinationType as ExaminationType,
    fitnessStatus: result.fitnessStatus as FitnessStatus,
  };
}

/**
 * Get current health status for an employee (latest record)
 */
export async function getEmployeeHealthStatus(
  employeeId: number
): Promise<{ fitnessStatus: FitnessStatus; restrictions: string | null; lastExamDate: string } | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [record] = await db
    .select({
      fitnessStatus: tables.healthRecords.fitnessStatus,
      restrictions: tables.healthRecords.restrictions,
      examinationDate: tables.healthRecords.examinationDate,
    })
    .from(tables.healthRecords)
    .where(eq(tables.healthRecords.employeeId, employeeId))
    .orderBy(desc(tables.healthRecords.examinationDate))
    .limit(1);

  if (!record) return null;

  return {
    fitnessStatus: record.fitnessStatus as FitnessStatus,
    restrictions: record.restrictions,
    lastExamDate: record.examinationDate,
  };
}

/**
 * Get health checks due within specified days
 */
export interface UpcomingHealthCheck {
  employeeId: number;
  employeeName: string;
  employeeEmail?: string | null;
  lastExamDate: string;
  nextExamDue: string;
  daysUntilDue: number;
  lastFitnessStatus: FitnessStatus;
}

export async function getHealthChecksDue(
  withinDays: number = 30
): Promise<UpcomingHealthCheck[]> {
  const tables = getHRTables();
  const db = await getDb();

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const nowStr = now.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  const records = await db
    .select()
    .from(tables.healthRecords)
    .where(
      and(
        sql`${tables.healthRecords.nextExamDue} IS NOT NULL`,
        sql`${tables.healthRecords.nextExamDue} >= ${nowStr}`,
        sql`${tables.healthRecords.nextExamDue} <= ${futureStr}`
      )
    )
    .orderBy(tables.healthRecords.nextExamDue);

  const upcoming: UpcomingHealthCheck[] = [];
  const seenEmployees = new Set<number>();

  for (const record of records) {
    // Only include most recent record per employee
    if (seenEmployees.has(record.employeeId)) continue;
    seenEmployees.add(record.employeeId);

    const employee = await getEmployeeById(record.employeeId);
    if (!employee || employee.status !== 'active') continue;

    const dueDate = new Date(record.nextExamDue!);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    upcoming.push({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      lastExamDate: record.examinationDate,
      nextExamDue: record.nextExamDue!,
      daysUntilDue,
      lastFitnessStatus: record.fitnessStatus as FitnessStatus,
    });
  }

  return upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Get overdue health checks
 */
export async function getOverdueHealthChecks(): Promise<UpcomingHealthCheck[]> {
  const tables = getHRTables();
  const db = await getDb();

  const nowStr = new Date().toISOString().split('T')[0];
  const now = new Date();

  const records = await db
    .select()
    .from(tables.healthRecords)
    .where(
      and(
        sql`${tables.healthRecords.nextExamDue} IS NOT NULL`,
        sql`${tables.healthRecords.nextExamDue} < ${nowStr}`
      )
    )
    .orderBy(tables.healthRecords.nextExamDue);

  const overdue: UpcomingHealthCheck[] = [];
  const seenEmployees = new Set<number>();

  for (const record of records) {
    if (seenEmployees.has(record.employeeId)) continue;
    seenEmployees.add(record.employeeId);

    const employee = await getEmployeeById(record.employeeId);
    if (!employee || employee.status !== 'active') continue;

    const dueDate = new Date(record.nextExamDue!);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    overdue.push({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      lastExamDate: record.examinationDate,
      nextExamDue: record.nextExamDue!,
      daysUntilDue, // Will be negative
      lastFitnessStatus: record.fitnessStatus as FitnessStatus,
    });
  }

  return overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Get employees by fitness status
 */
export async function getEmployeesByFitnessStatus(
  status: FitnessStatus
): Promise<{ employeeId: number; employeeName: string; restrictions?: string | null }[]> {
  const tables = getHRTables();
  const db = await getDb();

  // Get all active employees
  const activeEmployees = await getEmployees({ status: 'active' });

  const result: { employeeId: number; employeeName: string; restrictions?: string | null }[] = [];

  for (const employee of activeEmployees) {
    const healthStatus = await getEmployeeHealthStatus(employee.id);
    if (healthStatus && healthStatus.fitnessStatus === status) {
      result.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        restrictions: healthStatus.restrictions,
      });
    }
  }

  return result;
}

// ============================================
// Role and Permission Service (T090-T092)
// ============================================

export interface EmployeeRoleWithDetails extends EmployeeRole {
  roleName?: string;
  roleCode?: string;
  scopeSiteName?: string;
  scopeOrgUnitName?: string;
  assignedByName?: string;
  isActive?: boolean;
}

interface AppRoleFilters {
  isActive?: boolean;
  isSystemRole?: boolean;
  search?: string;
}

/**
 * Get all app roles with filters
 */
export async function getAppRoles(
  filters?: AppRoleFilters
): Promise<AppRoleWithPermissions[]> {
  const tables = getHRTables();
  const db = await getDb();

  const conditions: SQL[] = [];

  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.appRoles.isActive, filters.isActive));
  }

  if (filters?.isSystemRole !== undefined) {
    conditions.push(eq(tables.appRoles.isSystemRole, filters.isSystemRole));
  }

  if (filters?.search) {
    conditions.push(
      or(
        sql`${tables.appRoles.code} LIKE ${'%' + filters.search + '%'}`,
        sql`${tables.appRoles.name} LIKE ${'%' + filters.search + '%'}`
      )!
    );
  }

  const query = conditions.length > 0
    ? db.select().from(tables.appRoles).where(and(...conditions))
    : db.select().from(tables.appRoles);

  const roles = await query.orderBy(tables.appRoles.name);

  // Enrich with permission counts
  const enriched: AppRoleWithPermissions[] = [];
  for (const role of roles) {
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tables.rolePermissions)
      .where(eq(tables.rolePermissions.roleId, role.id));

    enriched.push({
      ...role,
      permissionCount: Number(countResult?.count || 0),
    } as AppRoleWithPermissions);
  }

  return enriched;
}

/**
 * Get app role by ID with permissions
 */
export async function getAppRoleById(id: number): Promise<AppRoleWithPermissions | null> {
  const tables = getHRTables();
  const db = await getDb();

  const [role] = await db
    .select()
    .from(tables.appRoles)
    .where(eq(tables.appRoles.id, id))
    .limit(1);

  if (!role) return null;

  // Get permissions for this role
  const rolePermissionIds = await db
    .select({ permissionId: tables.rolePermissions.permissionId })
    .from(tables.rolePermissions)
    .where(eq(tables.rolePermissions.roleId, id));

  let permissions: AppPermission[] = [];
  if (rolePermissionIds.length > 0) {
    const permIds = rolePermissionIds.map((rp) => rp.permissionId);
    permissions = await db
      .select()
      .from(tables.appPermissions)
      .where(sql`${tables.appPermissions.id} IN (${permIds.join(',')})`) as AppPermission[];
  }

  return {
    ...role,
    permissionCount: permissions.length,
    permissions,
  } as AppRoleWithPermissions;
}

/**
 * Create a new app role
 */
export async function createAppRole(data: AppRoleCreate): Promise<AppRole> {
  const tables = getHRTables();
  const db = await getDb();

  // Check for duplicate code
  const [existing] = await db
    .select()
    .from(tables.appRoles)
    .where(eq(tables.appRoles.code, data.code))
    .limit(1);

  if (existing) {
    throw new Error('Role code already exists');
  }

  const now = new Date().toISOString();

  const insertData = {
    code: data.code,
    name: data.name,
    description: data.description || null,
    isSystemRole: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const [result] = await db.insert(tables.appRoles).values(insertData).returning();

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_app_roles',
    recordId: result.id,
    newValue: insertData,
  });

  return result as AppRole;
}

/**
 * Update an app role
 */
export async function updateAppRole(
  id: number,
  data: Partial<AppRoleCreate & { isActive?: boolean }>
): Promise<AppRole> {
  const tables = getHRTables();
  const db = await getDb();

  const existing = await getAppRoleById(id);
  if (!existing) {
    throw new Error('Role not found');
  }

  // Cannot update system roles
  if (existing.isSystemRole) {
    throw new Error('Cannot modify system roles');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [result] = await db
    .update(tables.appRoles)
    .set(updateData)
    .where(eq(tables.appRoles.id, id))
    .returning();

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_app_roles',
    recordId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: updateData,
  });

  return result as AppRole;
}

/**
 * Deactivate an app role
 */
export async function deactivateAppRole(id: number): Promise<AppRole> {
  return updateAppRole(id, { isActive: false });
}

/**
 * Get all app permissions
 */
export async function getAppPermissions(): Promise<AppPermission[]> {
  const tables = getHRTables();
  const db = await getDb();

  const permissions = await db
    .select()
    .from(tables.appPermissions)
    .orderBy(tables.appPermissions.module, tables.appPermissions.code);

  return permissions as AppPermission[];
}

/**
 * Get permissions for a role
 */
export async function getRolePermissions(roleId: number): Promise<AppPermission[]> {
  const tables = getHRTables();
  const db = await getDb();

  const rolePermissionIds = await db
    .select({ permissionId: tables.rolePermissions.permissionId })
    .from(tables.rolePermissions)
    .where(eq(tables.rolePermissions.roleId, roleId));

  if (rolePermissionIds.length === 0) return [];

  const permIds = rolePermissionIds.map((rp) => rp.permissionId);
  const permissions = await db
    .select()
    .from(tables.appPermissions)
    .where(sql`${tables.appPermissions.id} IN (${permIds.join(',')})`);

  return permissions as AppPermission[];
}

/**
 * Update permissions for a role
 */
export async function updateRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<void> {
  const tables = getHRTables();
  const db = await getDb();

  const role = await getAppRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.isSystemRole) {
    throw new Error('Cannot modify permissions for system roles');
  }

  // Get current permissions for audit
  const oldPermissions = await getRolePermissions(roleId);
  const oldPermissionIds = oldPermissions.map((p) => p.id);

  // Delete existing permissions
  await db
    .delete(tables.rolePermissions)
    .where(eq(tables.rolePermissions.roleId, roleId));

  // Insert new permissions
  if (permissionIds.length > 0) {
    const now = new Date().toISOString();
    const inserts = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
      createdAt: now,
    }));
    await db.insert(tables.rolePermissions).values(inserts);
  }

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_role_permissions',
    recordId: roleId,
    oldValue: { permissionIds: oldPermissionIds },
    newValue: { permissionIds },
  });
}

/**
 * Get employee roles
 */
export async function getEmployeeRoles(
  employeeId: number
): Promise<EmployeeRoleWithDetails[]> {
  const tables = getHRTables();
  const db = await getDb();

  const roles = await db
    .select()
    .from(tables.employeeRoles)
    .where(eq(tables.employeeRoles.employeeId, employeeId))
    .orderBy(desc(tables.employeeRoles.effectiveFrom));

  const today = new Date().toISOString().split('T')[0];

  // Enrich with details
  const enriched: EmployeeRoleWithDetails[] = [];
  for (const role of roles) {
    const appRole = await getAppRoleById(role.roleId);
    let assignedByName: string | undefined;
    if (role.assignedBy) {
      const assignedBy = await getEmployeeById(role.assignedBy);
      assignedByName = assignedBy ? `${assignedBy.firstName} ${assignedBy.lastName}` : undefined;
    }

    let scopeSiteName: string | undefined;
    if (role.scopeSiteId) {
      const site = await getOrgUnitById(role.scopeSiteId);
      scopeSiteName = site?.name;
    }

    let scopeOrgUnitName: string | undefined;
    if (role.scopeOrgUnitId) {
      const orgUnit = await getOrgUnitById(role.scopeOrgUnitId);
      scopeOrgUnitName = orgUnit?.name;
    }

    const isActive = role.effectiveFrom <= today &&
      (!role.effectiveTo || role.effectiveTo >= today);

    enriched.push({
      ...role,
      roleName: appRole?.name,
      roleCode: appRole?.code,
      scopeSiteName,
      scopeOrgUnitName,
      assignedByName,
      isActive,
    } as EmployeeRoleWithDetails);
  }

  return enriched;
}

/**
 * Assign role to employee
 */
export async function assignEmployeeRole(
  data: EmployeeRoleCreate,
  assignedBy: number
): Promise<EmployeeRole> {
  const tables = getHRTables();
  const db = await getDb();

  // Verify employee exists
  const employee = await getEmployeeById(data.employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Verify role exists
  const role = await getAppRoleById(data.roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (!role.isActive) {
    throw new Error('Cannot assign inactive role');
  }

  const now = new Date().toISOString();

  const insertData = {
    employeeId: data.employeeId,
    roleId: data.roleId,
    scopeSiteId: data.scopeSiteId || null,
    scopeOrgUnitId: data.scopeOrgUnitId || null,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || null,
    assignedBy,
    createdAt: now,
    updatedAt: now,
  };

  const [result] = await db.insert(tables.employeeRoles).values(insertData).returning();

  // Audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'hr_employee_roles',
    recordId: result.id,
    newValue: {
      ...insertData,
      roleName: role.name,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    },
  });

  return result as EmployeeRole;
}

/**
 * Revoke employee role
 */
export async function revokeEmployeeRole(id: number): Promise<EmployeeRole> {
  const tables = getHRTables();
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(tables.employeeRoles)
    .where(eq(tables.employeeRoles.id, id))
    .limit(1);

  if (!existing) {
    throw new Error('Employee role not found');
  }

  // Set effectiveTo to now to revoke
  const now = new Date().toISOString().split('T')[0];

  const [result] = await db
    .update(tables.employeeRoles)
    .set({
      effectiveTo: now,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tables.employeeRoles.id, id))
    .returning();

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'hr_employee_roles',
    recordId: id,
    oldValue: { effectiveTo: existing.effectiveTo },
    newValue: { effectiveTo: now },
  });

  return result as EmployeeRole;
}

/**
 * Get all active permissions for an employee (aggregated from all roles)
 */
export async function getEmployeePermissions(
  employeeId: number
): Promise<AppPermission[]> {
  const tables = getHRTables();
  const db = await getDb();

  const today = new Date().toISOString().split('T')[0];

  // Get active roles for employee
  const activeRoles = await db
    .select({ roleId: tables.employeeRoles.roleId })
    .from(tables.employeeRoles)
    .where(
      and(
        eq(tables.employeeRoles.employeeId, employeeId),
        sql`${tables.employeeRoles.effectiveFrom} <= ${today}`,
        or(
          isNull(tables.employeeRoles.effectiveTo),
          sql`${tables.employeeRoles.effectiveTo} >= ${today}`
        )
      )
    );

  if (activeRoles.length === 0) return [];

  // Get all permission IDs for these roles
  const roleIds = activeRoles.map((r) => r.roleId);
  const rolePermissions = await db
    .select({ permissionId: tables.rolePermissions.permissionId })
    .from(tables.rolePermissions)
    .where(sql`${tables.rolePermissions.roleId} IN (${roleIds.join(',')})`);

  if (rolePermissions.length === 0) return [];

  // Get unique permissions
  const permissionIds = [...new Set(rolePermissions.map((rp) => rp.permissionId))];
  const permissions = await db
    .select()
    .from(tables.appPermissions)
    .where(sql`${tables.appPermissions.id} IN (${permissionIds.join(',')})`)
    .orderBy(tables.appPermissions.module, tables.appPermissions.code);

  return permissions as AppPermission[];
}

/**
 * Check if employee has a specific permission
 */
export async function hasPermission(
  employeeId: number,
  permissionCode: string
): Promise<boolean> {
  const permissions = await getEmployeePermissions(employeeId);
  return permissions.some((p) => p.code === permissionCode);
}

/**
 * Get employees by role
 */
export async function getEmployeesByRole(
  roleId: number
): Promise<{ employeeId: number; employeeName: string; isActive: boolean }[]> {
  const tables = getHRTables();
  const db = await getDb();

  const today = new Date().toISOString().split('T')[0];

  const employeeRoles = await db
    .select()
    .from(tables.employeeRoles)
    .where(eq(tables.employeeRoles.roleId, roleId));

  const result: { employeeId: number; employeeName: string; isActive: boolean }[] = [];

  for (const er of employeeRoles) {
    const employee = await getEmployeeById(er.employeeId);
    if (employee) {
      const isActive = er.effectiveFrom <= today &&
        (!er.effectiveTo || er.effectiveTo >= today);
      result.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        isActive,
      });
    }
  }

  return result;
}
