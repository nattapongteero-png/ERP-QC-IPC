# Accounting Pages Template Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align `/accounting/fixed-assets` and `/accounting/equipment` pages with the Template module design pattern, adding full CRUD flow with page-based navigation.

**Architecture:** Update list pages to use Template pattern layout (full-width, Card-wrapped DataGrid, action columns). Create form components and page routes for create/edit. Add delete functionality with inline confirmation.

**Tech Stack:** Next.js 14+ App Router, DevExtreme React DataGrid, TanStack Query, Card/CardContent from ui/card, ResponsivePageHeader/StatCard from shared components

---

## Gap Analysis

### Current Issues (Both Pages):
1. Container uses `min-h-screen bg-gray-50` or `flex flex-col gap-6` instead of `space-y-6 p-1`
2. Uses `AccountingPageHeader` instead of `ResponsivePageHeader`
3. Uses `AccountingKPICard` instead of `StatCard`
4. DataGrid not wrapped in `Card/CardContent` with `p-0`
5. No action column (View/Edit/Delete buttons)
6. No page-based navigation (`/new`, `/[id]` routes)
7. No form components for create/edit
8. Add buttons show "coming soon" notification
9. Missing delete functionality in API

### Template Pattern Requirements:
- Container: `space-y-6 p-1`
- Header: `ResponsivePageHeader` with breadcrumbs
- Stats: `StatCard` component
- DataGrid: wrapped in `Card/CardContent` with `p-0`, `showBorders={false}`, `className="min-h-[400px]"`
- Action column with View/Edit/Delete icons
- Delete confirmation: inline `Card` with red background
- Page routes: `/new` for create, `/[id]` for edit
- Form component reused for create and edit modes

---

## Task 1: Create FixedAssetForm Component

**Files:**
- Create: `src/components/accounting/FixedAssetForm.tsx`

**Step 1: Write the form component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Building, ArrowLeft, Save, Trash2 } from 'lucide-react';
import type { FixedAsset, AssetCategory } from '@/lib/db/schema';

interface FixedAssetFormProps {
  mode: 'create' | 'edit';
  assetId?: number;
}

