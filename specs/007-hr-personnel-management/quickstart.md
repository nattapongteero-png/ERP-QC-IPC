# Quickstart Guide: HR/Personnel Management Module

**Feature**: 007-hr-personnel-management
**Date**: 2025-12-21

## Prerequisites

- Node.js 20.x or higher
- pnpm package manager
- MySQL 8.0+ (production) or SQLite (development/testing)
- Existing herbal-medicine-erp project setup

## Setup Steps

### 1. Switch to Feature Branch

```bash
git checkout 007-hr-personnel-management
```

### 2. Install Dependencies

No new dependencies required - uses existing:
- `drizzle-orm` - Database ORM
- `devextreme-react` - UI components
- `zod` - Validation
- `@tanstack/react-query` - Data fetching

### 3. Database Setup

The HR module adds 16 new tables with `hr_` prefix. Run schema sync:

```bash
# Development (SQLite)
DB_TYPE=sqlite pnpm db:push

# Production (MySQL)
pnpm db:push
```

### 4. Seed Initial Data (Optional)

Seed roles, permissions, and sample org structure:

```bash
DB_TYPE=sqlite pnpm db:seed:hr
```

## Development

### Run Development Server

```bash
pnpm dev
```

Access HR module at: `http://localhost:3000/hr`

### Run Tests

```bash
# All HR tests
pnpm test src/lib/services/hr
pnpm test tests/integration/api/hr

# Specific test file
pnpm test src/lib/services/hr.service.test.ts
```

### Type Check

```bash
pnpm tsc --noEmit
```

### Lint

```bash
pnpm lint
```

## Key Files

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/hr/org-units` | Organization structure CRUD |
| `/api/hr/positions` | Position management |
| `/api/hr/employees` | Employee profiles |
| `/api/hr/training/courses` | Training catalog |
| `/api/hr/training/records` | Training completions |
| `/api/hr/authorizations` | Authorization grants |
| `/api/hr/authorizations/check` | Authorization validation |
| `/api/hr/health-records` | Health records (restricted) |
| `/api/hr/roles` | Application roles |

### UI Pages

| Page | Purpose |
|------|---------|
| `/hr/org-chart` | Organization chart viewer |
| `/hr/employees` | Employee directory |
| `/hr/employees/[id]` | Employee profile |
| `/hr/positions` | Position management |
| `/hr/training/courses` | Training catalog |
| `/hr/training/matrix` | Competency matrix |
| `/hr/authorizations` | Authorization management |
| `/hr/audit` | HR audit log |

### Services

| Service | Purpose |
|---------|---------|
| `hr.service.ts` | Org units, positions, employees |
| `training.service.ts` | Training courses, sessions, records |
| `authorization.service.ts` | Authorization checks with caching |
| `hr-audit.service.ts` | HR-specific audit logging |

## Key Concepts

### Organization Hierarchy

```
Company
└── Site
    └── Division
        └── Department
            └── Section
                └── Unit
```

GMP Rule: QC/QA departments must NOT report to Production.

### Authorization Types

| Type | Used For |
|------|----------|
| `batch_release` | Release product batches |
| `sop_approval` | Approve SOPs |
| `deviation_approval` | Approve deviations |
| `change_control_approval` | Approve changes |
| `capa_approval` | Approve CAPA actions |

### Training Status

| Status | Description |
|--------|-------------|
| `valid` | Certification current |
| `expiring_soon` | Expires within 30 days |
| `expired` | Certification lapsed |
| `not_taken` | Never completed |

### Health Fitness Status

| Status | Description |
|--------|-------------|
| `fit` | No restrictions |
| `unfit` | Cannot work |
| `restricted` | Can work with limitations |

## Common Tasks

### Create Organization Unit

```typescript
// POST /api/hr/org-units
const response = await fetch('/api/hr/org-units', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'PROD-001',
    name: 'Production Department',
    type: 'department',
    parentId: 1, // Site ID
    effectiveFrom: '2025-01-01',
    isGmpCritical: true,
  }),
});
```

### Check Authorization

```typescript
// GET /api/hr/authorizations/check?employeeId=5&authType=batch_release&siteId=1
const response = await fetch(
  '/api/hr/authorizations/check?' + new URLSearchParams({
    employeeId: '5',
    authType: 'batch_release',
    siteId: '1',
  })
);
const { authorized, source, expiresAt } = await response.json();
```

### Get Competency Matrix

```typescript
// GET /api/hr/training/competency-matrix?orgUnitId=3
const response = await fetch('/api/hr/training/competency-matrix?orgUnitId=3');
const { courses, employees } = await response.json();
```

## Testing Strategy

### Unit Tests

Test services with mocked database:

```typescript
// hr.service.test.ts
describe('HRService', () => {
  it('should create org unit with valid hierarchy', async () => {
    const orgUnit = await hrService.createOrgUnit({
      code: 'TEST-001',
      name: 'Test Unit',
      type: 'department',
      parentId: parentSiteId,
      effectiveFrom: new Date(),
    });
    expect(orgUnit.id).toBeDefined();
  });

  it('should block QC under Production', async () => {
    await expect(
      hrService.createOrgUnit({
        code: 'QC-001',
        name: 'QC',
        type: 'department',
        parentId: productionDeptId, // Should fail
        effectiveFrom: new Date(),
      })
    ).rejects.toThrow('Separation of duties violation');
  });
});
```

### Integration Tests

Test API endpoints with SQLite:

```typescript
// org-units.test.ts
describe('GET /api/hr/org-units', () => {
  it('should return org unit tree', async () => {
    const response = await GET('/api/hr/org-units/tree');
    expect(response.status).toBe(200);
    const tree = await response.json();
    expect(tree[0].children).toBeDefined();
  });
});
```

### Authorization Cache Testing

```typescript
// authorization.service.test.ts
describe('Authorization Cache', () => {
  it('should return cached result on second call', async () => {
    const first = await authService.checkAuthorization(1, 'batch_release', { siteId: 1 });
    const second = await authService.checkAuthorization(1, 'batch_release', { siteId: 1 });
    // Verify same result, only 1 DB query
    expect(first).toBe(second);
  });

  it('should invalidate cache on authorization change', async () => {
    await authService.checkAuthorization(1, 'batch_release', { siteId: 1 });
    await authService.revokeAuthorization(1);
    // Next check should query DB again
  });
});
```

## Troubleshooting

### "Separation of duties violation" Error

QC/QA org units cannot be placed under Production hierarchy. Restructure the organization to keep QC/QA independent.

### "Unauthorized: health_staff role required"

Health record details (medical notes) are restricted. Log in as a user with `health_staff` role.

### "Training expired: cannot perform action"

Employee's required training has expired. Complete recertification before performing training-gated actions.

### Authorization check slow (>200ms)

Clear authorization cache if stale, or check for missing database indexes on `hr_authorizations` and `hr_delegations` tables.

## Next Steps

1. Implement schema changes (see `data-model.md`)
2. Create API routes following `contracts/hr-api.yaml`
3. Build UI components with DevExtreme
4. Write tests for all services
5. Run `/speckit.tasks` to generate detailed task list
