/**
 * Approval Workflow History Page (T125)
 * Shows audit log of all approval requests processed by this workflow
 * Part of 011-accounting-spec-gap - User Story 5
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';

interface WorkflowHistoryItem {
  id: number;
  documentType: string;
  documentId: number;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  requestedByName: string;
  steps: {
    stepOrder: number;
    status: string;
    approverName: string | null;
    actionAt: string | null;
    comments: string | null;
  }[];
}

interface WorkflowInfo {
  id: number;
  name: string;
  documentType: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function WorkflowHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [flowRes, historyRes] = await Promise.all([
        fetch(`/api/settings/approval-flows/${id}`),
        fetch(`/api/settings/approval-flows/${id}/history?page=${page}&limit=${limit}`),
      ]);

      const flowData = await flowRes.json();
      const historyData = await historyRes.json();

      if (flowData.success) {
        setWorkflow(flowData.data);
      }
      if (historyData.success) {
        setHistory(historyData.data.data);
        setTotal(historyData.data.total);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderStatus = (cellData: any) => {
    const status = cellData.value as string;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const renderSteps = (cellData: any) => {
    const item = cellData.data as WorkflowHistoryItem;
    return (
      <div className="flex gap-1">
        {item.steps.map((step, index) => (
          <div
            key={index}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              step.status === 'approved'
                ? 'bg-green-500 text-white'
                : step.status === 'rejected'
                ? 'bg-red-500 text-white'
                : step.status === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}
            title={`ขั้นตอน ${step.stepOrder}: ${step.status} ${step.approverName ? `โดย ${step.approverName}` : ''}`}
          >
            {step.stepOrder}
          </div>
        ))}
      </div>
    );
  };

  if (loading && !workflow) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Button
              icon="back"
              text="ย้อนกลับ"
              stylingMode="text"
              onClick={() => router.push(`/settings/approval-workflows/${id}`)}
            />
            <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
              ประวัติเวิร์กโฟลว์: {workflow?.name}
            </h1>
            <p className="text-gray-600">
              บันทึกการตรวจสอบคำขออนุมัติทั้งหมดที่ผ่านเวิร์กโฟลว์นี้
            </p>
          </div>
          <Button
            icon="refresh"
            onClick={fetchData}
            hint="รีเฟรช"
            data-testid="refresh-btn"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-500">คำขอทั้งหมด</div>
            <div className="text-2xl font-bold text-blue-600">{total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-500">อนุมัติแล้ว</div>
            <div className="text-2xl font-bold text-green-600">
              {history.filter((h) => h.status === 'approved').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-500">ปฏิเสธ</div>
            <div className="text-2xl font-bold text-red-600">
              {history.filter((h) => h.status === 'rejected').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-500">รอดำเนินการ</div>
            <div className="text-2xl font-bold text-yellow-600">
              {history.filter((h) => h.status === 'pending').length}
            </div>
          </div>
        </div>

        {/* History Grid */}
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={history}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            loadPanel={{ enabled: loading }}
            data-testid="history-grid"
          >
            <Paging defaultPageSize={20} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">ประวัติคำขอ</span>
              </Item>
            </Toolbar>

            <Column dataField="id" caption="รหัสคำขอ" width={100} />
            <Column dataField="documentType" caption="ประเภทเอกสาร" width={150} />
            <Column dataField="documentId" caption="รหัสเอกสาร" width={100} />
            <Column
              dataField="status"
              caption="สถานะ"
              width={120}
              cellRender={renderStatus}
            />
            <Column
              caption="ขั้นตอน"
              width={150}
              cellRender={renderSteps}
            />
            <Column dataField="requestedByName" caption="ผู้ขอ" width={150} />
            <Column
              dataField="requestedAt"
              caption="ขอเมื่อ"
              width={180}
              dataType="datetime"
            />
            <Column
              dataField="completedAt"
              caption="เสร็จเมื่อ"
              width={180}
              dataType="datetime"
            />
          </DataGrid>
        </div>
      </div>
  );
}