async function fetchAsset(id: number): Promise<FixedAsset> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`);
  if (!res.ok) throw new Error('Failed to fetch asset');
  const data = await res.json();
  return data.data;
}

async function fetchCategories(): Promise<AssetCategory[]> {
  const res = await fetch('/api/accounting/asset-categories');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function createAsset(data: Partial<FixedAsset>): Promise<{ id: number }> {
  const res = await fetch('/api/accounting/fixed-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create asset');
  }
  return res.json();
}

async function updateAsset(id: number, data: Partial<FixedAsset>): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update asset');
  }
}

async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete asset');
  }
}

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'sum_of_years', label: 'Sum of Years Digits' },
  { value: 'units_of_production', label: 'Units of Production' },
];

export function FixedAssetForm({ mode, assetId }: FixedAssetFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    nameTh: '',
    nameEn: '',
    categoryId: null as number | null,
    acquisitionDate: '',
    acquisitionCost: 0,
    salvageValue: 0,
    usefulLifeMonths: 60,
    depreciationMethod: 'straight_line',
    depreciationStartDate: '',
    location: '',
    departmentId: null as number | null,
    responsiblePersonId: null as number | null,
  });

  const { data: existingAsset, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['fixed-asset', assetId],
    queryFn: () => fetchAsset(assetId!),
    enabled: mode === 'edit' && !!assetId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    if (existingAsset) {
      setFormData({
        nameTh: existingAsset.nameTh || '',
        nameEn: existingAsset.nameEn || '',
        categoryId: existingAsset.categoryId,
        acquisitionDate: existingAsset.acquisitionDate || '',
        acquisitionCost: Number(existingAsset.acquisitionCost) || 0,
        salvageValue: Number(existingAsset.salvageValue) || 0,
        usefulLifeMonths: existingAsset.usefulLifeMonths || 60,
        depreciationMethod: existingAsset.depreciationMethod || 'straight_line',
        depreciationStartDate: existingAsset.depreciationStartDate || '',
        location: existingAsset.location || '',
        departmentId: existingAsset.departmentId || null,
        responsiblePersonId: existingAsset.responsiblePersonId || null,
      });
    }
  }, [existingAsset]);

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      notify('Fixed asset created successfully', 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FixedAsset>) => updateAsset(assetId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset', assetId] });
      notify('Fixed asset updated successfully', 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(assetId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      notify('Fixed asset deleted successfully', 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.nameTh || !formData.nameEn || !formData.categoryId) {
      notify('Please fill in required fields', 'error', 3000);
      return;
    }

    if (mode === 'create') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (mode === 'edit' && isLoadingAsset) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading asset...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? 'เพิ่มทรัพย์สินถาวร' : 'แก้ไขทรัพย์สินถาวร'}
        subtitle={mode === 'create' ? 'Create New Fixed Asset' : `Edit: ${existingAsset?.assetCode || ''}`}
        icon={Building}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting' },
          { label: 'Fixed Assets', href: '/accounting/fixed-assets' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              text="Back"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/fixed-assets')}
            />
            <Button
              text={isSubmitting ? 'Saving...' : 'Save'}
              icon="save"
              type="success"
              onClick={handleSubmit}
              disabled={isSubmitting}
            />
          </div>
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && mode === 'edit' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this asset? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  icon="trash"
                  type="danger"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (Thai) <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameTh}
                    onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value || '' })}
                    placeholder="ชื่อทรัพย์สิน"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (English) <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameEn}
                    onValueChanged={(e) => setFormData({ ...formData, nameEn: e.value || '' })}
                    placeholder="Asset Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={categories}
                    displayExpr="nameEn"
                    valueExpr="id"
                    value={formData.categoryId}
                    onValueChanged={(e) => setFormData({ ...formData, categoryId: e.value })}
                    placeholder="Select Category"
                    searchEnabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <TextBox
                    value={formData.location}
                    onValueChanged={(e) => setFormData({ ...formData, location: e.value || '' })}
                    placeholder="Location"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acquisition & Depreciation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acquisition Date <span className="text-red-500">*</span>
                  </label>
                  <DxDateBox
                    value={formData.acquisitionDate}
                    onValueChange={(value) => setFormData({ ...formData, acquisitionDate: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acquisition Cost <span className="text-red-500">*</span>
                  </label>
                  <NumberBox
                    value={formData.acquisitionCost}
                    onValueChanged={(e) => setFormData({ ...formData, acquisitionCost: e.value || 0 })}
                    format="#,##0.00"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salvage Value
                  </label>
                  <NumberBox
                    value={formData.salvageValue}
                    onValueChanged={(e) => setFormData({ ...formData, salvageValue: e.value || 0 })}
                    format="#,##0.00"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Useful Life (Months)
                  </label>
                  <NumberBox
                    value={formData.usefulLifeMonths}
                    onValueChanged={(e) => setFormData({ ...formData, usefulLifeMonths: e.value || 60 })}
                    min={1}
                    max={600}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Depreciation Method
                  </label>
                  <SelectBox
                    dataSource={depreciationMethods}
                    displayExpr="label"
                    valueExpr="value"
                    value={formData.depreciationMethod}
                    onValueChanged={(e) => setFormData({ ...formData, depreciationMethod: e.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Depreciation Start Date
                  </label>
                  <DxDateBox
                    value={formData.depreciationStartDate}
                    onValueChange={(value) => setFormData({ ...formData, depreciationStartDate: value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {mode === 'edit' && existingAsset && (
            <Card>
              <CardHeader>
                <CardTitle>Asset Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Asset Code</span>
                  <p className="font-medium">{existingAsset.assetCode}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <p className="font-medium capitalize">{existingAsset.status}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Net Book Value</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.netBookValue) || 0
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Accumulated Depreciation</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.accumulatedDepreciation) || 0
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'edit' && (
            <Card className="border-red-100">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Deleting this asset will remove all associated records.
                </p>
                <Button
                  text="Delete Asset"
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(true)}
                  width="100%"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify file was created**

Run: `ls -la src/components/accounting/FixedAssetForm.tsx`
Expected: File exists

---

## Task 2: Create Fixed Assets Page Routes

**Files:**
- Create: `src/app/accounting/fixed-assets/new/page.tsx`
- Create: `src/app/accounting/fixed-assets/[id]/page.tsx`

**Step 1: Create new page**

```tsx
// src/app/accounting/fixed-assets/new/page.tsx
'use client';

