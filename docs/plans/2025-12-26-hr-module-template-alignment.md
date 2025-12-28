# HR Module Template Pattern Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align HR module pages with template module patterns for consistent layout, navigation flow, error handling, and Item Navigator workflow.

**Architecture:** Update HR pages to use the template module's shared form component pattern (create/edit mode), consistent page header, proper error handling with DevExtreme notify(), and standardized navigation flow between list → new → edit pages.

**Tech Stack:** Next.js 14+, DevExtreme React 25.x, TanStack Query, React hooks, TypeScript

---

## Gap Analysis Summary

### Template Module Patterns (Reference)
1. **Layout**: MainLayout wrapper + two-column form (main 2/3 + sidebar 1/3)
2. **Item Navigator**: Uses router-based navigation (useRouter, router.push) - no separate ItemNavigator component
3. **Error Handling**: DevExtreme `notify()` for toast notifications, try-catch in mutations
4. **Navigation Flow**: List page → `/items` | New page → `/items/new` | Edit page → `/items/[id]`
5. **Shared Form Component**: Single form handles create AND edit modes via `mode` prop
6. **Query Invalidation**: Cascade invalidate related queries on mutations
7. **Audit Log & Attachments**: Integrated in edit mode sidebar

### HR Module Current State (Gaps Identified)

| Page | Current Pattern | Gap |
|------|----------------|-----|
| `/hr/employees` | DataGrid list with multiple views | Uses view modes but no standard item navigator pattern |
| `/hr/employees/new` | Separate new page | Good - matches template |
| `/hr/employees/[id]` | Detail view | Missing proper navigation back, action buttons inconsistent |
| `/hr/employees/[id]/edit` | Separate edit page | Should merge with detail using mode prop |
| `/hr/positions` | Popup-based CRUD | Should use page-based navigation like template |
| `/hr/training/courses` | Popup-based CRUD | Should use page-based navigation like template |
| `/hr/training/sessions` | Popup-based CRUD | Should use page-based navigation like template |
| `/hr/roles` | Custom implementation | Should standardize with template patterns |
| `/hr/authorizations` | Custom implementation | Should standardize with template patterns |

---

## Tasks

### Task 1: Create HR Shared Page Header Component

**Files:**
- Create: `src/components/hr/hr-page-header.tsx`
- Reference: `src/components/template/template-page-header.tsx`

**Step 1: Write the failing test**

Create test file `tests/components/hr/hr-page-header.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HrPageHeader } from '@/components/hr/hr-page-header';
import { Users } from 'lucide-react';

describe('HrPageHeader', () => {
  it('renders title and subtitle', () => {
    render(
      <HrPageHeader
        title="Employees"
        subtitle="Manage employee records"
        icon={Users}
      />
    );
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Manage employee records')).toBeInTheDocument();
  });

  it('renders action buttons when provided', () => {
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        actions={<button>Add Employee</button>}
      />
    );
    expect(screen.getByText('Add Employee')).toBeInTheDocument();
  });

  it('shows refresh button and calls onRefresh', async () => {
    const onRefresh = vi.fn();
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        onRefresh={onRefresh}
      />
    );
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    await refreshBtn.click();
    expect(onRefresh).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/components/hr/hr-page-header.test.tsx`
Expected: FAIL with "Cannot find module '@/components/hr/hr-page-header'"

**Step 3: Write minimal implementation**

Create `src/components/hr/hr-page-header.tsx`:

```typescript
'use client';

import React from 'react';
import { LucideIcon, RefreshCw } from 'lucide-react';
import { Button } from 'devextreme-react/button';

export interface HrPageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function HrPageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'from-blue-500 to-indigo-600',
  onRefresh,
  isRefreshing,
  actions,
  children,
  className = '',
}: HrPageHeaderProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`hidden sm:flex w-12 h-12 rounded-xl bg-gradient-to-br ${iconClassName} items-center justify-center text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              icon="refresh"
              hint="Refresh"
              stylingMode="text"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="refresh"
            />
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/components/hr/hr-page-header.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/hr/hr-page-header.tsx tests/components/hr/hr-page-header.test.tsx
git commit -m "$(cat <<'EOF'
feat(hr): add HrPageHeader component following template pattern

Adds reusable page header component with:
- Title, subtitle, icon display
- Refresh button with loading state
- Actions slot for custom buttons

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create HR Item Navigator Utility

