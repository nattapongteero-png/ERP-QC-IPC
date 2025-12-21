# Phase 0: Research Findings - HR/Personnel Management Module

**Date**: 2025-12-21
**Feature**: 007-hr-personnel-management

## Research Tasks Summary

| Task | Decision | Rationale |
|------|----------|-----------|
| Org Chart Visualization | DevExtreme TreeList + Diagram | TreeList for hierarchy editing, Diagram for visual display |
| Training Notifications | API cron routes + email service | Matches existing architecture pattern |
| Authorization Caching | In-memory cache + TTL | Sub-200ms requirement, invalidate on changes |
| Health Record Privacy | Service-layer filtering | Role-based field exclusion before response |
| Delegation Logic | Date-range query with OR logic | Check original OR active delegation |

---

## 1. Organization Chart Visualization

### Decision
Use **DevExtreme TreeList** for interactive org chart editing and **DevExtreme Diagram** for read-only visual organization chart display.

### Rationale
- **TreeList**: Already used in project for hierarchical data (BOM). Supports drag-drop reordering, inline editing, and expand/collapse. Perfect for HR admin editing org structure.
- **Diagram**: Provides professional org chart visualization with automatic layout. Read-only display for managers/employees.

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Custom D3.js implementation | Over-engineering; DevExtreme provides built-in solution |
| TreeView only | No visual org chart capability |
| Third-party org chart library | Adds dependency; DevExtreme already licensed |

### Implementation Notes
```typescript
// TreeList for editing (src/components/hr/OrgChartTree.tsx)
<TreeList
  dataSource={orgUnits}
  keyExpr="id"
  parentIdExpr="parentId"
  columns={['code', 'name', 'type', 'effectiveFrom']}
  editing={{ mode: 'row', allowUpdating: true }}
/>

// Diagram for display (src/components/hr/OrgChartDiagram.tsx)
<Diagram
  nodes={orgNodes}
  edges={orgEdges}
  autoLayout={{ type: 'tree', orientation: 'vertical' }}
/>
```

---

## 2. Training Expiration Notifications

### Decision
Use **Next.js API route cron** pattern with existing audit trail + future email service integration.

### Rationale
- Matches existing project patterns (see `/api/purchasing/vmi/cron/` routes)
- Vercel/self-hosted cron can trigger `/api/hr/training/notifications/check` endpoint
- Notifications stored in database table initially; email service added later

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| External scheduler (BullMQ) | Adds infrastructure complexity |
| Client-side polling | Unreliable; misses offline users |
| Database triggers | Not portable across SQLite/MySQL |

### Implementation Notes
```typescript
// /api/hr/training/notifications/check/route.ts
export async function GET() {
  const expiringRecords = await trainingService.getExpiringCertifications(30); // days

  for (const record of expiringRecords) {
    await notificationService.createNotification({
      employeeId: record.employeeId,
      type: 'training_expiring',
      message: `Training "${record.courseName}" expires on ${record.expiryDate}`,
    });
  }

  return NextResponse.json({ processed: expiringRecords.length });
}
```

---

## 3. Authorization Caching

### Decision
Use **in-memory Map cache** with TTL (5 minutes) and event-based invalidation.

### Rationale
- Sub-200ms requirement for authorization checks is critical path
- Simple Map cache avoids external dependency (Redis)
- Invalidate on authorization/delegation CRUD operations
- Cache key: `${employeeId}:${authType}:${scope}`

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Redis cache | Over-engineering for single-server deployment |
| No cache (always query) | Fails <200ms requirement for complex delegation checks |
| Request-level cache only | Doesn't help repeated checks within same request |

### Implementation Notes
```typescript
// src/lib/services/authorization.service.ts
const authCache = new Map<string, { result: boolean; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function checkAuthorization(
  employeeId: number,
  authType: AuthorizationType,
  scope: AuthScope
): Promise<boolean> {
  const cacheKey = `${employeeId}:${authType}:${JSON.stringify(scope)}`;
  const cached = authCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const result = await queryAuthorization(employeeId, authType, scope);
  authCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL });

  return result;
}

export function invalidateAuthCache(employeeId?: number): void {
  if (employeeId) {
    // Invalidate specific employee
    for (const key of authCache.keys()) {
      if (key.startsWith(`${employeeId}:`)) {
        authCache.delete(key);
      }
    }
  } else {
    authCache.clear();
  }
}
```