import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

export default function NewFixedAssetPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <FixedAssetForm mode="create" />
    </div>
  );
}
```

**Step 2: Create edit page**

```tsx
// src/app/accounting/fixed-assets/[id]/page.tsx
'use client';

import { use } from 'react';
import { FixedAssetForm } from '@/components/accounting/FixedAssetForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditFixedAssetPage({ params }: Props) {
  const { id } = use(params);
  const assetId = Number(id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <FixedAssetForm mode="edit" assetId={assetId} />
    </div>
  );
}
```

**Step 3: Verify files were created**

Run: `ls -la src/app/accounting/fixed-assets/new/ src/app/accounting/fixed-assets/\[id\]/`
Expected: Both directories with page.tsx files

---

## Task 3: Add DELETE API Endpoint for Fixed Assets

**Files:**
- Modify: `src/app/api/accounting/fixed-assets/[id]/route.ts`
- Modify: `src/lib/services/accounting-assets.service.ts`

**Step 1: Add deleteFixedAsset function to service**

Add after `updateFixedAsset` function in `src/lib/services/accounting-assets.service.ts`:

```typescript
export async function deleteFixedAsset(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getAccountingTables();

    // Check if asset exists
    const asset = await db.select().from(tables.fixedAssets).where(eq(tables.fixedAssets.id, id)).limit(1);
    if (asset.length === 0) {
      throw new Error('Fixed asset not found');
    }

    // Check if asset has disposal records
    const disposals = await db.select().from(tables.assetDisposals).where(eq(tables.assetDisposals.fixedAssetId, id)).limit(1);
    if (disposals.length > 0) {
      throw new Error('Cannot delete asset with disposal records');
    }

    // Delete related records first
    await db.delete(tables.assetMovements).where(eq(tables.assetMovements.fixedAssetId, id));
    await db.delete(tables.depreciationRecords).where(eq(tables.depreciationRecords.fixedAssetId, id));

    // Delete the asset
    await db.delete(tables.fixedAssets).where(eq(tables.fixedAssets.id, id));
  });
}
```

**Step 2: Add DELETE handler to API route**

Add to `src/app/api/accounting/fixed-assets/[id]/route.ts`:

```typescript
import { getFixedAssetById, updateFixedAsset, deleteFixedAsset } from '@/lib/services/accounting-assets.service';

// ... existing code ...

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const assetId = parseInt(id, 10);

    if (isNaN(assetId)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

    await deleteFixedAsset(assetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting fixed asset:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete fixed asset' },
      { status: 500 }
    );
  }
}
```

---

## Task 4: Update Fixed Assets List Page to Template Pattern

**Files:**
- Modify: `src/app/accounting/fixed-assets/page.tsx`

**Step 1: Update imports and container**

Replace the page with Template-aligned version:

```tsx
'use client';

// Fixed Assets List Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Sorting,
  LoadPanel,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Building, Eye, Edit, Trash2 } from 'lucide-react';
import type { FixedAsset, AssetCategory } from '@/lib/db/schema';

// ... fetch functions (keep existing) ...

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}

async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete asset');
  }
}

const statusOptions = [
  { value: '', text: 'All Statuses' },
  { value: 'active', text: 'Active' },
  { value: 'disposed', text: 'Disposed' },
  { value: 'fully_depreciated', text: 'Fully Depreciated' },
];

