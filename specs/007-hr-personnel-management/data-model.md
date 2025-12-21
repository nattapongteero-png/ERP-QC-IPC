# Phase 1: Data Model - HR/Personnel Management Module

**Date**: 2025-12-21
**Feature**: 007-hr-personnel-management

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION STRUCTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐      │
│   │   OrgUnit   │◄────────│  Position   │◄────────│  Employee   │      │
│   │ (hierarchy) │         │ (job desc)  │         │ (profile)   │      │
│   └─────────────┘         └─────────────┘         └──────┬──────┘      │
│         │                       │                        │              │
│         │ parent                │ position               │              │
│         ▼                       ▼                        │              │
│   ┌─────────────┐         ┌─────────────┐               │              │
│   │   OrgUnit   │         │ JobDescDoc  │               │              │
│   │  (child)    │         │ (versioned) │               │              │
│   └─────────────┘         └─────────────┘               │              │
│                                                         │              │
└─────────────────────────────────────────────────────────┼──────────────┘
                                                          │
┌─────────────────────────────────────────────────────────┼──────────────┐
│                          TRAINING                        │              │
├─────────────────────────────────────────────────────────┼──────────────┤
│                                                         │              │
│   ┌──────────────┐       ┌───────────────┐       ┌──────┴──────┐      │
│   │TrainingCourse│◄──────│TrainingSession│◄──────│TrainingRecord│      │
│   │  (catalog)   │       │  (scheduled)  │       │(completion) │      │
│   └──────────────┘       └───────────────┘       └─────────────┘      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐         ┌─────────────┐                              │
│   │Authorization│◄────────│ Delegation  │                              │
│   │  (grants)   │         │(temp assign)│                              │
│   └──────┬──────┘         └─────────────┘                              │
│          │                                                              │
│          │ employee                                                     │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  Employee   │                                                       │
│   └─────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     ROLES & PERMISSIONS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐         ┌────────────────┐         ┌─────────────┐   │
│   │  AppRole    │◄────────│ RolePermission │─────────►│ Permission  │   │
│   └──────┬──────┘         └────────────────┘         └─────────────┘   │
│          │                                                              │
│          │ role                                                         │
│          ▼                                                              │
│   ┌──────────────┐                                                      │
│   │ EmployeeRole │──────────► Employee                                  │
│   └──────────────┘                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         HEALTH & AUDIT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐         ┌─────────────┐                              │
│   │HealthRecord │─────────►  Employee   ◄──────────│ HRAuditLog  │      │
│   │(restricted) │         └─────────────┘          │ (immutable) │      │
│   └─────────────┘                                  └─────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Definitions

### 1. OrgUnit (Organization Unit)

Represents a node in the organizational hierarchy.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| code | string(50) | unique, not null | Organization unit code (e.g., "PROD-001") |
| name | string(255) | not null | Display name |
| nameEn | string(255) | | English name |
| type | enum | not null | company, site, division, department, section, unit |
| parentId | integer | FK → OrgUnit.id | Parent org unit (null for root) |
| siteId | integer | FK → OrgUnit.id | Reference to site-level org unit |
| isGmpCritical | boolean | default: false | GMP-critical designation |
| effectiveFrom | date | not null | Start of validity |
| effectiveTo | date | | End of validity (null = current) |
| isActive | boolean | default: true | Soft delete flag |
| createdAt | datetime | not null | Record creation time |
| updatedAt | datetime | not null | Last update time |

**Indexes**: `code`, `parentId`, `type`, `isActive`

**Validation Rules**:
- QC/QA departments cannot have Production as parent (separation of duties)
- Code format: uppercase alphanumeric with hyphens
- effectiveFrom < effectiveTo when both set

---

### 2. Position

Represents a job role within the organization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| code | string(50) | unique, not null | Position code |
| title | string(255) | not null | Position title |
| titleEn | string(255) | | English title |
| orgUnitId | integer | FK → OrgUnit.id, not null | Department/section this position belongs to |
| jobGrade | string(20) | | Job grade/level |
| isGmpCritical | boolean | default: false | Requires special training/auth |
| isActive | boolean | default: true | Soft delete flag |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `code`, `orgUnitId`, `isActive`

---

### 3. JobDescription

Version-controlled job description documents linked to positions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| positionId | integer | FK → Position.id, not null | Position this JD belongs to |
| version | string(20) | not null | Version number (e.g., "1.0", "1.1") |
| responsibilities | text | | Job responsibilities |
| authorities | text | | Decision-making authorities |
| qualifications | text | | Required qualifications |
| documentPath | string(500) | | Path to full JD document |
| status | enum | not null, default: draft | draft, pending_approval, approved, obsolete |
| effectiveFrom | date | | Effective date (when approved) |
| effectiveTo | date | | End date (when obsoleted) |
| approvedBy | integer | FK → Employee.id | Approving employee |
| approvedAt | datetime | | Approval timestamp |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `positionId`, `status`, `version`

---

### 4. Employee