---

## 4. Health Record Privacy

### Decision
Implement **service-layer field filtering** based on caller's role before returning response.

### Rationale
- Drizzle ORM doesn't support row-level or field-level security natively
- Service layer already handles business logic; natural place for access control
- Health staff sees full record; others see only fitness status (Fit/Unfit/Restricted)
- Simpler than database views or middleware filtering

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Database views per role | Complex to manage; doesn't work with SQLite testing |
| Middleware filtering | Scattered logic; harder to test |
| Separate tables | Data duplication; sync issues |

### Implementation Notes
```typescript
// src/lib/services/health.service.ts
interface HealthRecordFull {
  id: number;
  employeeId: number;
  examinationType: string;
  examinationDate: string;
  fitnessStatus: 'fit' | 'unfit' | 'restricted';
  restrictions?: string;
  medicalDetails?: string;  // SENSITIVE
  examinerNotes?: string;   // SENSITIVE
}

interface HealthRecordPublic {
  id: number;
  employeeId: number;
  examinationType: string;
  examinationDate: string;
  fitnessStatus: 'fit' | 'unfit' | 'restricted';
  restrictions?: string;
}

export function filterHealthRecord(
  record: HealthRecordFull,
  callerRole: string
): HealthRecordFull | HealthRecordPublic {
  const healthRoles = ['health_staff', 'admin'];

  if (healthRoles.includes(callerRole)) {
    return record;
  }

  // Strip sensitive fields
  const { medicalDetails, examinerNotes, ...publicRecord } = record;
  return publicRecord;
}
```

---

## 5. Delegation Logic

### Decision
Use **date-range OR query** to check both direct authorization and active delegations.

### Rationale
- Delegations have explicit date ranges (effectiveFrom/effectiveTo)
- Authorization check must find: direct auth OR valid delegation within current date
- Single query with OR conditions is simpler than multiple queries
- Delegation table references original authorization for scope inheritance

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Separate queries + merge | Performance overhead; 2+ DB roundtrips |
| Materialized view | Not portable across SQLite/MySQL |
| Copy authorization on delegation | Data duplication; revocation complexity |

### Implementation Notes
```typescript
// Query pattern for authorization check with delegation
async function queryAuthorization(
  employeeId: number,
  authType: AuthorizationType,
  scope: AuthScope
): Promise<boolean> {
  const now = new Date().toISOString();

  // Check direct authorization OR delegation
  const result = await db
    .select({ count: sql`count(*)` })
    .from(authorizations)
    .leftJoin(delegations, eq(delegations.authorizationId, authorizations.id))
    .where(
      and(
        eq(authorizations.authType, authType),
        eq(authorizations.scopeSite, scope.site),
        lte(authorizations.effectiveFrom, now),
        or(
          isNull(authorizations.effectiveTo),
          gte(authorizations.effectiveTo, now)
        ),
        or(
          // Direct authorization
          eq(authorizations.employeeId, employeeId),
          // Active delegation
          and(
            eq(delegations.delegateId, employeeId),
            lte(delegations.effectiveFrom, now),
            or(
              isNull(delegations.effectiveTo),
              gte(delegations.effectiveTo, now)
            )
          )
        )
      )
    );

  return result[0].count > 0;
}
```

---

## Additional Technical Decisions

### 6. Separation of Duties Enforcement

**Decision**: Enforce at org unit assignment level, not role level.

**Implementation**: When assigning employee to Production org unit, block if they have active QC authorization, and vice versa. Warning on org chart structure if QC reports to Production.

### 7. Audit Trail Integration

**Decision**: Extend existing `audit_trail` table with HR-specific action types.

**Implementation**: Add action types: `HR_ORG_CREATE`, `HR_ORG_UPDATE`, `HR_EMP_CREATE`, `HR_EMP_DEACTIVATE`, `HR_AUTH_GRANT`, `HR_AUTH_REVOKE`, `HR_DELEGATE_CREATE`, `HR_TRAINING_COMPLETE`.

### 8. Employee ID as Primary Identifier

**Decision**: Use existing `users.id` as employee ID; extend `users` table with HR fields OR create linked `employees` table.

**Chosen**: Create linked `employees` table to separate HR data from auth concerns. Reference `users.id` for authentication linkage.

---

## Research Complete

All NEEDS CLARIFICATION items resolved. Ready for Phase 1: Design & Contracts.