export default function FixedAssetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ... queries (keep existing) ...

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
      notify('Asset deleted successfully', 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedAsset(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleRowClick = (e: { data: FixedAsset }) => {
    router.push(`/accounting/fixed-assets/${e.data.id}`);
  };

  const handleDelete = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowDeleteConfirm(true);
  };

  const renderActionsCell = (cellData: { data: FixedAsset }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/fixed-assets/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/fixed-assets/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <ResponsivePageHeader
        title="ทรัพย์สินถาวร"
        subtitle="Fixed Assets Management"
        icon={Building}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting' },
          { label: 'Fixed Assets' },
        ]}
        actions={
          <Button
            text="Add Asset"
            icon="plus"
            type="success"
            onClick={() => router.push('/accounting/fixed-assets/new')}
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedAsset && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete &quot;{selectedAsset.nameTh}&quot;?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedAsset(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  icon="trash"
                  type="danger"
                  onClick={() => deleteMutation.mutate(selectedAsset.id)}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Assets"
          value={summary?.totalAssets || 0}
          icon={Building}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Active"
          value={summary?.activeAssets || 0}
          icon={Building}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="Total Cost"
          value={summary ? formatCurrency(summary.totalAcquisitionCost) : '-'}
          icon={Building}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
        <StatCard
          label="Net Book Value"
          value={summary ? formatCurrency(summary.totalNetBookValue) : '-'}
          icon={Building}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <SelectBox
                items={statusOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                valueExpr="value"
                displayExpr="text"
                width={200}
              />
            </div>
            {statusFilter && (
              <Button
                text="Clear"
                stylingMode="text"
                onClick={() => setStatusFilter('')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={assets}
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            onRowClick={handleRowClick}
            className="min-h-[400px]"
          >
            <LoadPanel enabled={isLoading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="assetCode" caption="Asset Code" width={150} />
            <Column dataField="nameTh" caption="Name (TH)" minWidth={200} />
            <Column dataField="nameEn" caption="Name (EN)" minWidth={180} />
            <Column dataField="acquisitionDate" caption="Acquisition Date" dataType="date" width={130} />
            <Column
              dataField="acquisitionCost"
              caption="Cost"
              dataType="number"
              format="#,##0.00"
              width={130}
              alignment="right"
            />
            <Column
              dataField="netBookValue"
              caption="Net Value"
              dataType="number"
              format="#,##0.00"
              width={130}
              alignment="right"
            />
            <Column dataField="status" caption="Status" width={100} />
            <Column
              caption="Actions"
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Task 5: Create EquipmentForm Component

**Files:**
- Create: `src/components/accounting/EquipmentForm.tsx`

**Step 1: Write the form component**

(Similar structure to FixedAssetForm, with equipment-specific fields)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import { Switch } from 'devextreme-react/switch';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Wrench } from 'lucide-react';
import type { AccountingEquipment, FixedAsset } from '@/lib/db/schema';

interface EquipmentFormProps {
  mode: 'create' | 'edit';
  equipmentId?: number;
}

// ... fetch functions similar to FixedAssetForm ...

export function EquipmentForm({ mode, equipmentId }: EquipmentFormProps) {
  // Similar implementation to FixedAssetForm with equipment-specific fields:
  // - fixedAssetId (required, linked to fixed asset)
  // - serialNumber
  // - manufacturer
  // - model
  // - specifications
  // - warrantyStartDate
  // - warrantyEndDate
  // - isAvailable
  // ...
}
```

---

## Task 6: Create Equipment Page Routes

**Files:**
- Create: `src/app/accounting/equipment/new/page.tsx`
- Create: `src/app/accounting/equipment/[id]/page.tsx`

(Same pattern as Task 2)

---

## Task 7: Add DELETE API Endpoint for Equipment

**Files:**
- Modify: `src/app/api/accounting/equipment/[id]/route.ts`
- Modify: `src/lib/services/accounting-equipment.service.ts`

(Same pattern as Task 3)

---

## Task 8: Update Equipment List Page to Template Pattern

**Files:**
- Modify: `src/app/accounting/equipment/page.tsx`

(Same pattern as Task 4, with equipment-specific columns)

---

## Task 9: Export Form Components

**Files:**
- Modify: `src/components/accounting/index.ts`

**Step 1: Add exports**

```typescript
export { FixedAssetForm } from './FixedAssetForm';
export { EquipmentForm } from './EquipmentForm';
```

---

## Task 10: Run Tests and Verify

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run ESLint**

Run: `npm run lint -- --quiet src/app/accounting/fixed-assets src/app/accounting/equipment src/components/accounting`
Expected: No errors

**Step 3: Commit changes**

```bash
git add src/app/accounting/fixed-assets src/app/accounting/equipment src/components/accounting
git commit -m "feat(accounting): align fixed-assets and equipment pages with Template pattern

- Add FixedAssetForm and EquipmentForm components
- Create /new and /[id] page routes for CRUD
- Add action columns with View/Edit/Delete buttons
- Update list pages to use full-width Template layout
- Add DELETE API endpoints for both modules
- Use Card/CardContent, ResponsivePageHeader, StatCard

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