**Files:**
- Create: `src/lib/hr/navigation.ts`
- Test: `tests/lib/hr/navigation.test.ts`

**Step 1: Write the failing test**

Create test file `tests/lib/hr/navigation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getHrListPath, getHrDetailPath, getHrNewPath, getHrEditPath } from '@/lib/hr/navigation';

describe('HR Navigation Utilities', () => {
  describe('getHrListPath', () => {
    it('returns employees list path', () => {
      expect(getHrListPath('employees')).toBe('/hr/employees');
    });

    it('returns positions list path', () => {
      expect(getHrListPath('positions')).toBe('/hr/positions');
    });

    it('returns training courses list path', () => {
      expect(getHrListPath('training-courses')).toBe('/hr/training/courses');
    });
  });

  describe('getHrDetailPath', () => {
    it('returns employee detail path', () => {
      expect(getHrDetailPath('employees', 1)).toBe('/hr/employees/1');
    });
  });

  describe('getHrNewPath', () => {
    it('returns employee new path', () => {
      expect(getHrNewPath('employees')).toBe('/hr/employees/new');
    });
  });

  describe('getHrEditPath', () => {
    it('returns employee edit path', () => {
      expect(getHrEditPath('employees', 1)).toBe('/hr/employees/1/edit');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/lib/hr/navigation.test.ts`
Expected: FAIL with "Cannot find module '@/lib/hr/navigation'"

**Step 3: Write minimal implementation**

Create `src/lib/hr/navigation.ts`:

```typescript
// HR Module Navigation Utilities
// Provides consistent navigation paths across HR module

export type HrEntity =
  | 'employees'
  | 'positions'
  | 'roles'
  | 'authorizations'
  | 'training-courses'
  | 'training-sessions'
  | 'health-records';

const ENTITY_PATH_MAP: Record<HrEntity, string> = {
  'employees': '/hr/employees',
  'positions': '/hr/positions',
  'roles': '/hr/roles',
  'authorizations': '/hr/authorizations',
  'training-courses': '/hr/training/courses',
  'training-sessions': '/hr/training/sessions',
  'health-records': '/hr/health-records',
};

export function getHrListPath(entity: HrEntity): string {
  return ENTITY_PATH_MAP[entity];
}

export function getHrDetailPath(entity: HrEntity, id: number | string): string {
  return `${ENTITY_PATH_MAP[entity]}/${id}`;
}

export function getHrNewPath(entity: HrEntity): string {
  return `${ENTITY_PATH_MAP[entity]}/new`;
}

export function getHrEditPath(entity: HrEntity, id: number | string): string {
  return `${ENTITY_PATH_MAP[entity]}/${id}/edit`;
}

// Navigation handler for common use cases
export function createHrNavigator(router: { push: (path: string) => void }, entity: HrEntity) {
  return {
    toList: () => router.push(getHrListPath(entity)),
    toDetail: (id: number | string) => router.push(getHrDetailPath(entity, id)),
    toNew: () => router.push(getHrNewPath(entity)),
    toEdit: (id: number | string) => router.push(getHrEditPath(entity, id)),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/lib/hr/navigation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/hr/navigation.ts tests/lib/hr/navigation.test.ts
git commit -m "$(cat <<'EOF'
feat(hr): add navigation utilities for consistent HR module paths

Adds utility functions for HR module navigation:
- getHrListPath, getHrDetailPath, getHrNewPath, getHrEditPath
- createHrNavigator factory for router integration
- Type-safe entity definitions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Refactor EmployeeForm for Create/Edit Mode Pattern

**Files:**
- Modify: `src/components/hr/EmployeeForm.tsx`
- Test: `tests/components/hr/EmployeeForm.test.tsx`

**Step 1: Write the failing test**

Update/create test file `tests/components/hr/EmployeeForm.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmployeeForm } from '@/components/hr/EmployeeForm';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('EmployeeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('create mode', () => {
    it('renders create form with empty fields', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { code: 'EMP001' } }),
      });

      render(<EmployeeForm mode="create" />, { wrapper: Wrapper });

      expect(screen.getByText(/เพิ่มพนักงานใหม่/)).toBeInTheDocument();
    });

    it('shows back button that navigates to list', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { code: 'EMP001' } }),
      });

      render(<EmployeeForm mode="create" />, { wrapper: Wrapper });

      expect(screen.getByRole('button', { name: /ยกเลิก/i })).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    const mockEmployee = {
      id: 1,
      employeeCode: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      hireDate: '2024-01-01',
    };

    it('renders edit form with employee data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockEmployee }),
      });

      render(<EmployeeForm mode="edit" employeeId="1" />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText(/แก้ไขข้อมูลพนักงาน/)).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching', () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));

      render(<EmployeeForm mode="edit" employeeId="1" />, { wrapper: Wrapper });

      expect(screen.getByText(/กำลังโหลด/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify current state**

Run: `npm test tests/components/hr/EmployeeForm.test.tsx`
Expected: May pass or fail depending on current implementation

**Step 3: Ensure EmployeeForm handles both modes properly**

The current EmployeeForm already supports `mode: 'create' | 'edit'` prop. Verify the following patterns match template:

1. Loading state in edit mode shows spinner
2. Back button navigates correctly based on mode
3. Success redirects to detail page (edit) or list (create)
4. Error handling uses toast notifications

Review the current implementation at `src/components/hr/EmployeeForm.tsx` - it already follows the template pattern well.

**Step 4: Run test to verify it passes**

Run: `npm test tests/components/hr/EmployeeForm.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/components/hr/EmployeeForm.test.tsx
git commit -m "$(cat <<'EOF'
test(hr): add EmployeeForm tests for create/edit mode patterns

Adds comprehensive tests verifying:
- Create mode renders empty form
- Edit mode loads and displays employee data
- Loading states work correctly
- Navigation buttons function properly

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Refactor Positions Page - List View with Page Navigation

**Files:**
- Modify: `src/app/hr/positions/page.tsx`
- Create: `src/app/hr/positions/new/page.tsx`
- Create: `src/app/hr/positions/[id]/page.tsx`
- Create: `src/components/hr/PositionForm.tsx`
- Test: `tests/app/hr/positions/page.test.tsx`

**Step 1: Write the failing test for new structure**

Create test file `tests/app/hr/positions/page.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PositionsPage from '@/app/hr/positions/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

global.fetch = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('PositionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders page header with title', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<PositionsPage />, { wrapper: Wrapper });

    expect(screen.getByText(/ตำแหน่งงาน/)).toBeInTheDocument();
  });

  it('renders add new button that navigates to /positions/new', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<PositionsPage />, { wrapper: Wrapper });

    expect(screen.getByText(/เพิ่มตำแหน่ง/)).toBeInTheDocument();
  });

  it('clicking row navigates to position detail', async () => {
    const mockPositions = [
      { id: 1, code: 'POS001', title: 'Manager', isActive: true },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockPositions }),
    });

    render(<PositionsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Manager')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify baseline**

Run: `npm test tests/app/hr/positions/page.test.tsx`
Expected: May pass with current implementation

**Step 3: Create PositionForm component**

Create `src/components/hr/PositionForm.tsx`:

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Form, SimpleItem, GroupItem, RequiredRule } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgUnitPicker } from '@/components/shared';
import { ChevronLeft, Save, Briefcase, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import type { Position } from '@/types/hr';

interface PositionFormData {
  code: string;
  title: string;
  titleEn: string;
  orgUnitId: number | null;
  jobGrade: string;
  isGmpCritical: boolean;
  isActive: boolean;
}

export interface PositionFormProps {
  mode: 'create' | 'edit';
  positionId?: number;
  onSuccess?: (position: Position) => void;
  onCancel?: () => void;
}

async function fetchPosition(id: number): Promise<Position> {
  const res = await fetch(`/api/hr/positions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch position');
  const result = await res.json();
  return result.data;
}

async function createPosition(data: Partial<Position>): Promise<Position> {
  const res = await fetch('/api/hr/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create position');
  }
  return (await res.json()).data;
}

async function updatePosition(id: number, data: Partial<Position>): Promise<Position> {
  const res = await fetch(`/api/hr/positions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update position');
  }
  return (await res.json()).data;
}

export function PositionForm({
  mode,
  positionId,
  onSuccess,
  onCancel,
}: PositionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'positions');

  const [formData, setFormData] = useState<PositionFormData>({
    code: '',
    title: '',
    titleEn: '',
    orgUnitId: null,
    jobGrade: '',
    isGmpCritical: false,
    isActive: true,
  });

  // Fetch existing position in edit mode
  const { data: existingPosition, isLoading: isLoadingPosition } = useQuery({
    queryKey: ['hr', 'position', positionId],
    queryFn: () => fetchPosition(positionId!),
    enabled: mode === 'edit' && !!positionId,
  });

  // Populate form when position loads
  useEffect(() => {
    if (existingPosition) {
      setFormData({
        code: existingPosition.code || '',
        title: existingPosition.title || '',
        titleEn: existingPosition.titleEn || '',
        orgUnitId: existingPosition.orgUnitId || null,
        jobGrade: existingPosition.jobGrade || '',
        isGmpCritical: existingPosition.isGmpCritical || false,
        isActive: existingPosition.isActive ?? true,
      });
    }
  }, [existingPosition]);

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      notify('สร้างตำแหน่งสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toDetail(position.id);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Position>) => updatePosition(positionId!, data),
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'position', positionId] });
      notify('อัปเดตตำแหน่งสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toDetail(position.id);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleBack = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate.toList();
    }
  }, [onCancel, navigate]);

  const handleSubmit = useCallback(() => {
    if (!formData.code?.trim()) {
      notify('กรุณาระบุรหัสตำแหน่ง', 'warning', 3000);
      return;
    }
    if (!formData.title?.trim()) {
      notify('กรุณาระบุชื่อตำแหน่ง', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code,
      title: formData.title,
      titleEn: formData.titleEn || undefined,
      orgUnitId: formData.orgUnitId || undefined,
      jobGrade: formData.jobGrade || undefined,
      isGmpCritical: formData.isGmpCritical,
      isActive: formData.isActive,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  }, [formData, mode, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  // Loading state for edit mode
  if (mode === 'edit' && isLoadingPosition) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <LoadIndicator height={24} width={24} />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-blue-100' : 'bg-indigo-100'}`}>
              {isCreate ? (
                <Briefcase className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'เพิ่มตำแหน่งใหม่' : 'แก้ไขตำแหน่ง'}
              </h1>
              {!isCreate && existingPosition && (
                <p className="text-sm text-gray-500">รหัส: {existingPosition.code}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            text="ยกเลิก"
            stylingMode="outlined"
            onClick={handleBack}
          />
          <Button
            text={isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            type="default"
            icon="save"
            disabled={isPending}
            onClick={handleSubmit}
          />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลตำแหน่ง</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                setFormData(prev => ({ ...prev, [e.dataField!]: e.value }));
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
          >
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="code"
                label={{ text: 'รหัสตำแหน่ง' }}
                editorOptions={{
                  placeholder: 'เช่น QC-001',
                  readOnly: mode === 'edit',
                }}
              >
                <RequiredRule message="กรุณาระบุรหัสตำแหน่ง" />
              </SimpleItem>

              <SimpleItem
                dataField="jobGrade"
                label={{ text: 'ระดับตำแหน่ง' }}
                editorOptions={{
                  placeholder: 'เช่น Manager, Supervisor',
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="title"
              label={{ text: 'ชื่อตำแหน่ง (ไทย)' }}
              editorOptions={{
                placeholder: 'ชื่อตำแหน่งภาษาไทย',
              }}
            >
              <RequiredRule message="กรุณาระบุชื่อตำแหน่ง" />
            </SimpleItem>

            <SimpleItem
              dataField="titleEn"
              label={{ text: 'ชื่อตำแหน่ง (อังกฤษ)' }}
              editorOptions={{
                placeholder: 'Position title in English',
              }}
            />

            <SimpleItem
              dataField="orgUnitId"
              label={{ text: 'หน่วยงาน' }}
              render={() => (
                <OrgUnitPicker
                  value={formData.orgUnitId}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, orgUnitId: val }))}
                  placeholder="เลือกหน่วยงาน"
                  showClearButton
                />
              )}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="isGmpCritical"
                label={{ text: 'ตำแหน่ง GMP Critical' }}
                editorType="dxCheckBox"
              />

              <SimpleItem
                dataField="isActive"
                label={{ text: 'ใช้งาน' }}
                editorType="dxCheckBox"
              />
            </GroupItem>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Create new position page**

Create `src/app/hr/positions/new/page.tsx`:

```typescript
'use client';

import { PositionForm } from '@/components/hr/PositionForm';

export default function NewPositionPage() {
  return (
    <div className="p-6">
      <PositionForm mode="create" />
    </div>
  );
}
```

**Step 5: Create position detail page**

Create `src/app/hr/positions/[id]/page.tsx`:

```typescript
'use client';

import { use } from 'react';
import { PositionForm } from '@/components/hr/PositionForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function PositionDetailPage({ params }: Props) {
  const { id } = use(params);
  const positionId = Number(id);

  return (
    <div className="p-6">
      <PositionForm mode="edit" positionId={positionId} />
    </div>
  );
}
```

**Step 6: Update positions list page to use page navigation**

Modify `src/app/hr/positions/page.tsx` to change row click behavior:

```typescript
// Change handleRowClick to navigate to detail page
const handleRowClick = useCallback((e: { data: Position }) => {
  router.push(`/hr/positions/${e.data.id}`);
}, [router]);

// Change "เพิ่มตำแหน่ง" button to navigate to new page
<DxButton
  text="เพิ่มตำแหน่ง"
  icon="add"
  type="default"
  onClick={() => router.push('/hr/positions/new')}
/>
```

**Step 7: Run tests**

Run: `npm test tests/app/hr/positions/`
Expected: PASS

**Step 8: Commit**

```bash
git add src/components/hr/PositionForm.tsx src/app/hr/positions/new/page.tsx src/app/hr/positions/[id]/page.tsx src/app/hr/positions/page.tsx tests/app/hr/positions/
git commit -m "$(cat <<'EOF'
feat(hr): refactor positions to use page-based navigation pattern

- Add PositionForm component with create/edit mode support
- Create /positions/new page for creating positions
- Create /positions/[id] page for editing positions
- Update list page to navigate to detail on row click
- Follow template module patterns for consistency

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Refactor Training Courses Page - Same Pattern

**Files:**
- Modify: `src/app/hr/training/courses/page.tsx`
- Create: `src/app/hr/training/courses/new/page.tsx`
- Create: `src/app/hr/training/courses/[id]/page.tsx`
- Create: `src/components/hr/TrainingCourseForm.tsx`

**Step 1: Create TrainingCourseForm component**

Create `src/components/hr/TrainingCourseForm.tsx` following the same pattern as PositionForm:

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Form, SimpleItem, GroupItem, RequiredRule } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, BookOpen, Edit3 } from 'lucide-react';
import type { TrainingCourse } from '@/types/hr';

interface CourseFormData {
  code: string;
  name: string;
  nameEn: string;
  category: string;
  description: string;
  validityDays: number | undefined;
  durationHours: number | undefined;
  isMandatory: boolean;
  isActive: boolean;
}

export interface TrainingCourseFormProps {
  mode: 'create' | 'edit';
  courseId?: number;
  onSuccess?: (course: TrainingCourse) => void;
  onCancel?: () => void;
}

async function fetchCourse(id: number): Promise<TrainingCourse> {
  const res = await fetch(`/api/hr/training/courses/${id}`);
  if (!res.ok) throw new Error('Failed to fetch course');
  const result = await res.json();
  return result.data;
}

async function createCourse(data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const res = await fetch('/api/hr/training/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create course');
  }
  return (await res.json()).data;
}

async function updateCourse(id: number, data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const res = await fetch(`/api/hr/training/courses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update course');
  }
  return (await res.json()).data;
}

export function TrainingCourseForm({
  mode,
  courseId,
  onSuccess,
  onCancel,
}: TrainingCourseFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CourseFormData>({
    code: '',
    name: '',
    nameEn: '',
    category: '',
    description: '',
    validityDays: undefined,
    durationHours: undefined,
    isMandatory: false,
    isActive: true,
  });

  const { data: existingCourse, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['hr', 'training', 'course', courseId],
    queryFn: () => fetchCourse(courseId!),
    enabled: mode === 'edit' && !!courseId,
  });

  useEffect(() => {
    if (existingCourse) {
      setFormData({
        code: existingCourse.code || '',
        name: existingCourse.name || '',
        nameEn: existingCourse.nameEn || '',
        category: existingCourse.category || '',
        description: existingCourse.description || '',
        validityDays: existingCourse.validityDays || undefined,
        durationHours: existingCourse.durationHours || undefined,
        isMandatory: existingCourse.isMandatory || false,
        isActive: existingCourse.isActive ?? true,
      });
    }
  }, [existingCourse]);

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      notify('สร้างหลักสูตรสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(course);
      } else {
        router.push(`/hr/training/courses/${course.id}`);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TrainingCourse>) => updateCourse(courseId!, data),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'course', courseId] });
      notify('อัปเดตหลักสูตรสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(course);
      } else {
        router.push(`/hr/training/courses/${course.id}`);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleBack = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/hr/training/courses');
    }
  }, [onCancel, router]);

  const handleSubmit = useCallback(() => {
    if (!formData.code?.trim()) {
      notify('กรุณาระบุรหัสหลักสูตร', 'warning', 3000);
      return;
    }
    if (!formData.name?.trim()) {
      notify('กรุณาระบุชื่อหลักสูตร', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code,
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      category: formData.category || undefined,
      description: formData.description || undefined,
      validityDays: formData.validityDays,
      durationHours: formData.durationHours,
      isMandatory: formData.isMandatory,
      isActive: formData.isActive,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  }, [formData, mode, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  if (mode === 'edit' && isLoadingCourse) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <LoadIndicator height={24} width={24} />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-blue-100' : 'bg-indigo-100'}`}>
              {isCreate ? (
                <BookOpen className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'เพิ่มหลักสูตรใหม่' : 'แก้ไขหลักสูตร'}
              </h1>
              {!isCreate && existingCourse && (
                <p className="text-sm text-gray-500">รหัส: {existingCourse.code}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            text="ยกเลิก"
            stylingMode="outlined"
            onClick={handleBack}
          />
          <Button
            text={isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            type="default"
            icon="save"
            disabled={isPending}
            onClick={handleSubmit}
          />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลหลักสูตร</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                setFormData(prev => ({ ...prev, [e.dataField!]: e.value }));
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
          >
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="code"
                label={{ text: 'รหัสหลักสูตร' }}
                editorOptions={{
                  placeholder: 'เช่น GMP-001',
                  readOnly: mode === 'edit',
                }}
              >
                <RequiredRule message="กรุณาระบุรหัสหลักสูตร" />
              </SimpleItem>

              <SimpleItem
                dataField="category"
                label={{ text: 'หมวดหมู่' }}
                editorOptions={{
                  placeholder: 'เช่น GMP, Safety',
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="name"
              label={{ text: 'ชื่อหลักสูตร (ไทย)' }}
              editorOptions={{
                placeholder: 'ชื่อหลักสูตรภาษาไทย',
              }}
            >
              <RequiredRule message="กรุณาระบุชื่อหลักสูตร" />
            </SimpleItem>

            <SimpleItem
              dataField="nameEn"
              label={{ text: 'ชื่อหลักสูตร (อังกฤษ)' }}
              editorOptions={{
                placeholder: 'Course name in English',
              }}
            />

            <SimpleItem
              dataField="description"
              label={{ text: 'รายละเอียด' }}
              editorType="dxTextArea"
              editorOptions={{
                placeholder: 'ระบุรายละเอียดหลักสูตร...',
                height: 100,
              }}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="validityDays"
                label={{ text: 'อายุการรับรอง (วัน)' }}
                editorType="dxNumberBox"
                editorOptions={{
                  min: 0,
                  showSpinButtons: true,
                  placeholder: 'เช่น 365',
                }}
                helpText="ว่างเปล่า = ไม่มีหมดอายุ"
              />

              <SimpleItem
                dataField="durationHours"
                label={{ text: 'ระยะเวลาอบรม (ชั่วโมง)' }}
                editorType="dxNumberBox"
                editorOptions={{
                  min: 0,
                  showSpinButtons: true,
                  placeholder: 'เช่น 8',
                }}
              />
            </GroupItem>

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="isMandatory"
                label={{ text: 'หลักสูตรบังคับ' }}
                editorType="dxCheckBox"
              />

              <SimpleItem
                dataField="isActive"
                label={{ text: 'ใช้งาน' }}
                editorType="dxCheckBox"
              />
            </GroupItem>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create new course page**

Create `src/app/hr/training/courses/new/page.tsx`:

```typescript
'use client';

import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

export default function NewCoursePage() {
  return (
    <div className="p-6">
      <TrainingCourseForm mode="create" />
    </div>
  );
}
```

**Step 3: Create course detail page**

Create `src/app/hr/training/courses/[id]/page.tsx`:

```typescript
'use client';

import { use } from 'react';
import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: Props) {
  const { id } = use(params);
  const courseId = Number(id);

  return (
    <div className="p-6">
      <TrainingCourseForm mode="edit" courseId={courseId} />
    </div>
  );
}
```

**Step 4: Update courses list page**

Modify `src/app/hr/training/courses/page.tsx` to use page navigation instead of popups.

**Step 5: Commit**

```bash
git add src/components/hr/TrainingCourseForm.tsx src/app/hr/training/courses/new/page.tsx src/app/hr/training/courses/[id]/page.tsx src/app/hr/training/courses/page.tsx
git commit -m "$(cat <<'EOF'
feat(hr): refactor training courses to use page-based navigation

- Add TrainingCourseForm component with create/edit mode
- Create /training/courses/new page
- Create /training/courses/[id] page
- Update list page to navigate on row click

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add Error Handling with DevExtreme notify()

**Files:**
- Modify: All HR form components to use consistent error handling

**Step 1: Create shared error handler utility**

Create `src/lib/hr/error-handler.ts`:

```typescript
import notify from 'devextreme/ui/notify';

export interface ApiError {
  error?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export function handleApiError(error: unknown, defaultMessage: string = 'เกิดข้อผิดพลาด'): void {
  if (error instanceof Error) {
    notify(error.message, 'error', 5000);
  } else if (typeof error === 'string') {
    notify(error, 'error', 5000);
  } else {
    notify(defaultMessage, 'error', 5000);
  }
}

export function handleValidationErrors(errors: Array<{ field: string; message: string }>): void {
  const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join('\n');
  notify(`ข้อมูลไม่ถูกต้อง:\n${errorMessages}`, 'error', 5000);
}

export function showSuccess(message: string): void {
  notify(message, 'success', 3000);
}

export function showWarning(message: string): void {
  notify(message, 'warning', 3000);
}

export function showInfo(message: string): void {
  notify(message, 'info', 3000);
}
```

**Step 2: Update form components to use error handler**

Update imports in PositionForm, TrainingCourseForm, EmployeeForm to use the shared handler:

```typescript
import { handleApiError, showSuccess, showWarning } from '@/lib/hr/error-handler';

// In mutation onError:
onError: (error: Error) => {
  handleApiError(error);
},

// In mutation onSuccess:
onSuccess: () => {
  showSuccess('สร้างสำเร็จ');
},

// In validation:
if (!formData.code) {
  showWarning('กรุณาระบุรหัส');
  return;
}
```

**Step 3: Commit**

```bash
git add src/lib/hr/error-handler.ts src/components/hr/
git commit -m "$(cat <<'EOF'
feat(hr): add shared error handling utilities

Adds centralized error handling:
- handleApiError for API response errors
- handleValidationErrors for form validation
- showSuccess, showWarning, showInfo helpers
- Consistent DevExtreme notify() usage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Run Full Test Suite and Verify

**Files:**
- Test all modified files

**Step 1: Run all HR module tests**

Run: `npm test tests/app/hr/ tests/components/hr/ tests/lib/hr/`
Expected: All tests PASS

**Step 2: Run lint check**

Run: `npm run lint`
Expected: No errors

**Step 3: Manual verification checklist**

- [ ] Navigate to /hr/positions - list loads
- [ ] Click "เพิ่มตำแหน่ง" - goes to /hr/positions/new
- [ ] Create position - redirects to detail page
- [ ] Click row in list - goes to /hr/positions/[id]
- [ ] Edit position - saves and stays on detail
- [ ] Navigate to /hr/training/courses - list loads
- [ ] Click "เพิ่มหลักสูตร" - goes to /hr/training/courses/new
- [ ] Create course - redirects to detail page
- [ ] Error notifications show correctly
- [ ] Back buttons work correctly

**Step 4: Commit final state**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(hr): complete template pattern alignment for HR module

All HR pages now follow the template module patterns:
- Consistent page headers with HrPageHeader component
- Page-based navigation (list → new → detail)
- Shared form components with create/edit mode
- DevExtreme notify() for error/success messages
- Proper query invalidation on mutations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan aligns the HR module with template module patterns by:

1. **Task 1**: Create HrPageHeader component matching TemplatePageHeader
2. **Task 2**: Create navigation utilities for consistent paths
3. **Task 3**: Verify EmployeeForm follows create/edit mode pattern
4. **Task 4**: Refactor Positions from popup to page-based navigation
5. **Task 5**: Refactor Training Courses from popup to page-based navigation
6. **Task 6**: Add shared error handling with DevExtreme notify()
7. **Task 7**: Run tests and verify all changes

Each task follows TDD (write test → run fail → implement → run pass → commit).
