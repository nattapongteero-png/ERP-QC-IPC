# HR Training Sessions New Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `/hr/training/sessions/new` page to create training sessions using a dedicated page instead of the inline popup.

**Architecture:** Extract the inline session creation form from `sessions/page.tsx` into a reusable `TrainingSessionForm` component following the `TrainingCourseForm` pattern. Create a simple wrapper page that uses this component. Support both create and edit modes for future `/hr/training/sessions/[id]` page.

**Tech Stack:** Next.js 16.0.10 (App Router), React 19, DevExtreme React 25.2.3, TanStack Query 5.x, Zod 4.x validation

---

## Task 1: Create TrainingSessionForm Component

**Files:**
- Create: `src/components/hr/TrainingSessionForm.tsx`
- Reference: `src/components/hr/TrainingCourseForm.tsx` (pattern to follow)
- Reference: `src/lib/validation/hr.ts:269-286` (validation schema)
- Reference: `src/types/hr.ts:461-486` (types)

**Step 1: Write the failing test**

Create test file `tests/components/hr/TrainingSessionForm.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrainingSessionForm } from '@/components/hr/TrainingSessionForm';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('TrainingSessionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock courses fetch
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/training/courses')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 1, code: 'GMP-001', name: 'GMP Basics' },
              { id: 2, code: 'SAFETY-001', name: 'Safety Training' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });
  });

  it('renders create mode with required fields', async () => {
    render(<TrainingSessionForm mode="create" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('จัดอบรมใหม่')).toBeInTheDocument();
    });

    // Required fields
    expect(screen.getByTestId('session-course-field')).toBeInTheDocument();
    expect(screen.getByTestId('session-date-field')).toBeInTheDocument();

    // Optional fields
    expect(screen.getByTestId('session-start-time-field')).toBeInTheDocument();
    expect(screen.getByTestId('session-end-time-field')).toBeInTheDocument();
    expect(screen.getByTestId('session-location-field')).toBeInTheDocument();
  });

  it('has disabled submit button when required fields empty', async () => {
    render(<TrainingSessionForm mode="create" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('จัดอบรมใหม่')).toBeInTheDocument();
    });

    const submitBtn = screen.getByTestId('session-submit-btn');
    expect(submitBtn).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/hr/TrainingSessionForm.test.tsx`
Expected: FAIL with "Cannot find module '@/components/hr/TrainingSessionForm'"

**Step 3: Write the TrainingSessionForm component**

Create `src/components/hr/TrainingSessionForm.tsx`:

```tsx
'use client';

// TrainingSessionForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management
// Follows TrainingCourseForm pattern for consistent form handling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import SelectBox from 'devextreme-react/select-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, CalendarDays, Edit3 } from 'lucide-react';
import { handleApiError, showSuccess, showWarning } from '@/lib/hr/error-handler';
import type { TrainingSession, TrainingCourse, Employee } from '@/types/hr';

interface SessionFormData {
  courseId: number | undefined;
  sessionDate: string;
  startTime: string;
  endTime: string;
  location: string;
  instructorId: number | undefined;
  instructorExternal: string;
  maxParticipants: number | undefined;
  notes: string;
}

export interface TrainingSessionFormProps {
  mode: 'create' | 'edit';
  sessionId?: number;
  onSuccess?: (session: TrainingSession) => void;
  onCancel?: () => void;
}

const defaultFormData: SessionFormData = {
  courseId: undefined,
  sessionDate: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '16:00',
  location: '',
  instructorId: undefined,
  instructorExternal: '',
  maxParticipants: undefined,
  notes: '',
};

async function fetchSession(id: number): Promise<TrainingSession> {
  const res = await fetch(`/api/hr/training/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch session');
  const result = await res.json();
  return result.data;
}

async function fetchCourses(): Promise<TrainingCourse[]> {
  const res = await fetch('/api/hr/training/courses?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch courses');
  const result = await res.json();
  const data = result.data?.data || result.data || [];
  return Array.isArray(data) ? data : [];
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch('/api/hr/employees?isActive=true&limit=1000');
  if (!res.ok) throw new Error('Failed to fetch employees');
  const result = await res.json();
  const data = result.data?.data || result.data || [];
  return Array.isArray(data) ? data : [];
}