Personnel record linked to system user for authentication.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| userId | integer | FK → users.id, unique | Link to auth user |
| employeeCode | string(20) | unique, not null | HR Employee ID |
| firstName | string(100) | not null | First name |
| lastName | string(100) | not null | Last name |
| firstNameEn | string(100) | | English first name |
| lastNameEn | string(100) | | English last name |
| email | string(255) | | Work email |
| phone | string(50) | | Contact phone |
| positionId | integer | FK → Position.id | Current position |
| orgUnitId | integer | FK → OrgUnit.id | Current department |
| siteId | integer | FK → OrgUnit.id | Assigned site |
| hireDate | date | not null | Date of hire |
| terminationDate | date | | Date of termination |
| status | enum | not null, default: active | active, inactive, terminated |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `employeeCode`, `userId`, `positionId`, `orgUnitId`, `status`

**Validation Rules**:
- employeeCode format: alphanumeric, 5-20 characters
- When status = inactive or terminated, linked user must be deactivated

---

### 5. EmployeeAssignment

Historical record of position/department assignments.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Employee |
| positionId | integer | FK → Position.id | Position at time of assignment |
| orgUnitId | integer | FK → OrgUnit.id | Department at time of assignment |
| isPrimary | boolean | default: true | Primary assignment flag |
| effectiveFrom | date | not null | Start of assignment |
| effectiveTo | date | | End of assignment |
| reason | string(255) | | Reason for change (transfer, promotion, etc.) |
| createdAt | datetime | not null | |

**Indexes**: `employeeId`, `effectiveFrom`

---

### 6. TrainingCourse

Training catalog entry.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| code | string(50) | unique, not null | Course code |
| name | string(255) | not null | Course name |
| nameEn | string(255) | | English name |
| description | text | | Course description |
| category | string(100) | | GMP, SOP, Safety, Equipment, etc. |
| validityDays | integer | | Certification validity (null = no expiry) |
| isMandatory | boolean | default: false | Required for all employees |
| targetPositions | text | | JSON array of position IDs |
| targetRoles | text | | JSON array of role codes |
| durationHours | decimal | | Estimated duration |
| isActive | boolean | default: true | |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `code`, `category`, `isActive`

---

### 7. TrainingSession

Scheduled instance of a training course.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| courseId | integer | FK → TrainingCourse.id, not null | Course being delivered |
| sessionDate | date | not null | Session date |
| startTime | string(5) | | Start time (HH:MM) |
| endTime | string(5) | | End time (HH:MM) |
| location | string(255) | | Training location |
| instructorId | integer | FK → Employee.id | Instructor |
| instructorExternal | string(255) | | External instructor name |
| maxParticipants | integer | | Capacity limit |
| status | enum | not null, default: scheduled | scheduled, in_progress, completed, cancelled |
| notes | text | | |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `courseId`, `sessionDate`, `status`

---

### 8. TrainingRecord

Individual employee's training completion record.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Trainee |
| sessionId | integer | FK → TrainingSession.id | Session attended (null for external) |
| courseId | integer | FK → TrainingCourse.id, not null | Course |
| completionDate | date | not null | Date completed |
| expiryDate | date | | Certification expiry |
| result | enum | not null | pass, fail, incomplete |
| score | decimal | | Assessment score (0-100) |
| assessedBy | integer | FK → Employee.id | Assessor |
| certificateNumber | string(100) | | Certificate reference |
| notes | text | | |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `employeeId`, `courseId`, `expiryDate`, `result`

---

### 9. Authorization

Designation of employee as authorized for specific approval actions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Authorized employee |
| authType | enum | not null | batch_release, sop_approval, deviation_approval, change_control_approval, capa_approval |
| scopeSiteId | integer | FK → OrgUnit.id | Site scope (null = all sites) |
| scopeOrgUnitId | integer | FK → OrgUnit.id | Department scope |
| scopeProductLines | text | | JSON array of product line codes |
| effectiveFrom | date | not null | Authorization start |
| effectiveTo | date | | Authorization end |
| grantedBy | integer | FK → Employee.id, not null | Who granted |
| grantedAt | datetime | not null | When granted |
| revokedBy | integer | FK → Employee.id | Who revoked |
| revokedAt | datetime | | When revoked |
| isActive | boolean | default: true | |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `employeeId`, `authType`, `isActive`, `effectiveFrom`

---

### 10. Delegation

Temporary transfer of authorization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| authorizationId | integer | FK → Authorization.id, not null | Original authorization |
| delegatorId | integer | FK → Employee.id, not null | Who is delegating |
| delegateId | integer | FK → Employee.id, not null | Who receives delegation |
| reason | string(255) | | Reason (vacation, etc.) |
| effectiveFrom | date | not null | Delegation start |
| effectiveTo | date | not null | Delegation end |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `authorizationId`, `delegateId`, `effectiveFrom`, `effectiveTo`

**Validation Rules**:
- delegateId must have required training for the authorization type
- effectiveTo must be >= effectiveFrom
- Delegation period cannot exceed original authorization period

---

### 11. HealthRecord

