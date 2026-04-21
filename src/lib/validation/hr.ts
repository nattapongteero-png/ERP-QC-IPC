// HR/Personnel Management Module - Zod Validation Schemas
// Feature: 007-hr-personnel-management

import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const orgUnitTypeSchema = z.enum([
  'company',
  'site',
  'division',
  'department',
  'section',
  'unit',
]);

export const employeeStatusSchema = z.enum(['active', 'inactive', 'terminated']);

export const jobDescriptionStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'obsolete',
]);

export const trainingResultSchema = z.enum(['pass', 'fail', 'incomplete']);

export const trainingSessionStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const trainingRecordStatusSchema = z.enum([
  'valid',
  'expiring_soon',
  'expired',
  'not_taken',
]);

export const authorizationTypeSchema = z.enum([
  'batch_release',
  'sop_approval',
  'deviation_approval',
  'change_control_approval',
  'capa_approval',
]);

export const examinationTypeSchema = z.enum([
  'pre_employment',
  'periodic',
  'special',
]);

export const fitnessStatusSchema = z.enum(['fit', 'unfit', 'restricted']);

export const notificationTypeSchema = z.enum([
  'training_expiring',
  'training_expired',
  'health_check_due',
  'authorization_expiring',
]);

// ============================================
// Organization Unit Schemas
// ============================================

export const orgUnitCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสหน่วยงานจำเป็น')
    .max(20, 'รหัสหน่วยงานต้องไม่เกิน 20 ตัวอักษร'),
  name: z
    .string()
    .min(1, 'ชื่อหน่วยงานจำเป็น')
    .max(100, 'ชื่อหน่วยงานต้องไม่เกิน 100 ตัวอักษร'),
  nameEn: z.string().max(100).optional(),
  type: orgUnitTypeSchema,
  parentId: z.number().int().positive().nullable().optional(),
  siteId: z.number().int().positive().nullable().optional(),
  isGmpCritical: z.boolean().default(false),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มมีผลต้องเป็นวันที่ที่ถูกต้อง',
  }),
  effectiveTo: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'วันที่สิ้นสุดต้องเป็นวันที่ที่ถูกต้อง',
    })
    .nullable()
    .optional(),
});

export const orgUnitUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  isGmpCritical: z.boolean().optional(),
  effectiveTo: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Position Schemas
// ============================================

export const positionCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสตำแหน่งจำเป็น')
    .max(20, 'รหัสตำแหน่งต้องไม่เกิน 20 ตัวอักษร'),
  title: z
    .string()
    .min(1, 'ชื่อตำแหน่งจำเป็น')
    .max(100, 'ชื่อตำแหน่งต้องไม่เกิน 100 ตัวอักษร'),
  titleEn: z.string().max(100).optional(),
  orgUnitId: z.number().int().positive('กรุณาเลือกหน่วยงาน'),
  jobGrade: z.string().max(10).optional(),
  isGmpCritical: z.boolean().default(false),
});

export const positionUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  titleEn: z.string().max(100).optional(),
  orgUnitId: z.number().int().positive().optional(),
  jobGrade: z.string().max(10).optional(),
  isGmpCritical: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Job Description Schemas
// ============================================

export const jobDescriptionCreateSchema = z.object({
  positionId: z.number().int().positive('กรุณาเลือกตำแหน่ง'),
  version: z
    .string()
    .max(10, 'เวอร์ชันต้องไม่เกิน 10 ตัวอักษร')
    .optional(), // Auto-generated if not provided
  responsibilities: z.string().optional(),
  authorities: z.string().optional(),
  qualifications: z.string().optional(),
  documentPath: z.string().max(255).optional(),
});

export const jobDescriptionUpdateSchema = z.object({
  responsibilities: z.string().optional(),
  authorities: z.string().optional(),
  qualifications: z.string().optional(),
  documentPath: z.string().max(255).optional(),
});

// ============================================
// Employee Schemas
// ============================================

// Shared field-level schemas so create + update stay in lockstep.
// Every card on the EmployeeForm maps to a group below — if a field
// isn't listed here the API strips it on parse() and the value never
// reaches the DB (this is what caused cards other than "ข้อมูลพนักงาน"
// to silently not persist).
const _employeeEnums = {
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  educationLevel: z
    .enum(['primary', 'secondary', 'vocational', 'bachelor', 'master', 'doctorate'])
    .optional(),
  militaryStatus: z.enum(['exempted', 'completed', 'pending', 'not_applicable']).optional(),
};

