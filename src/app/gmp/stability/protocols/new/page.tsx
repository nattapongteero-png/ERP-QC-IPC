'use client';

/**
 * Create Stability Protocol Page (T711)
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Form to create new stability protocol with timepoint editor.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import type { DxDataGridColumn } from '@/components/ui/dx-data-grid';
import type { StabilityProtocolCreate, StabilityStudyType } from '@/types/stability';

// ============================================
// API Functions
// ============================================

interface ItemResponse {
  id: number;
  nameTh: string;
  nameEn: string;
  code: string;
}

async function fetchProducts(): Promise<Array<{ id: number; name: string; code: string }>> {
  const response = await fetch('/api/items?type=finished_product&limit=200');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.map((item: ItemResponse) => ({
    id: item.id,
    name: item.nameTh || item.nameEn,
    code: item.code,
  }));
}

interface SpecResponse {
  id: number;
  testType: string;
}

async function fetchQualitySpecs(productId: number): Promise<Array<{ id: number; testName: string }>> {
  const response = await fetch(`/api/quality/specs?itemId=${productId}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.map((spec: SpecResponse) => ({
    id: spec.id,
    testName: spec.testType || 'Unknown Test',
  }));
}

async function createProtocol(data: StabilityProtocolCreate): Promise<void> {
  const response = await fetch('/api/stability/protocols', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Component
// ============================================

interface TimepointRow {
  id: number;
  month: number;
  tests: number[];
}

const studyTypes: Array<{ value: StabilityStudyType; label: string }> = [
  { value: 'long_term', label: 'Long Term' },
  { value: 'accelerated', label: 'Accelerated' },
  { value: 'intermediate', label: 'Intermediate' },
];

const commonConditions = [
  '25°C/60%RH',
  '30°C/65%RH',
  '30°C/75%RH',
  '40°C/75%RH',
  '5°C',
  '-20°C',
];

export default function NewProtocolPage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [studyType, setStudyType] = useState<StabilityStudyType>('long_term');
  const [storageCondition, setStorageCondition] = useState('25°C/60%RH');
  const [timepoints, setTimepoints] = useState<TimepointRow[]>([
    { id: 1, month: 0, tests: [] },
    { id: 2, month: 3, tests: [] },
    { id: 3, month: 6, tests: [] },
  ]);
  const [nextTimepointId, setNextTimepointId] = useState(4);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // Fetch quality specs for selected product
  const { data: availableTests, isLoading: testsLoading } = useQuery({
    queryKey: ['quality-specs', productId],
    queryFn: () => fetchQualitySpecs(productId!),
    enabled: !!productId,
  });

  // Create protocol mutation
  const createMutation = useMutation({
    mutationFn: createProtocol,
    onSuccess: () => {
      router.push('/gmp/stability/protocols');
    },
  });

  // Timepoint management
  const addTimepoint = () => {
    setTimepoints([
      ...timepoints,
      { id: nextTimepointId, month: 0, tests: [] },
    ]);
    setNextTimepointId(nextTimepointId + 1);
  };

  const removeTimepoint = (id: number) => {
    setTimepoints(timepoints.filter((tp) => tp.id !== id));
  };

  const updateTimepointMonth = (id: number, month: number) => {
    setTimepoints(
      timepoints.map((tp) => (tp.id === id ? { ...tp, month } : tp))
    );
  };

  const updateTimepointTests = (id: number, tests: number[]) => {
    setTimepoints(
      timepoints.map((tp) => (tp.id === id ? { ...tp, tests } : tp))
    );
  };

  // Validation
  const canSubmit = () => {
    if (!name || !productId || !storageCondition) return false;
    if (timepoints.length === 0) return false;
    if (timepoints.some((tp) => tp.month < 0)) return false;
    return true;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!canSubmit()) return;

    // Collect all unique test IDs
    const allTestIds = new Set<number>();
    timepoints.forEach((tp) => {
      tp.tests.forEach((testId) => allTestIds.add(testId));
    });

    const data: StabilityProtocolCreate = {
      name,
      productId: productId!,
      studyType,
      storageCondition,
      timepoints: timepoints.map((tp) => tp.month).sort((a, b) => a - b),
      testsRequired: Array.from(allTestIds),
    };

    createMutation.mutate(data);
  };

  // Timepoint grid columns - use DxDataGridColumn type with custom cellRender
  const timepointColumns: DxDataGridColumn[] = [
    {
      dataField: 'month',
      caption: 'Timepoint (Months)',
      width: 180,
      cellRender: (cellData) => {
        const row = cellData.data as TimepointRow;
        return (
          <DxNumberBox
            value={cellData.value ?? 0}
            onValueChanged={(e) => updateTimepointMonth(row.id, e.value)}
            min={0}
            max={120}
            showSpinButtons={true}
            width={150}
          />
        );
      },
    },
    {
      dataField: 'tests',
      caption: 'Tests Required',
      cellRender: (cellData) => {
        const row = cellData.data as TimepointRow;
        const selectedTests = (cellData.value ?? []) as number[];
        return (
          <DxSelectBox
            dataSource={availableTests || []}
            valueExpr="id"
            displayExpr="testName"
            value={selectedTests}
            onValueChanged={(e) => updateTimepointTests(row.id, e.value || [])}
            placeholder="Select tests..."
            disabled={testsLoading || !availableTests}
            searchEnabled={true}
            showClearButton={true}
            width="100%"
          />
        );
      },
    },
    {
      type: 'buttons',
      width: 80,
      buttons: [
        {
          hint: 'Remove',
          icon: 'trash',
          onClick: (e: { row?: { data?: unknown } }) => {
            const rowData = e.row?.data as TimepointRow | undefined;
            if (rowData) removeTimepoint(rowData.id);
          },
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Create Stability Protocol"
        subtitle="Define a new standardized protocol for stability testing"
        onBack={() => router.push('/gmp/stability/protocols')}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="Cancel"
              onClick={() => router.push('/gmp/stability/protocols')}
              stylingMode="outlined"
            />
            <DxButton
              text="Save Protocol"
              icon="save"
              onClick={handleSubmit}
              type="default"
              disabled={!canSubmit() || createMutation.isPending}
            />
          </div>
        }
      />

      {/* Form */}
      <div className="bg-card border rounded-lg shadow-sm p-6 space-y-6">
        {/* Basic Info Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Protocol Name *</label>
              <DxTextBox
                value={name}
                onValueChanged={(e) => setName(e.value)}
                placeholder="e.g., Herbal Tablet Long-term Stability"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Product *</label>
              <DxSelectBox
                dataSource={products || []}
                valueExpr="id"
                displayExpr="name"
                value={productId}
                onValueChanged={(e) => setProductId(e.value)}
                placeholder="Select product..."
                searchEnabled={true}
                showClearButton={true}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Study Type *</label>
              <DxSelectBox
                dataSource={studyTypes}
                valueExpr="value"
                displayExpr="label"
                value={studyType}
                onValueChanged={(e) => setStudyType(e.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Storage Condition *</label>
              <DxSelectBox
                dataSource={commonConditions}
                value={storageCondition}
                onValueChanged={(e) => setStorageCondition(e.value)}
                searchEnabled={true}
                placeholder="Select condition..."
                showClearButton={false}
              />
            </div>
          </div>
        </div>

        {/* Timepoints Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Sampling Timepoints</h3>
            <DxButton
              text="Add Timepoint"
              icon="add"
              onClick={addTimepoint}
              type="default"
              disabled={!productId}
            />
          </div>

          {!productId && (
            <div className="bg-muted rounded-lg p-4 text-center text-muted-foreground">
              Select a product first to configure timepoints and tests
            </div>
          )}

          {productId && (
            <div className="border rounded-lg">
              <DxDataGrid
                dataSource={timepoints}
                columns={timepointColumns}
                keyExpr="id"
                showBorders={false}
                showRowLines={true}
                showColumnLines={false}
                columnAutoWidth={false}
                height={400}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-2">
            Define sampling timepoints in months from study start (e.g., 0, 1, 3, 6, 12, 18, 24).
            Select which tests to perform at each timepoint.
          </p>
        </div>

        {/* Validation Messages */}
        {!canSubmit() && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please complete all required fields and add at least one timepoint.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