Personnel health examination records (privacy-sensitive).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Employee |
| examinationType | enum | not null | pre_employment, periodic, special |
| examinationDate | date | not null | Exam date |
| nextExamDue | date | | Next scheduled exam |
| fitnessStatus | enum | not null | fit, unfit, restricted |
| restrictions | text | | Work restrictions (non-sensitive) |
| affectedAreas | text | | JSON array of work area codes |
| medicalDetails | text | | SENSITIVE - full medical notes |
| examinerName | string(255) | | Examining physician |
| examinerNotes | text | | SENSITIVE - examiner notes |
| recordedBy | integer | FK → Employee.id | Health staff who recorded |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `employeeId`, `examinationDate`, `fitnessStatus`

**Access Control**: `medicalDetails` and `examinerNotes` only visible to health_staff role.

---

### 12. AppRole

Application role definitions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| code | string(50) | unique, not null | Role code (e.g., "hr_admin") |
| name | string(100) | not null | Display name |
| description | text | | Role description |
| isSystemRole | boolean | default: false | Cannot be deleted |
| isActive | boolean | default: true | |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `code`, `isActive`

---

### 13. AppPermission

Individual permission definitions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| code | string(100) | unique, not null | Permission code (e.g., "hr:employees:write") |
| name | string(255) | not null | Display name |
| module | string(50) | not null | Module (hr, production, quality, etc.) |
| description | text | | |
| createdAt | datetime | not null | |

**Indexes**: `code`, `module`

---

### 14. RolePermission

Many-to-many relationship between roles and permissions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| roleId | integer | FK → AppRole.id, not null | Role |
| permissionId | integer | FK → AppPermission.id, not null | Permission |
| createdAt | datetime | not null | |

**Indexes**: `roleId`, `permissionId`, unique(`roleId`, `permissionId`)

---

### 15. EmployeeRole

Employee role assignments with scope.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Employee |
| roleId | integer | FK → AppRole.id, not null | Assigned role |
| scopeSiteId | integer | FK → OrgUnit.id | Site scope |
| scopeOrgUnitId | integer | FK → OrgUnit.id | Department scope |
| effectiveFrom | date | not null | Start date |
| effectiveTo | date | | End date |
| assignedBy | integer | FK → Employee.id | Who assigned |
| createdAt | datetime | not null | |
| updatedAt | datetime | not null | |

**Indexes**: `employeeId`, `roleId`, `effectiveFrom`

**Validation Rules**:
- Cannot assign conflicting roles (Production write + QC approval to same person)

---

### 16. HRNotification

Notifications for training expiry, health check due, etc.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto-increment | Unique identifier |
| employeeId | integer | FK → Employee.id, not null | Target employee |
| type | enum | not null | training_expiring, training_expired, health_check_due, authorization_expiring |
| title | string(255) | not null | Notification title |
| message | text | | Full message |
| referenceType | string(50) | | training_record, health_record, authorization |
| referenceId | integer | | Reference entity ID |
| isRead | boolean | default: false | |
| readAt | datetime | | |
| createdAt | datetime | not null | |

**Indexes**: `employeeId`, `type`, `isRead`, `createdAt`

---

## State Transitions

### Employee Status
```
active ──┬──► inactive ──► terminated
         │
         └──► terminated
```

### Job Description Status
```
draft ──► pending_approval ──┬──► approved ──► obsolete
                             │
                             └──► draft (rejected)
```

### Training Record Result
```
(created) ──► incomplete ──┬──► pass
                          │
                          └──► fail ──► (retake as new record)
```

### Authorization
```
(created: isActive=true) ──► (revokedAt set: isActive=false)
```

---

## Drizzle Schema Pattern

Following existing dual-schema pattern (SQLite for testing, MySQL for production):

```typescript
// SQLite
export const sqliteOrgUnits = sqliteTable('hr_org_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'company' | 'site' | 'division' | 'department' | 'section' | 'unit'
  parentId: integer('parent_id').references(() => sqliteOrgUnits.id),
  // ... other fields
});

// MySQL
export const mysqlOrgUnits = mysqlTable('hr_org_units', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  parentId: int('parent_id').references(() => mysqlOrgUnits.id),
  // ... other fields
});
```

**Table Prefix**: All HR tables use `hr_` prefix to distinguish from existing tables.

---

## Summary

| Entity | Table Name | Key Purpose |
|--------|-----------|-------------|
| OrgUnit | hr_org_units | Organization hierarchy |
| Position | hr_positions | Job roles |
| JobDescription | hr_job_descriptions | Version-controlled JDs |
| Employee | hr_employees | Personnel records |
| EmployeeAssignment | hr_employee_assignments | Assignment history |
| TrainingCourse | hr_training_courses | Training catalog |
| TrainingSession | hr_training_sessions | Scheduled sessions |
| TrainingRecord | hr_training_records | Completion records |
| Authorization | hr_authorizations | Approval authorities |
| Delegation | hr_delegations | Temporary delegations |
| HealthRecord | hr_health_records | Health exams |
| AppRole | hr_app_roles | Application roles |
| AppPermission | hr_app_permissions | Permissions |
| RolePermission | hr_role_permissions | Role-permission mapping |
| EmployeeRole | hr_employee_roles | Employee role assignments |
| HRNotification | hr_notifications | Notifications |

**Total**: 16 new tables