const _employeeExtraFields = {
  nickname: z.string().max(50).optional(),

  // Personal identification
  thaiCid: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  gender: _employeeEnums.gender,
  bloodType: _employeeEnums.bloodType,
  religion: z.string().max(50).optional(),
  maritalStatus: _employeeEnums.maritalStatus,
  nationalityCode: z.string().max(3).optional(),

  // Photo (set by the photo upload endpoint, but allow passthrough so the
  // edit page doesn't blank them out if the form sends them back)
  photoUrl: z.string().optional(),
  photoThumbnailUrl: z.string().optional(),

  // Government IDs
  ssoNumber: z.string().max(20).optional(),
  taxId: z.string().max(20).optional(),

  // Address — current
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  subDistrict: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(10).optional(),

  // Address — permanent
  permanentAddressLine1: z.string().max(200).optional(),
  permanentAddressLine2: z.string().max(200).optional(),
  permanentSubDistrict: z.string().max(100).optional(),
  permanentDistrict: z.string().max(100).optional(),
  permanentProvince: z.string().max(100).optional(),
  permanentPostalCode: z.string().max(10).optional(),
  useSameAddress: z.boolean().optional(),

  // Emergency contact
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactRelation: z.string().max(50).optional(),
  emergencyContactPhone: z.string().max(20).optional(),

  // Banking
  bankName: z.string().max(100).optional(),
  bankBranch: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(30).optional(),
  bankAccountName: z.string().max(100).optional(),

  // Education
  educationLevel: _employeeEnums.educationLevel,
  educationField: z.string().max(100).optional(),
  educationInstitution: z.string().max(200).optional(),

  // Military / medical
  militaryStatus: _employeeEnums.militaryStatus,
  medicalNotes: z.string().max(2000).optional(),
};

export const employeeCreateSchema = z.object({
  userId: z.number().int().positive().optional(),
  employeeCode: z
    .string()
    .min(1, 'รหัสพนักงานจำเป็น')
    .max(20, 'รหัสพนักงานต้องไม่เกิน 20 ตัวอักษร'),
  firstName: z
    .string()
    .min(1, 'ชื่อจำเป็น')
    .max(50, 'ชื่อต้องไม่เกิน 50 ตัวอักษร'),
  lastName: z
    .string()
    .min(1, 'นามสกุลจำเป็น')
    .max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร'),
  firstNameEn: z.string().max(50).optional(),
  lastNameEn: z.string().max(50).optional(),
  email: z.string().email('อีเมลไม่ถูกต้อง').max(100).optional(),
  phone: z
    .string()
    .regex(/^0[0-9]{8,9}$/, 'เบอร์โทรศัพท์ไม่ถูกต้อง')
    .optional()
    .or(z.literal('')),
  positionId: z.number().int().positive().optional(),
  orgUnitId: z.number().int().positive().optional(),
  siteId: z.number().int().positive().optional(),
  hireDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มงานต้องเป็นวันที่ที่ถูกต้อง',
  }),
  ..._employeeExtraFields,
});

export const employeeUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  firstNameEn: z.string().max(50).optional(),
  lastNameEn: z.string().max(50).optional(),
  email: z.string().email().max(100).optional(),
  phone: z
    .string()
    .regex(/^0[0-9]{8,9}$/)
    .optional()
    .or(z.literal('')),
  positionId: z.number().int().positive().nullable().optional(),
  orgUnitId: z.number().int().positive().nullable().optional(),
  siteId: z.number().int().positive().nullable().optional(),
  status: employeeStatusSchema.optional(),
  terminationDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  hireDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  ..._employeeExtraFields,
});

// ============================================
// Employee Assignment Schemas
// ============================================

export const employeeAssignmentCreateSchema = z.object({
  employeeId: z.number().int().positive('กรุณาเลือกพนักงาน'),
  positionId: z.number().int().positive().optional(),
  orgUnitId: z.number().int().positive().optional(),
  isPrimary: z.boolean().default(false),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มมีผลต้องเป็นวันที่ที่ถูกต้อง',
  }),
  reason: z.string().max(255).optional(),
});

// ============================================
// Training Course Schemas
// ============================================

