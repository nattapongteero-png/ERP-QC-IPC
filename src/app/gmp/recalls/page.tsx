'use client';

/**
 * Recalls List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Main page for viewing and managing product recalls.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RecallList } from '@/components/recalls';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import {
  AlertTriangle,
  Package,
  CheckCircle,
  Activity,
} from 'lucide-react';
import type { RecallListResponse, RecallStatus, RecallClass, MockDrillResult } from '@/types/recalls';

// ============================================
// API Functions
// ============================================

async function fetchRecalls(
  status?: RecallStatus,
  recallClass?: RecallClass
): Promise<RecallListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (recallClass) params.set('recallClass', recallClass);

  const response = await fetch(`/api/recalls?${params.toString()}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function executeMockDrill(lotId: number): Promise<MockDrillResult> {
  const response = await fetch('/api/recalls/mock-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lotId }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

const classOptions = [
  { value: '', label: 'All Classes' },
  { value: 'class_i', label: 'Class I' },
  { value: 'class_ii', label: 'Class II' },
  { value: 'class_iii', label: 'Class III' },
];

export default function RecallsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<RecallStatus | ''>('');
  const [classFilter, setClassFilter] = useState<RecallClass | ''>('');
  const [showMockDrill, setShowMockDrill] = useState(false);
  const [mockDrillLotId, setMockDrillLotId] = useState<number>(0);
  const [mockDrillResult, setMockDrillResult] = useState<MockDrillResult | null>(null);
  const [mockDrillLoading, setMockDrillLoading] = useState(false);

  // Fetch recalls
  const { data, isLoading, error } = useQuery({
    queryKey: ['recalls', statusFilter, classFilter],
    queryFn: () =>
      fetchRecalls(statusFilter || undefined, classFilter || undefined),
  });

  // Calculate stats
  const recalls = data?.recalls || [];
  const stats = {
    active: recalls.filter((r) => r.status !== 'closed').length,
    classI: recalls.filter((r) => r.recallClass === 'class_i' && r.status !== 'closed').length,
    inProgress: recalls.filter((r) => r.status === 'in_progress').length,
    completed: recalls.filter((r) => r.status === 'completed').length,
  };

  const handleMockDrill = async () => {
    if (!mockDrillLotId) return;
    setMockDrillLoading(true);
    try {
      const result = await executeMockDrill(mockDrillLotId);
      setMockDrillResult(result);
    } catch (error) {
      console.error('Mock drill failed:', error);
    } finally {
      setMockDrillLoading(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load recalls</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Product Recalls"
        subtitle="Thai FDA GMP หมวด 9 - Recall Management"
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="Mock Drill"
              icon="like"
              onClick={() => setShowMockDrill(true)}
              stylingMode="outlined"
            />
            <DxButton
              text="Initiate Recall"
              icon="add"
              onClick={() => router.push('/gmp/recalls/new')}
              type="danger"
            />
          </div>
        }
      />

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active Recalls</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Package className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.classI}</p>
              <p className="text-sm text-muted-foreground">Class I (Critical)</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Awaiting Closure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <DxSelectBox
            dataSource={statusOptions}
            valueExpr="value"
            displayExpr="label"
            value={statusFilter}
            onValueChanged={(e) => setStatusFilter(e.value)}
            placeholder="Filter by status..."
          />
        </div>
        <div className="w-48">
          <DxSelectBox
            dataSource={classOptions}
            valueExpr="value"
            displayExpr="label"
            value={classFilter}
            onValueChanged={(e) => setClassFilter(e.value)}
            placeholder="Filter by class..."
          />
        </div>
      </div>

      {/* Recalls List */}
      <RecallList recalls={recalls} loading={isLoading} />

      {/* Mock Drill Dialog */}
      <DxPopup
        visible={showMockDrill}
        onHiding={() => {
          setShowMockDrill(false);
          setMockDrillResult(null);
          setMockDrillLotId(0);
        }}
        title="Mock Recall Drill"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {!mockDrillResult ? (
            <>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  A mock drill tests your ability to trace product distribution within the
                  FDA-required 4-hour window. Enter a lot ID to test traceability.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lot ID to Trace</label>
                <DxNumberBox
                  value={mockDrillLotId}
                  onValueChanged={(e) => setMockDrillLotId(e.value || 0)}
                  min={1}
                  placeholder="Enter lot ID..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <DxButton
                  text="Cancel"
                  onClick={() => setShowMockDrill(false)}
                  stylingMode="outlined"
                />
                <DxButton
                  text="Run Mock Drill"
                  icon="like"
                  onClick={handleMockDrill}
                  type="default"
                  disabled={!mockDrillLotId || mockDrillLoading}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={`p-4 rounded-lg ${
                  mockDrillResult.passedTarget
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {mockDrillResult.passedTarget ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {mockDrillResult.passedTarget ? 'PASSED' : 'FAILED'}
                    </h3>
                    <p className="text-sm">
                      Traceability completed in {mockDrillResult.timeToIdentify.toFixed(2)} seconds
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{mockDrillResult.customersIdentified}</div>
                  <div className="text-xs text-muted-foreground">Customers Identified</div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{mockDrillResult.totalDistributed}</div>
                  <div className="text-xs text-muted-foreground">Units Distributed</div>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <strong>Lot:</strong> {mockDrillResult.lotNumber}
                </div>
                <div className="text-sm">
                  <strong>Drill ID:</strong> {mockDrillResult.drillId}
                </div>
                <div className="text-sm">
                  <strong>Executed:</strong> {new Date(mockDrillResult.executedAt).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t">
                <DxButton
                  text="Close"
                  onClick={() => {
                    setShowMockDrill(false);
                    setMockDrillResult(null);
                    setMockDrillLotId(0);
                  }}
                  stylingMode="outlined"
                />
              </div>
            </>
          )}
        </div>
      </DxPopup>
    </div>
  );
}
