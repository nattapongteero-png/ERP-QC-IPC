'use client';

/**
 * Stability Protocols List Page (T710)
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * List all stability protocols with status.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import type { DxDataGridColumn } from '@/components/ui/dx-data-grid';
import type { StabilityProtocol, StabilityProtocolStatus } from '@/types/stability';
import { FileText, Package, Thermometer, Calendar } from 'lucide-react';

// ============================================
// API Functions
// ============================================

async function fetchProtocols(status?: StabilityProtocolStatus): Promise<StabilityProtocol[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const response = await fetch(`/api/stability/protocols?${params.toString()}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'obsolete', label: 'Obsolete' },
];

export default function StabilityProtocolsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StabilityProtocolStatus | ''>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['stability-protocols', statusFilter],
    queryFn: () => fetchProtocols(statusFilter || undefined),
  });

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load protocols</p>
        </div>
      </div>
    );
  }

  // Columns use DevExtreme cellRender with optional value/data
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'protocolNumber',
      caption: 'Protocol Number',
      width: 150,
      cellRender: (cellData) => {
        const row = cellData.data as StabilityProtocol;
        return (
          <button
            onClick={() => router.push(`/gmp/stability/protocols/${row.id}`)}
            className="text-primary hover:underline font-medium"
          >
            {cellData.value}
          </button>
        );
      },
    },
    {
      dataField: 'name',
      caption: 'Protocol Name',
      cellRender: (cellData) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{String(cellData.value ?? '')}</span>
        </div>
      ),
    },
    {
      dataField: 'productName',
      caption: 'Product',
      width: 200,
      cellRender: (cellData) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span>{String(cellData.value ?? 'N/A')}</span>
        </div>
      ),
    },
    {
      dataField: 'storageCondition',
      caption: 'Storage Condition',
      width: 150,
      cellRender: (cellData) => (
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          <span>{String(cellData.value ?? '')}</span>
        </div>
      ),
    },
    {
      dataField: 'studyType',
      caption: 'Study Type',
      width: 120,
      cellRender: (cellData) => (
        <span className="text-sm">
          {String(cellData.value ?? '').replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      dataField: 'timepoints',
      caption: 'Duration (months)',
      width: 150,
      cellRender: (cellData) => {
        const timepoints = (cellData.value ?? []) as number[];
        const maxTimepoint = timepoints && timepoints.length > 0
          ? Math.max(...timepoints)
          : 0;
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{maxTimepoint} months ({timepoints?.length || 0} points)</span>
          </div>
        );
      },
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 120,
      cellRender: (cellData) => <WorkflowStatusBadge status={String(cellData.value ?? '')} />,
    },
    {
      dataField: 'approvedByName',
      caption: 'Approved By',
      width: 150,
      cellRender: (cellData) => (
        <span className="text-sm text-muted-foreground">
          {String(cellData.value ?? '-')}
        </span>
      ),
    },
    {
      dataField: 'createdAt',
      caption: 'Created',
      width: 110,
      dataType: 'date',
      format: 'yyyy-MM-dd',
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Stability Protocols"
        subtitle="Standardized protocols for stability testing programs"
        onBack={() => router.push('/gmp/stability')}
        actions={
          <DxButton
            text="New Protocol"
            icon="add"
            onClick={() => router.push('/gmp/stability/protocols/new')}
            type="default"
          />
        }
      />

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
      </div>

      {/* Protocols Grid */}
      <div className="bg-card border rounded-lg shadow-sm">
        <DxDataGrid
          dataSource={data || []}
          columns={columns}
          keyExpr="id"
          showBorders={false}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          columnAutoWidth={false}
          wordWrapEnabled={false}
          height="calc(100vh - 300px)"
        />
      </div>

      {/* Empty State */}
      {!isLoading && (!data || data.length === 0) && (
        <div className="text-center py-12 bg-card border rounded-lg">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No protocols found</h3>
          <p className="text-muted-foreground mb-4">
            {statusFilter
              ? `No protocols with status "${statusFilter}"`
              : 'Create your first stability protocol to get started'}
          </p>
          <DxButton
            text="Create Protocol"
            icon="add"
            onClick={() => router.push('/gmp/stability/protocols/new')}
            type="default"
          />
        </div>
      )}
    </div>
  );
}