async function createSession(data: Partial<TrainingSession>): Promise<TrainingSession> {
  const res = await fetch('/api/hr/training/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create session');
  }
  return (await res.json()).data;
}

async function updateSession(id: number, data: Partial<TrainingSession>): Promise<TrainingSession> {
  const res = await fetch(`/api/hr/training/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update session');
  }
  return (await res.json()).data;
}

export function TrainingSessionForm({
  mode,
  sessionId,
  onSuccess,
  onCancel,
}: TrainingSessionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<SessionFormData>(defaultFormData);

  // Fetch courses for dropdown
  const { data: courses = [] } = useQuery({
    queryKey: ['hr', 'training', 'courses', 'active'],
    queryFn: fetchCourses,
  });

  // Fetch employees for instructor dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

  // Fetch existing session in edit mode
  const { data: existingSession, isLoading: isLoadingSession } = useQuery({
    queryKey: ['hr', 'training', 'session', sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: mode === 'edit' && !!sessionId,
  });

  // Populate form when session loads
  useEffect(() => {
    if (existingSession) {
      setFormData({
        courseId: existingSession.courseId || undefined,
        sessionDate: existingSession.sessionDate || defaultFormData.sessionDate,
        startTime: existingSession.startTime || '',
        endTime: existingSession.endTime || '',
        location: existingSession.location || '',
        instructorId: existingSession.instructorId || undefined,
        instructorExternal: existingSession.instructorExternal || '',
        maxParticipants: existingSession.maxParticipants || undefined,
        notes: existingSession.notes || '',
      });
    }
  }, [existingSession]);

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      showSuccess('สร้างการจัดอบรมสำเร็จ');
      if (onSuccess) {
        onSuccess(session);
      } else {
        router.push('/hr/training/sessions');
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการสร้างการจัดอบรม');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TrainingSession>) => updateSession(sessionId!, data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'session', sessionId] });
      showSuccess('อัปเดตการจัดอบรมสำเร็จ');
      if (onSuccess) {
        onSuccess(session);
      } else {
        router.push('/hr/training/sessions');
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการอัปเดตการจัดอบรม');
    },
  });

  const handleBack = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/hr/training/sessions');
    }
  }, [onCancel, router]);

  const handleSubmit = useCallback(() => {
    // Validate required fields
    if (!formData.courseId) {
      showWarning('กรุณาเลือกหลักสูตร');
      return;
    }
    if (!formData.sessionDate) {
      showWarning('กรุณาระบุวันที่อบรม');
      return;
    }

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (formData.startTime && !timeRegex.test(formData.startTime)) {
      showWarning('เวลาเริ่มต้องอยู่ในรูปแบบ HH:MM');
      return;
    }
    if (formData.endTime && !timeRegex.test(formData.endTime)) {
      showWarning('เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:MM');
      return;
    }

    const submitData = {
      courseId: formData.courseId,
      sessionDate: formData.sessionDate,
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      location: formData.location?.trim() || undefined,
      instructorId: formData.instructorId || undefined,
      instructorExternal: formData.instructorExternal?.trim() || undefined,
      maxParticipants: formData.maxParticipants || undefined,
      notes: formData.notes?.trim() || undefined,
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
  if (mode === 'edit' && isLoadingSession) {
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
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-green-100' : 'bg-indigo-100'}`}>
              {isCreate ? (
                <CalendarDays className="h-6 w-6 text-green-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'จัดอบรมใหม่' : 'แก้ไขการจัดอบรม'}
              </h1>
              {!isCreate && existingSession && (
                <p className="text-sm text-gray-500">รหัส: {existingSession.id}</p>
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
            disabled={isPending || !formData.courseId || !formData.sessionDate}
            onClick={handleSubmit}
            elementAttr={{ 'data-testid': 'session-submit-btn' }}
          />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการจัดอบรม</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            ref={formRef}
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                setFormData(prev => ({ ...prev, [e.dataField!]: e.value }));
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
          >
            {/* Course Selection */}
            <SimpleItem
              dataField="courseId"
              label={{ text: 'หลักสูตร *' }}
            >
              <SelectBox
                dataSource={courses}
                valueExpr="id"
                displayExpr={(item: TrainingCourse | null) => item ? `${item.code} - ${item.name}` : ''}
                value={formData.courseId}
                onValueChanged={(e) => setFormData(prev => ({ ...prev, courseId: e.value }))}
                searchEnabled
                placeholder="เลือกหลักสูตร..."
                elementAttr={{ 'data-testid': 'session-course-field' }}
              />
              <RequiredRule message="กรุณาเลือกหลักสูตร" />
            </SimpleItem>

            <GroupItem colCount={3}>
              <SimpleItem
                dataField="sessionDate"
                label={{ text: 'วันที่อบรม *' }}
                editorType="dxDateBox"
                editorOptions={{
                  type: 'date',
                  displayFormat: 'dd/MM/yyyy',
                  elementAttr: { 'data-testid': 'session-date-field' },
                }}
              >
                <RequiredRule message="กรุณาระบุวันที่อบรม" />
              </SimpleItem>

              <SimpleItem
                dataField="startTime"
                label={{ text: 'เวลาเริ่ม' }}
                editorOptions={{
                  placeholder: 'HH:MM',
                  elementAttr: { 'data-testid': 'session-start-time-field' },
                }}
              />

              <SimpleItem
                dataField="endTime"
                label={{ text: 'เวลาสิ้นสุด' }}
                editorOptions={{
                  placeholder: 'HH:MM',
                  elementAttr: { 'data-testid': 'session-end-time-field' },
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="location"
              label={{ text: 'สถานที่' }}
              editorOptions={{
                placeholder: 'เช่น ห้องประชุม A',
                elementAttr: { 'data-testid': 'session-location-field' },
              }}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="instructorId"
                label={{ text: 'วิทยากร (พนักงาน)' }}
              >
                <SelectBox
                  dataSource={employees}
                  valueExpr="id"
                  displayExpr={(item: Employee | null) => {
                    if (!item) return '';
                    const name = `${item.firstName || ''} ${item.lastName || ''}`.trim();
                    return item.employeeCode ? `${item.employeeCode} - ${name}` : name;
                  }}
                  value={formData.instructorId}
                  onValueChanged={(e) => setFormData(prev => ({ ...prev, instructorId: e.value }))}
                  searchEnabled
                  showClearButton
                  placeholder="เลือกพนักงาน..."
                  elementAttr={{ 'data-testid': 'session-instructor-field' }}
                />
              </SimpleItem>

              <SimpleItem
                dataField="instructorExternal"
                label={{ text: 'วิทยากร (ภายนอก)' }}
                editorOptions={{
                  placeholder: 'ชื่อวิทยากรภายนอก',
                  elementAttr: { 'data-testid': 'session-instructor-external-field' },
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="maxParticipants"
              label={{ text: 'จำนวนผู้เข้าร่วมสูงสุด' }}
              editorType="dxNumberBox"
              editorOptions={{
                min: 1,
                showSpinButtons: true,
                placeholder: 'ไม่จำกัด',
                elementAttr: { 'data-testid': 'session-max-participants-field' },
              }}
            />

            <SimpleItem
              dataField="notes"
              label={{ text: 'หมายเหตุ' }}
              editorType="dxTextArea"
              editorOptions={{
                placeholder: 'รายละเอียดเพิ่มเติม...',
                height: 80,
                elementAttr: { 'data-testid': 'session-notes-field' },
              }}
            />
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/hr/TrainingSessionForm.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/hr/TrainingSessionForm.tsx tests/components/hr/TrainingSessionForm.test.tsx
git commit -m "feat(hr): add TrainingSessionForm component for create/edit sessions"
```

---

## Task 2: Create Sessions New Page

**Files:**
- Create: `src/app/hr/training/sessions/new/page.tsx`
- Reference: `src/app/hr/training/courses/new/page.tsx` (pattern to follow)

**Step 1: Write the failing test**

Create test file `tests/app/hr/training/sessions/new/page.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewSessionPage from '@/app/hr/training/sessions/new/page';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('NewSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/training/courses')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ id: 1, code: 'GMP-001', name: 'GMP Basics' }],
          }),
        });
      }
      if (url.includes('/api/hr/employees')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ id: 1, employeeCode: 'EMP001', firstName: 'John', lastName: 'Doe' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });
  });

  it('renders new session page with form', async () => {
    render(<NewSessionPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('จัดอบรมใหม่')).toBeInTheDocument();
    });
  });

  it('has submit button', async () => {
    render(<NewSessionPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('session-submit-btn')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/app/hr/training/sessions/new/page.test.tsx`
Expected: FAIL with "Cannot find module '@/app/hr/training/sessions/new/page'"

**Step 3: Create the page**

Create `src/app/hr/training/sessions/new/page.tsx`:

```tsx
'use client';

import { TrainingSessionForm } from '@/components/hr/TrainingSessionForm';

export default function NewSessionPage() {
  return (
    <div className="p-4 md:p-6">
      <TrainingSessionForm mode="create" />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/app/hr/training/sessions/new/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/hr/training/sessions/new/page.tsx tests/app/hr/training/sessions/new/page.test.tsx
git commit -m "feat(hr): add /hr/training/sessions/new page"
```

---

## Task 3: Update Sessions List Page to Link to New Page

**Files:**
- Modify: `src/app/hr/training/sessions/page.tsx:226-232`

**Step 1: Update the "Add" button to navigate to the new page**

Change the button from opening popup to navigating:

```tsx
// Before (line 226-232):
<DxButton
  text="จัดอบรมใหม่"
  icon="add"
  type="default"
  stylingMode="contained"
  onClick={() => setShowCreatePopup(true)}
/>

// After:
<DxButton
  text="จัดอบรมใหม่"
  icon="add"
  type="default"
  stylingMode="contained"
  onClick={() => router.push('/hr/training/sessions/new')}
/>
```

**Step 2: Add router import and hook**

At line 6-7, add:
```tsx
import { useRouter } from 'next/navigation';
```

Inside the component (after line 87), add:
```tsx
const router = useRouter();
```

**Step 3: Optionally remove the popup code (or keep for backward compatibility)**

You can keep the popup as a fallback or remove lines 339-427 (the Popup component).

**Step 4: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/hr/training/sessions/page.tsx
git commit -m "refactor(hr): update sessions page to navigate to /new instead of popup"
```

---

## Task 4: Add Export to Components Index (Optional)

**Files:**
- Modify: `src/components/hr/index.ts` (if exists)

**Step 1: Check if index file exists**

Run: `ls src/components/hr/index.ts`

**Step 2: If exists, add export**

```tsx
export { TrainingSessionForm } from './TrainingSessionForm';
export type { TrainingSessionFormProps } from './TrainingSessionForm';
```

**Step 3: Commit**

```bash
git add src/components/hr/index.ts
git commit -m "chore(hr): export TrainingSessionForm from components index"
```

---

## Task 5: Run Full Test Suite

**Step 1: Run all HR training tests**

Run: `pnpm test tests/components/hr/ tests/app/hr/training/`

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`

**Step 3: Run lint**

Run: `pnpm lint`

**Step 4: Fix any issues found**

**Step 5: Final commit if needed**

```bash
git add .
git commit -m "test(hr): verify training session form tests pass"
```

---

## Task 6: Manual Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Navigate to the new page**

Open: `http://localhost:33021/hr/training/sessions/new`

**Step 3: Verify form renders**

- [ ] Page loads without errors
- [ ] Course dropdown shows courses
- [ ] Date picker works
- [ ] Time fields accept HH:MM format
- [ ] Location field works
- [ ] Instructor dropdown shows employees
- [ ] External instructor field works
- [ ] Max participants number input works
- [ ] Notes textarea works

**Step 4: Test form submission**

- [ ] Select a course
- [ ] Pick a date
- [ ] Fill optional fields
- [ ] Click "บันทึก" (Save)
- [ ] Verify redirect to sessions list
- [ ] Verify new session appears in list

**Step 5: Test navigation**

- [ ] Click "ยกเลิก" (Cancel) returns to sessions list
- [ ] Back button (chevron) returns to sessions list

---

## Summary

| Task | Files | Estimated Time |
|------|-------|----------------|
| Task 1 | TrainingSessionForm.tsx + test | 3-5 min |
| Task 2 | sessions/new/page.tsx + test | 2-3 min |
| Task 3 | Update sessions/page.tsx | 2 min |
| Task 4 | Export (optional) | 1 min |
| Task 5 | Test suite | 2-3 min |
| Task 6 | Manual verification | 3-5 min |
| **Total** | | **13-19 min** |
