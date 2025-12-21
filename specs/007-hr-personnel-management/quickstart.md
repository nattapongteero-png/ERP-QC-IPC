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

---

# Part 2: Responsive UI Redesign Implementation

**Added**: 2025-12-21
**Purpose**: Guide for making all HR pages mobile-friendly and desktop-friendly

## Responsive Implementation Overview

This section provides step-by-step instructions for implementing the responsive UI redesign for all 16 HR module pages.

## Implementation Order

### Phase 1: Shared Components (Do First)

Create these shared components before modifying any pages:

| Order | Component | File | Dependencies |
|-------|-----------|------|--------------|
| 1 | StatCard | `src/components/shared/stat-card.tsx` | None |
| 2 | ResponsivePageHeader | `src/components/shared/responsive-page-header.tsx` | DxButton |
| 3 | ResponsiveFormLayout | `src/components/shared/responsive-form-layout.tsx` | None |
| 4 | MobileListView | `src/components/shared/mobile-list-view.tsx` | None |
| 5 | Update shared index | `src/components/shared/index.ts` | All above |

### Phase 2: Priority 1 Pages (High Traffic)

| Order | Page | Path | Key Changes |
|-------|------|------|-------------|
| 1 | HR Dashboard | `/hr` | Add ResponsivePageHeader, improve stat cards grid |
| 2 | Employees List | `/hr/employees` | Add responsive columns, mobile card view |
| 3 | New Employee | `/hr/employees/new` | Use ResponsiveFormLayout |
| 4 | Training Landing | `/hr/training` | Responsive stats, card grid |

### Phase 3: Priority 2 Pages (Core Management)

| Order | Page | Path | Key Changes |
|-------|------|------|-------------|
| 5 | Positions | `/hr/positions` | Responsive grid + form panel |
| 6 | Org Structure | `/hr/org` | Responsive TreeList |
| 7 | Training Courses | `/hr/training/courses` | Responsive columns |
| 8 | Training Sessions | `/hr/training/sessions` | Responsive columns |

### Phase 4: Priority 3 Pages (Specialized)

| Order | Page | Path |
|-------|------|------|
| 9 | Org Chart | `/hr/org-chart` |
| 10 | Competency Matrix | `/hr/training/matrix` |
| 11 | Authorizations | `/hr/authorizations` |
| 12 | Health Records | `/hr/health-records` |
| 13 | Roles | `/hr/roles` |
| 14 | Notifications | `/hr/notifications` |
| 15 | Audit Log | `/hr/audit` |
| 16 | Employee Detail | `/hr/employees/[id]` |

---

## Component Implementation Examples

### StatCard Component

