/**
 * Approval Workflows List Page (T027)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import type { ApprovalFlowWithDetails, DocumentType } from '@/types/approval-workflow';

const documentTypeLabels: Record<DocumentType, string> = {
  purchase_requisition: 'Purchase Requisition',
  purchase_order: 'Purchase Order',
  ap_invoice: 'AP Invoice',
  ar_invoice: 'AR Invoice',
  payment: 'Payment',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
};

export default function ApprovalWorkflowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<ApprovalFlowWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/approval-flows');
      const result = await response.json();
      if (result.success) {
        setFlows(result.data);
      }
    } catch (error) {
      console.error('Error fetching flows:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await fetch(`/api/settings/approval-flows/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        fetchFlows();
      }
    } catch (error) {
      console.error('Error deleting flow:', error);
    }
  };

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            Approval Workflows
          </h1>
          <p className="text-gray-600">
            Manage approval workflows for different document types
          </p>
        </div>

        <DataGrid
          dataSource={flows}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          loadPanel={{ enabled: loading }}
          data-testid="workflows-grid"
        >
          <Toolbar>
            <Item location="before">
              <Button
                text="New Workflow"
                icon="plus"
                type="default"
                stylingMode="contained"
                onClick={() => router.push('/settings/approval-workflows/new')}
                data-testid="new-workflow-btn"
              />
            </Item>
            <Item location="after">
              <Button
                icon="refresh"
                onClick={fetchFlows}
                hint="Refresh"
                data-testid="refresh-btn"
              />
            </Item>
          </Toolbar>

          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={20} />

          <Column dataField="id" caption="ID" width={60} />
          <Column dataField="name" caption="Name" />
          <Column
            dataField="documentType"
            caption="Document Type"
            cellRender={({ data }) => (
              <span>{documentTypeLabels[data.documentType as DocumentType]}</span>
            )}
          />
          <Column dataField="priority" caption="Priority" width={80} />
          <Column
            dataField="isActive"
            caption="Status"
            width={100}
            cellRender={({ data }) => (
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  data.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {data.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          />
          <Column
            caption="Rules"
            width={80}
            calculateCellValue={(data: ApprovalFlowWithDetails) => data.rules.length}
          />
          <Column
            caption="Steps"
            width={80}
            calculateCellValue={(data: ApprovalFlowWithDetails) => data.steps.length}
          />
          <Column
            caption="Actions"
            width={150}
            cellRender={({ data }) => (
              <div className="flex gap-2">
                <Button
                  icon="edit"
                  hint="Edit"
                  stylingMode="text"
                  onClick={() => router.push(`/settings/approval-workflows/${data.id}`)}
                  data-testid={`edit-btn-${data.id}`}
                />
                <Button
                  icon="trash"
                  hint="Delete"
                  stylingMode="text"
                  onClick={() => handleDelete(data.id)}
                  data-testid={`delete-btn-${data.id}`}
                />
              </div>
            )}
          />
        </DataGrid>
      </div>
    </MainLayout>
  );
}
