/**
 * Purchase Requisitions List Page (T046)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  Toolbar,
  Item,
  SearchPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import type { PurchaseRequisition, PRStatus, PRPriority } from '@/types/purchase-requisition';

const statusLabels: Record<PRStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  converted: { label: 'Converted to PO', color: 'bg-purple-100 text-purple-800' },
};

const priorityLabels: Record<PRPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  normal: { label: 'Normal', color: 'text-blue-600' },
  high: { label: 'High', color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600 font-bold' },
};

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/purchasing/requisitions');
      const result = await response.json();
      if (result.success) {
        setRequisitions(result.data);
        setTotal(result.total);
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  const renderStatusCell = (cellInfo: any) => {
    const status = cellInfo.data.status as PRStatus;
    const config = statusLabels[status] || statusLabels.draft;
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const renderPriorityCell = (cellInfo: any) => {
    const priority = cellInfo.data.priority as PRPriority;
    const config = priorityLabels[priority] || priorityLabels.normal;
    return <span className={config.color}>{config.label}</span>;
  };

  const renderAmountCell = (cellInfo: any) => {
    const amount = cellInfo.data.totalEstimatedAmount || 0;
    return (
      <span className="font-mono">
        {amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </span>
    );
  };

  const renderActionsCell = (cellInfo: any) => {
    const pr = cellInfo.data;
    return (
      <div className="flex gap-1">
        <Button
          icon="edit"
          hint="View/Edit"
          stylingMode="text"
          onClick={() => router.push(`/purchasing/requisitions/${pr.id}`)}
          data-testid={`edit-btn-${pr.id}`}
        />
        {pr.status === 'approved' && (
          <Button
            icon="export"
            hint="Convert to PO"
            stylingMode="text"
            onClick={() => router.push(`/purchasing/requisitions/${pr.id}?action=convert`)}
            data-testid={`convert-btn-${pr.id}`}
          />
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            Purchase Requisitions
          </h1>
          <p className="text-gray-600">
            Create and manage purchase requisitions with approval workflow
          </p>
        </div>

        <DataGrid
          dataSource={requisitions}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          loadPanel={{ enabled: loading }}
          data-testid="pr-grid"
        >
          <Toolbar>
            <Item location="before">
              <Button
                text="New Requisition"
                icon="plus"
                type="default"
                stylingMode="contained"
                onClick={() => router.push('/purchasing/requisitions/new')}
                data-testid="new-pr-btn"
              />
            </Item>
            <Item location="after">
              <Button
                icon="refresh"
                onClick={fetchRequisitions}
                hint="Refresh"
                data-testid="refresh-btn"
              />
            </Item>
            <Item name="searchPanel" />
          </Toolbar>

          <SearchPanel visible={true} width={250} placeholder="Search..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={20} />

          <Column dataField="id" caption="ID" width={60} data-testid="col-id" />
          <Column dataField="prNumber" caption="PR Number" width={130} data-testid="col-pr-number" />
          <Column
            dataField="status"
            caption="Status"
            width={140}
            cellRender={renderStatusCell}
            data-testid="col-status"
          />
          <Column
            dataField="priority"
            caption="Priority"
            width={100}
            cellRender={renderPriorityCell}
            data-testid="col-priority"
          />
          <Column dataField="description" caption="Description" minWidth={200} data-testid="col-description" />
          <Column
            dataField="totalEstimatedAmount"
            caption="Est. Amount"
            width={130}
            cellRender={renderAmountCell}
            alignment="right"
            data-testid="col-amount"
          />
          <Column
            dataField="requiredDate"
            caption="Required Date"
            dataType="date"
            width={120}
            format="yyyy-MM-dd"
            data-testid="col-required-date"
          />
          <Column
            dataField="createdAt"
            caption="Created"
            dataType="date"
            width={120}
            format="yyyy-MM-dd"
            data-testid="col-created-at"
          />
          <Column
            caption="Actions"
            width={100}
            cellRender={renderActionsCell}
            data-testid="col-actions"
          />
        </DataGrid>
      </div>
    </MainLayout>
  );
}
