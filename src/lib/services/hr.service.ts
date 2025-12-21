// HR/Personnel Management Service
// Feature: 007-hr-personnel-management

import { eq, and, like, or, sql, isNull } from 'drizzle-orm';
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

  return (await getPositionById(Number(insertedId)))!;
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

  return (await getEmployeeById(Number(insertedId)))!;
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