export const trainingCourseCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสหลักสูตรจำเป็น')
    .max(20, 'รหัสหลักสูตรต้องไม่เกิน 20 ตัวอักษร'),
  name: z
    .string()
    .min(1, 'ชื่อหลักสูตรจำเป็น')
    .max(100, 'ชื่อหลักสูตรต้องไม่เกิน 100 ตัวอักษร'),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  category: z.string().max(50).optional(),
  validityDays: z.number().int().positive().optional(),
  isMandatory: z.boolean().optional().default(false),
  targetPositions: z.array(z.number().int().positive()).optional(),
  durationHours: z.number().positive().optional(),
});

export const trainingCourseUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  category: z.string().max(50).optional(),
  validityDays: z.number().int().positive().optional(),
  isMandatory: z.boolean().optional(),
  targetPositions: z.array(z.number().int().positive()).optional(),
  durationHours: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Training Session Schemas
// ============================================

export const trainingSessionCreateSchema = z.object({
  courseId: z.number().int().positive('กรุณาเลือกหลักสูตร'),
  sessionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่อบรมต้องเป็นวันที่ที่ถูกต้อง',
  }),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'เวลาเริ่มต้องอยู่ในรูปแบบ HH:MM')
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:MM')
    .optional(),
  location: z.string().max(100).optional(),
  instructorId: z.number().int().positive().optional(),
  instructorExternal: z.string().max(100).optional(),
  maxParticipants: z.number().int().positive().optional(),
});

export const trainingSessionUpdateSchema = z.object({
  sessionDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  location: z.string().max(100).optional(),
  instructorId: z.number().int().positive().optional(),
  instructorExternal: z.string().max(100).optional(),
  maxParticipants: z.number().int().positive().optional(),
  status: trainingSessionStatusSchema.optional(),
  notes: z.string().optional(),
});

// ============================================
// Training Record Schemas
// ============================================

export const trainingRecordCreateSchema = z.object({
  employeeId: z.number().int().positive('กรุณาเลือกพนักงาน'),
  sessionId: z.number().int().positive().optional(),
  courseId: z.number().int().positive('กรุณาเลือกหลักสูตร'),
  completionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เสร็จสิ้นต้องเป็นวันที่ที่ถูกต้อง',
  }),
  result: trainingResultSchema,
  score: z.number().min(0).max(100).optional(),
  assessedBy: z.number().int().positive().optional(),
  certificateNumber: z.string().max(50).optional(),
  notes: z.string().optional(),
});

// ============================================
// Authorization Schemas
// ============================================

export const authorizationCreateSchema = z.object({
  employeeId: z.number().int().positive('กรุณาเลือกพนักงาน'),
  authType: authorizationTypeSchema,
  scopeSiteId: z.number().int().positive().optional(),
  scopeOrgUnitId: z.number().int().positive().optional(),
  scopeProductLines: z.array(z.string()).optional(),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มมีผลต้องเป็นวันที่ที่ถูกต้อง',
  }),
  effectiveTo: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
});

export const authorizationUpdateSchema = z.object({
  effectiveTo: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  isActive: z.boolean().optional(),
});

export const authorizationCheckSchema = z.object({
  employeeId: z.number().int().positive(),
  authType: authorizationTypeSchema,
  siteId: z.number().int().positive().optional(),
  orgUnitId: z.number().int().positive().optional(),
  productLine: z.string().optional(),
});

// ============================================
// Delegation Schemas
// ============================================

export const delegationCreateSchema = z.object({
  authorizationId: z.number().int().positive('กรุณาเลือกสิทธิ์'),
  delegateId: z.number().int().positive('กรุณาเลือกผู้รับมอบอำนาจ'),
  reason: z.string().max(255).optional(),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มมีผลต้องเป็นวันที่ที่ถูกต้อง',
  }),
  effectiveTo: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่สิ้นสุดต้องเป็นวันที่ที่ถูกต้อง',
  }),
});

// ============================================
// Health Record Schemas
// ============================================

export const healthRecordCreateSchema = z.object({
  employeeId: z.number().int().positive('กรุณาเลือกพนักงาน'),
  examinationType: examinationTypeSchema,
  examinationDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่ตรวจต้องเป็นวันที่ที่ถูกต้อง',
  }),
  nextExamDue: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  fitnessStatus: fitnessStatusSchema,
  restrictions: z.string().optional(),
  affectedAreas: z.array(z.string()).optional(),
  medicalDetails: z.string().optional(), // SENSITIVE
  examinerName: z.string().max(100).optional(),
  examinerNotes: z.string().optional(), // SENSITIVE
});