```tsx
// src/components/shared/stat-card.tsx
'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  accentColor?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  onClick?: () => void;
  href?: string;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-emerald-500',
  accentColor = 'border-emerald-500',
  trend,
  onClick,
  href,
  isLoading = false,
  className = '',
}: StatCardProps) {
  const content = (
    <div
      className={`bg-white rounded-lg shadow p-4 border-l-4 ${accentColor} ${
        onClick || href ? 'hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          {trend && (
            <p className={`text-xs flex items-center gap-1 mt-1 ${
              trend.direction === 'up' ? 'text-green-600' :
              trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.direction === 'neutral' && '→'}
              {trend.value}
            </p>
          )}
        </div>
        {Icon && <Icon className={`h-8 w-8 ${iconColor}`} />}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
```

### ResponsivePageHeader Component

```tsx
// src/components/shared/responsive-page-header.tsx
'use client';

import Link from 'next/link';
import { DxButton } from '@/components/ui/dx-button';
import type { LucideIcon } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ResponsivePageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function ResponsivePageHeader({
  title,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-emerald-100',
  iconColor = 'text-emerald-600',
  actions,
  onBack,
  breadcrumbs,
  className = '',
}: ResponsivePageHeaderProps) {
  return (
    <div className={className}>
      {/* Breadcrumbs - hidden on mobile */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-sm text-gray-500 mb-2 hidden md:block">
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className="mx-2">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-emerald-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title section */}
        <div className="flex items-center gap-4">
          {onBack && (
            <DxButton
              icon="back"
              type="default"
              stylingMode="text"
              onClick={onBack}
            />
          )}
          {Icon && (
            <div className={`p-3 rounded-lg ${iconBgColor}`}>
              <Icon className={`h-7 w-7 ${iconColor}`} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Actions section */}
        {actions && (
          <div className="flex flex-wrap gap-2 lg:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Page Modification Pattern

### Before (Example: Employee List Header)

```tsx
// Old pattern
<div className="p-6 space-y-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <Users className="h-7 w-7 text-emerald-600" />
      <div>
        <h1 className="text-2xl font-bold">พนักงาน</h1>
        <p className="text-gray-500">Employee Directory</p>
      </div>
    </div>
    <div className="flex gap-3">
      <DxButton text="เพิ่มพนักงาน" icon="add" type="success" />
    </div>
  </div>
  {/* ... rest of page */}
</div>
```

### After (Using Shared Component)

```tsx
// New pattern with ResponsivePageHeader
import { ResponsivePageHeader } from '@/components/shared';
import { Users } from 'lucide-react';

<div className="p-6 space-y-6">
  <ResponsivePageHeader
    title="พนักงาน"
    subtitle="Employee Directory"
    icon={Users}
    iconBgColor="bg-emerald-100"
    iconColor="text-emerald-600"
    breadcrumbs={[
      { label: 'HR', href: '/hr' },
      { label: 'พนักงาน' }
    ]}
    actions={
      <>
        <DxButton text="เพิ่มพนักงาน" icon="add" type="success" />
        <DxButton text="นำเข้า" icon="import" stylingMode="outlined" />
      </>
    }
  />
  {/* ... rest of page */}
</div>
```

---

## DevExtreme DataGrid Responsive Pattern

### Add Column Hiding

```tsx
// Add hidingPriority to columns
<Column
  dataField="email"
  caption="อีเมล"
  hidingPriority={1}  // Hidden first on narrow screens
/>
<Column
  dataField="phone"
  caption="โทรศัพท์"
  hidingPriority={2}  // Hidden second
/>
<Column
  dataField="employeeCode"
  caption="รหัส"
  hidingPriority={6}  // Never auto-hidden
/>

// Enable column hiding on grid
<DataGrid
  columnHidingEnabled={true}
  height="calc(100vh - 280px)"
>
  {/* columns */}
</DataGrid>
```

---

## Testing Checklist

For each page modification:

- [ ] Desktop (1920px) - All columns visible, horizontal layout
- [ ] Tablet (768px) - Some columns hidden, layout adapts
- [ ] Mobile (375px) - Stacked layout, only essential columns
- [ ] Touch interactions work (buttons, selection)
- [ ] Loading states display correctly
- [ ] Empty states display correctly
- [ ] Form validation still works
- [ ] Navigation works on all sizes

---

## Files Modified Tracking

Use this checklist to track implementation progress:

```
[ ] src/components/shared/stat-card.tsx (NEW)
[ ] src/components/shared/responsive-page-header.tsx (NEW)
[ ] src/components/shared/responsive-form-layout.tsx (NEW)
[ ] src/components/shared/mobile-list-view.tsx (NEW)
[ ] src/components/shared/index.ts (MODIFY)
[ ] src/app/hr/page.tsx (MODIFY)
[ ] src/app/hr/employees/page.tsx (MODIFY)
[ ] src/app/hr/employees/new/page.tsx (MODIFY)
[ ] src/app/hr/employees/[id]/page.tsx (MODIFY)
[ ] src/app/hr/training/page.tsx (MODIFY)
[ ] src/app/hr/training/courses/page.tsx (MODIFY)
[ ] src/app/hr/training/sessions/page.tsx (MODIFY)
[ ] src/app/hr/training/matrix/page.tsx (MODIFY)
[ ] src/app/hr/positions/page.tsx (MODIFY)
[ ] src/app/hr/org/page.tsx (MODIFY)
[ ] src/app/hr/org-chart/page.tsx (MODIFY)
[ ] src/app/hr/authorizations/page.tsx (MODIFY)
[ ] src/app/hr/health-records/page.tsx (MODIFY)
[ ] src/app/hr/roles/page.tsx (MODIFY)
[ ] src/app/hr/notifications/page.tsx (MODIFY)
[ ] src/app/hr/audit/page.tsx (MODIFY)
```

---

## Responsive UI Next Steps

After completing the shared components:

1. Run `/speckit.tasks` to generate detailed implementation tasks
2. Execute tasks in priority order using `/speckit.implement`
3. Test each page on multiple viewport sizes
4. Commit changes in logical groups (shared components, then pages by priority)
