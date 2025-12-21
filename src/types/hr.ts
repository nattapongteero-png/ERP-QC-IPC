// HR/Personnel Management Module - TypeScript Types
// Feature: 007-hr-personnel-management

// ============================================
// Enums
// ============================================

export type OrgUnitType = 'company' | 'site' | 'division' | 'department' | 'section' | 'unit';

export type EmployeeStatus = 'active' | 'inactive' | 'terminated';

export type JobDescriptionStatus = 'draft' | 'pending_approval' | 'approved' | 'obsolete';

export type TrainingResult = 'pass' | 'fail' | 'incomplete';

export type TrainingSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type TrainingRecordStatus = 'valid' | 'expiring_soon' | 'expired' | 'not_taken';

export type AuthorizationType =
  | 'batch_release'
  | 'sop_approval'
  | 'deviation_approval'
  | 'change_control_approval'
  | 'capa_approval';

export type ExaminationType = 'pre_employment' | 'periodic' | 'special';

export type FitnessStatus = 'fit' | 'unfit' | 'restricted';

export type NotificationType =
  | 'training_expiring'
  | 'training_expired'
  | 'health_check_due'
  | 'authorization_expiring';

// ============================================
// Organization Structure
// ============================================

export interface OrgUnit {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  type: OrgUnitType;
  parentId: number | null;
  siteId: number | null;
  isGmpCritical: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUnitCreate {
  code: string;
  name: string;
  nameEn?: string;
  type: OrgUnitType;
  parentId?: number | null;
  siteId?: number | null;
  isGmpCritical?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface OrgUnitUpdate {
  name?: string;
  nameEn?: string;
  parentId?: number | null;
  isGmpCritical?: boolean;
  effectiveTo?: string | null;
  isActive?: boolean;
}

export interface OrgUnitTreeNode extends OrgUnit {
  children: OrgUnitTreeNode[];
  employeeCount?: number;
}

// ============================================
// Position
// ============================================

export interface Position {
  id: number;
  code: string;
  title: string;
  titleEn?: string | null;
  orgUnitId: number;
  jobGrade?: string | null;
  isGmpCritical: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionCreate {
  code: string;
  title: string;
  titleEn?: string;
  orgUnitId: number;
  jobGrade?: string;
  isGmpCritical?: boolean;
}

export interface PositionUpdate {
  title?: string;
  titleEn?: string;
  orgUnitId?: number;
  jobGrade?: string;
  isGmpCritical?: boolean;
  isActive?: boolean;
}

export interface PositionWithDetails extends Position {
  orgUnit?: OrgUnit;
  currentJobDescription?: JobDescription;
  employeeCount?: number;
}

// ============================================
// Job Description
// ============================================

export interface JobDescription {
  id: number;
  positionId: number;
  version: string;
  responsibilities?: string | null;
  authorities?: string | null;
  qualifications?: string | null;
  documentPath?: string | null;
  status: JobDescriptionStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDescriptionCreate {
  positionId: number;
  version?: string; // Auto-generated if not provided
  responsibilities?: string;
  authorities?: string;
  qualifications?: string;
  documentPath?: string;
}

// ============================================
// Employee
// ============================================

export interface Employee {
  id: number;
  userId: number | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  email?: string | null;
  phone?: string | null;
  positionId: number | null;
  orgUnitId: number | null;
  siteId: number | null;
  hireDate: string;
  terminationDate: string | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCreate {
  userId?: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email?: string;
  phone?: string;
  positionId?: number;
  orgUnitId?: number;
  siteId?: number;
  hireDate: string;
}

export interface EmployeeUpdate {
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email?: string;
  phone?: string;
  positionId?: number;
  orgUnitId?: number;
  siteId?: number;
  status?: EmployeeStatus;
  terminationDate?: string;
}

export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  positionTitle?: string;
  orgUnitName?: string;
  status: EmployeeStatus;
}

export interface EmployeeProfile extends Employee {
  position?: Position;
  orgUnit?: OrgUnit;
  currentHealthStatus?: FitnessStatus;
  authorizations?: Authorization[];
  roles?: AppRole[];
}

// ============================================
// Employee Assignment
// ============================================

export interface EmployeeAssignment {
  id: number;
  employeeId: number;
  positionId: number | null;
  orgUnitId: number | null;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface EmployeeAssignmentCreate {
  employeeId: number;
  positionId?: number;
  orgUnitId?: number;
  isPrimary?: boolean;
  effectiveFrom: string;
  reason?: string;
}

// ============================================
// Training
// ============================================

export interface TrainingCourse {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  category?: string | null;
  validityDays: number | null;
  isMandatory: boolean;
  targetPositions?: string | null; // JSON array
  targetRoles?: string | null; // JSON array
  durationHours?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCourseCreate {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  validityDays?: number;
  isMandatory?: boolean;
  targetPositions?: number[];
  durationHours?: number;
}

export interface TrainingSession {
  id: number;
  courseId: number;
  sessionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  instructorId: number | null;
  instructorExternal?: string | null;
  maxParticipants: number | null;
  status: TrainingSessionStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionCreate {
  courseId: number;
  sessionDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  instructorId?: number;
  instructorExternal?: string;
  maxParticipants?: number;
}

export interface TrainingRecord {
  id: number;
  employeeId: number;
  sessionId: number | null;
  courseId: number;
  completionDate: string;
  expiryDate: string | null;
  result: TrainingResult;
  score?: number | null;
  assessedBy: number | null;
  certificateNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingRecordCreate {
  employeeId: number;
  sessionId?: number;
  courseId: number;
  completionDate: string;
  result: TrainingResult;
  score?: number;
  assessedBy?: number;
  certificateNumber?: string;
  notes?: string;
}

export interface TrainingRecordWithStatus extends TrainingRecord {
  status: TrainingRecordStatus;
  courseName?: string;
  employeeName?: string;
}

export interface CompetencyMatrixEntry {
  courseId: number;
  courseName: string;
  isRequired: boolean;
  status: TrainingRecordStatus;
  expiryDate: string | null;
  lastCompletionDate: string | null;
}

export interface CompetencyMatrix {
  employeeId: number;
  employeeName: string;
  courses: CompetencyMatrixEntry[];
}

// ============================================
// Authorization
// ============================================

export interface Authorization {
  id: number;
  employeeId: number;
  authType: AuthorizationType;
  scopeSiteId: number | null;
  scopeOrgUnitId: number | null;
  scopeProductLines?: string | null; // JSON array
  effectiveFrom: string;
  effectiveTo: string | null;
  grantedBy: number;
  grantedAt: string;
  revokedBy: number | null;
  revokedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizationCreate {
  employeeId: number;
  authType: AuthorizationType;
  scopeSiteId?: number;
  scopeOrgUnitId?: number;
  scopeProductLines?: string[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface AuthorizationUpdate {
  effectiveTo?: string;
  isActive?: boolean;
}

export interface AuthorizationWithDetails extends Authorization {
  employeeName?: string;
  scopeSiteName?: string;
  grantedByName?: string;
  delegations?: Delegation[];
}

export interface AuthorizationCheckResult {
  authorized: boolean;
  source: 'direct' | 'delegation' | null;
  authorizationId: number | null;
  expiresAt: string | null;
}

export interface AuthorizationScope {
  siteId?: number;
  orgUnitId?: number;
  productLine?: string;
}

// ============================================
// Delegation
// ============================================

export interface Delegation {
  id: number;
  authorizationId: number;
  delegatorId: number;
  delegateId: number;
  reason?: string | null;
  effectiveFrom: string;
  effectiveTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationCreate {
  authorizationId: number;
  delegateId: number;
  reason?: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface DelegationWithDetails extends Delegation {
  authType?: AuthorizationType;
  delegatorName?: string;
  delegateName?: string;
  isActive?: boolean;
}

// ============================================
// Health Record
// ============================================

export interface HealthRecord {
  id: number;
  employeeId: number;
  examinationType: ExaminationType;
  examinationDate: string;
  nextExamDue: string | null;
  fitnessStatus: FitnessStatus;
  restrictions?: string | null;
  affectedAreas?: string | null; // JSON array
  medicalDetails?: string | null; // SENSITIVE - filtered by role
  examinerName?: string | null;
  examinerNotes?: string | null; // SENSITIVE - filtered by role
  recordedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecordCreate {
  employeeId: number;
  examinationType: ExaminationType;
  examinationDate: string;
  nextExamDue?: string;
  fitnessStatus: FitnessStatus;
  restrictions?: string;
  affectedAreas?: string[];
  medicalDetails?: string;
  examinerName?: string;
  examinerNotes?: string;
}

export interface HealthRecordPublic {
  id: number;
  employeeId: number;
  examinationType: ExaminationType;
  examinationDate: string;
  nextExamDue: string | null;
  fitnessStatus: FitnessStatus;
  restrictions?: string | null;
}

// ============================================
// Roles & Permissions
// ============================================

export interface AppRole {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppRoleCreate {
  code: string;
  name: string;
  description?: string;
}

export interface AppRoleWithPermissions extends AppRole {
  permissionCount?: number;
  permissions?: AppPermission[];
}

export interface AppPermission {
  id: number;
  code: string;
  name: string;
  module: string;
  description?: string | null;
  createdAt: string;
}

export interface RolePermission {
  id: number;
  roleId: number;
  permissionId: number;
  createdAt: string;
}

export interface EmployeeRole {
  id: number;
  employeeId: number;
  roleId: number;
  scopeSiteId: number | null;
  scopeOrgUnitId: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRoleCreate {
  employeeId: number;
  roleId: number;
  scopeSiteId?: number;
  scopeOrgUnitId?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

// ============================================
// Notifications
// ============================================

export interface HRNotification {
  id: number;
  employeeId: number;
  type: NotificationType;
  title: string;
  message?: string | null;
  referenceType?: string | null;
  referenceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface HRNotificationCreate {
  employeeId: number;
  type: NotificationType;
  title: string;
  message?: string;
  referenceType?: string;
  referenceId?: number;
}

// ============================================
// Audit Log
// ============================================

export type HRAuditAction =
  | 'HR_ORG_CREATE'
  | 'HR_ORG_UPDATE'
  | 'HR_ORG_DELETE'
  | 'HR_EMP_CREATE'
  | 'HR_EMP_UPDATE'
  | 'HR_EMP_DEACTIVATE'
  | 'HR_POS_CREATE'
  | 'HR_POS_UPDATE'
  | 'HR_JD_CREATE'
  | 'HR_JD_APPROVE'
  | 'HR_TRAINING_COMPLETE'
  | 'HR_AUTH_GRANT'
  | 'HR_AUTH_REVOKE'
  | 'HR_DELEGATE_CREATE'
  | 'HR_DELEGATE_CANCEL'
  | 'HR_HEALTH_RECORD'
  | 'HR_ROLE_ASSIGN'
  | 'HR_ROLE_REVOKE';

export interface HRAuditLog {
  id: number;
  userId: number | null;
  action: HRAuditAction;
  tableName: string;
  recordId: number;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface HRAuditLogCreate {
  userId?: number;
  action: HRAuditAction;
  tableName: string;
  recordId: number;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}

export interface HRApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}