export const healthRecordQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  examinationType: examinationTypeSchema.optional(),
  fitnessStatus: fitnessStatusSchema.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const healthRecordUpdateSchema = z.object({
  examinationType: examinationTypeSchema.optional(),
  examinationDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  nextExamDue: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional()
    .nullable(),
  fitnessStatus: fitnessStatusSchema.optional(),
  restrictions: z.string().optional().nullable(),
  affectedAreas: z.array(z.string()).optional().nullable(),
  medicalDetails: z.string().optional().nullable(),
  examinerName: z.string().max(100).optional().nullable(),
  examinerNotes: z.string().optional().nullable(),
});

// ============================================
// Role Schemas
// ============================================

export const appRoleCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสบทบาทจำเป็น')
    .max(50, 'รหัสบทบาทต้องไม่เกิน 50 ตัวอักษร')
    .regex(/^[a-z_]+$/, 'รหัสบทบาทต้องเป็นตัวพิมพ์เล็กและขีดล่างเท่านั้น'),
  name: z
    .string()
    .min(1, 'ชื่อบทบาทจำเป็น')
    .max(100, 'ชื่อบทบาทต้องไม่เกิน 100 ตัวอักษร'),
  description: z.string().max(255).optional(),
});

export const appRoleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Employee Role Schemas
// ============================================

export const employeeRoleCreateSchema = z.object({
  employeeId: z.number().int().positive('กรุณาเลือกพนักงาน'),
  roleId: z.number().int().positive('กรุณาเลือกบทบาท'),
  scopeSiteId: z.number().int().positive().optional(),
  scopeOrgUnitId: z.number().int().positive().optional(),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่เริ่มมีผลต้องเป็นวันที่ที่ถูกต้อง',
  }),
  effectiveTo: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
});

// ============================================
// Query Parameter Schemas
// ============================================

export const orgUnitQuerySchema = z.object({
  type: orgUnitTypeSchema.optional(),
  parentId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

export const employeeQuerySchema = z.object({
  orgUnitId: z.coerce.number().int().positive().optional(),
  positionId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  status: employeeStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const trainingRecordQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  status: trainingRecordStatusSchema.optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const authorizationQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  authType: authorizationTypeSchema.optional(),
  siteId: z.coerce.number().int().positive().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type OrgUnitCreateInput = z.infer<typeof orgUnitCreateSchema>;
export type OrgUnitUpdateInput = z.infer<typeof orgUnitUpdateSchema>;
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;
export type PositionUpdateInput = z.infer<typeof positionUpdateSchema>;
export type JobDescriptionCreateInput = z.infer<typeof jobDescriptionCreateSchema>;
export type JobDescriptionUpdateInput = z.infer<typeof jobDescriptionUpdateSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type EmployeeAssignmentCreateInput = z.infer<typeof employeeAssignmentCreateSchema>;
export type TrainingCourseCreateInput = z.infer<typeof trainingCourseCreateSchema>;
export type TrainingCourseUpdateInput = z.infer<typeof trainingCourseUpdateSchema>;
export type TrainingSessionCreateInput = z.infer<typeof trainingSessionCreateSchema>;
export type TrainingSessionUpdateInput = z.infer<typeof trainingSessionUpdateSchema>;
export type TrainingRecordCreateInput = z.infer<typeof trainingRecordCreateSchema>;
export type AuthorizationCreateInput = z.infer<typeof authorizationCreateSchema>;
export type AuthorizationUpdateInput = z.infer<typeof authorizationUpdateSchema>;
export type AuthorizationCheckInput = z.infer<typeof authorizationCheckSchema>;
export type DelegationCreateInput = z.infer<typeof delegationCreateSchema>;
export type HealthRecordCreateInput = z.infer<typeof healthRecordCreateSchema>;
export type AppRoleCreateInput = z.infer<typeof appRoleCreateSchema>;
export type AppRoleUpdateInput = z.infer<typeof appRoleUpdateSchema>;
export type EmployeeRoleCreateInput = z.infer<typeof employeeRoleCreateSchema>;
export type OrgUnitQueryInput = z.infer<typeof orgUnitQuerySchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
export type TrainingRecordQueryInput = z.infer<typeof trainingRecordQuerySchema>;
export type AuthorizationQueryInput = z.infer<typeof authorizationQuerySchema>;
