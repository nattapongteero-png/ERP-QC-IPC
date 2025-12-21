'use client';

// HR Positions Management Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Selection,
  Scrolling,
  Editing,
  Toolbar,
  Item,
  Lookup,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextArea from 'devextreme-react/text-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { OrgUnitPicker } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { Briefcase, FileText, Plus, Check, X, Clock } from 'lucide-react';
import type { Position, PositionWithDetails, OrgUnit, JobDescription } from '@/types/hr';
import type { RowInsertingEvent, RowUpdatingEvent, RowRemovingEvent } from 'devextreme/ui/data_grid';

const JD_STATUS_CONFIG = {
  draft: { label: 'ร่าง', variant: 'secondary' as const, icon: FileText },
  pending_approval: { label: 'รอตรวจสอบ', variant: 'warning' as const, icon: Clock },
  approved: { label: 'อนุมัติ', variant: 'success' as const, icon: Check },
  obsolete: { label: 'ยกเลิก', variant: 'danger' as const, icon: X },
};

async function fetchPositions(): Promise<Position[]> {
  const response = await fetch('/api/hr/positions');
  if (!response.ok) throw new Error('Failed to fetch positions');
  const result = await response.json();
  return result.data || [];
}

async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const response = await fetch('/api/hr/org-units');
  if (!response.ok) throw new Error('Failed to fetch org units');
  const result = await response.json();
  return result.data || [];
}

async function fetchJobDescriptions(positionId: number): Promise<JobDescription[]> {
  const response = await fetch(`/api/hr/positions/${positionId}/job-descriptions`);
  if (!response.ok) throw new Error('Failed to fetch job descriptions');
  const result = await response.json();
  return result.data || [];
}

async function createPosition(data: Partial<Position>): Promise<Position> {
  const response = await fetch('/api/hr/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create position');
  const result = await response.json();
  return result.data;
}

async function updatePosition(id: number, data: Partial<Position>): Promise<Position> {
  const response = await fetch(`/api/hr/positions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update position');
  const result = await response.json();
  return result.data;
}

async function createJobDescription(positionId: number, data: Partial<JobDescription>): Promise<JobDescription> {
  const response = await fetch(`/api/hr/positions/${positionId}/job-descriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create job description');
  const result = await response.json();
  return result.data;
}

export default function PositionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showJDPopup, setShowJDPopup] = useState(false);
  const [newJD, setNewJD] = useState({
    responsibilities: '',
    authorities: '',
    qualifications: '',
  });

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['hr', 'positions'],
    queryFn: fetchPositions,
  });

  const { data: orgUnits = [] } = useQuery({
    queryKey: ['hr', 'org-units'],
    queryFn: fetchOrgUnits,
  });

  const { data: jobDescriptions = [] } = useQuery({
    queryKey: ['hr', 'job-descriptions', selectedPosition?.id],
    queryFn: () => selectedPosition ? fetchJobDescriptions(selectedPosition.id) : Promise.resolve([]),
    enabled: !!selectedPosition,
  });

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      toast.success('สร้างตำแหน่งสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถสร้างตำแหน่งได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Position> }) =>
      updatePosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      toast.success('อัปเดตตำแหน่งสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถอัปเดตตำแหน่งได้');
    },
  });

  const createJDMutation = useMutation({
    mutationFn: ({ positionId, data }: { positionId: number; data: Partial<JobDescription> }) =>
      createJobDescription(positionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'job-descriptions', selectedPosition?.id] });
      setShowJDPopup(false);
      setNewJD({ responsibilities: '', authorities: '', qualifications: '' });
      toast.success('สร้างรายละเอียดงานสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถสร้างรายละเอียดงานได้');
    },
  });

  const handleRowInserting = useCallback(
    (e: RowInsertingEvent) => {
      e.cancel = new Promise<boolean>((resolve, reject) => {
        createMutation.mutate(e.data, {
          onSuccess: () => resolve(false),
          onError: () => reject(),
        });
      });
    },
    [createMutation]
  );

  const handleRowUpdating = useCallback(
    (e: RowUpdatingEvent) => {
      const id = e.key as number;
      e.cancel = new Promise<boolean>((resolve, reject) => {
        updateMutation.mutate(
          { id, data: e.newData },
          {
            onSuccess: () => resolve(false),
            onError: () => reject(),
          }
        );
      });
    },
    [updateMutation]
  );

  const handleRowClick = useCallback((e: { data: Position }) => {
    setSelectedPosition(e.data);
  }, []);

  const handleCreateJD = useCallback(() => {
    if (!selectedPosition) return;
    createJDMutation.mutate({
      positionId: selectedPosition.id,
      data: newJD,
    });
  }, [selectedPosition, newJD, createJDMutation]);

  const renderGmpCriticalCell = (cellData: { value: boolean }) => {
    return cellData.value ? (
      <Badge variant="danger" className="text-xs">GMP</Badge>
    ) : null;
  };

  const renderActiveCell = (cellData: { value: boolean }) => {
    return (
      <Badge variant={cellData.value ? 'success' : 'secondary'} className="text-xs">
        {cellData.value ? 'ใช้งาน' : 'ปิดใช้งาน'}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-blue-600" />
            ตำแหน่งงาน
          </h1>
          <p className="text-gray-500 mt-1">
            Position Management • {positions.length} รายการ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Positions DataGrid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <DataGrid
            dataSource={positions}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            allowColumnReordering
            allowColumnResizing
            height={600}
            onRowClick={handleRowClick}
            onRowInserting={handleRowInserting}
            onRowUpdating={handleRowUpdating}
            hoverStateEnabled
            loadPanel={{ enabled: isLoading }}
            selectedRowKeys={selectedPosition ? [selectedPosition.id] : []}
          >
            <SearchPanel visible placeholder="ค้นหา..." width={250} />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />
            <Selection mode="single" />
            <Editing
              mode="row"
              allowAdding
              allowUpdating
              useIcons
            />

            <Toolbar>
              <Item name="addRowButton" />
              <Item name="searchPanel" />
            </Toolbar>

            <Column dataField="code" caption="รหัส" width={100} />
            <Column dataField="title" caption="ชื่อตำแหน่ง" minWidth={150} />
            <Column dataField="titleEn" caption="ชื่อภาษาอังกฤษ" width={150} />
            <Column
              dataField="orgUnitId"
              caption="หน่วยงาน"
              width={150}
            >
              <Lookup
                dataSource={orgUnits}
                valueExpr="id"
                displayExpr="name"
              />
            </Column>
            <Column dataField="jobGrade" caption="ระดับ" width={80} />
            <Column
              dataField="isGmpCritical"
              caption="GMP"
              width={70}
              cellRender={renderGmpCriticalCell}
              alignment="center"
            />
            <Column
              dataField="isActive"
              caption="สถานะ"
              width={90}
              cellRender={renderActiveCell}
              alignment="center"
            />
          </DataGrid>
        </div>

        {/* Position Details & Job Descriptions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selectedPosition ? (
            <div className="h-full flex flex-col">
              {/* Position Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{selectedPosition.title}</h3>
                <p className="text-sm text-gray-500">{selectedPosition.code}</p>
                <div className="flex items-center gap-2 mt-2">
                  {selectedPosition.isGmpCritical && (
                    <Badge variant="danger" className="text-xs">GMP Critical</Badge>
                  )}
                  {selectedPosition.jobGrade && (
                    <Badge variant="info" className="text-xs">{selectedPosition.jobGrade}</Badge>
                  )}
                </div>
              </div>

              {/* Job Descriptions */}
              <div className="flex-1 overflow-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    รายละเอียดงาน
                  </h4>
                  <DxButton
                    icon="add"
                    text="เพิ่ม"
                    type="default"
                    stylingMode="text"
                    onClick={() => setShowJDPopup(true)}
                  />
                </div>

                {jobDescriptions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    ยังไม่มีรายละเอียดงาน
                  </p>
                ) : (
                  <div className="space-y-3">
                    {jobDescriptions.map((jd) => {
                      const statusConfig = JD_STATUS_CONFIG[jd.status];
                      return (
                        <div
                          key={jd.id}
                          className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              v{jd.version}
                            </span>
                            <Badge variant={statusConfig.variant} className="text-xs">
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            {jd.effectiveFrom && (
                              <p>มีผล: {formatDate(jd.effectiveFrom)}</p>
                            )}
                            {jd.approvedAt && (
                              <p>อนุมัติ: {formatDate(jd.approvedAt)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-gray-400 text-center">
                เลือกตำแหน่งเพื่อดูรายละเอียด
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Job Description Popup */}
      <Popup
        visible={showJDPopup}
        onHiding={() => setShowJDPopup(false)}
        title={`สร้างรายละเอียดงาน - ${selectedPosition?.title || ''}`}
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หน้าที่ความรับผิดชอบ
            </label>
            <TextArea
              value={newJD.responsibilities}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, responsibilities: e.value || '' }))}
              height={100}
              placeholder="ระบุหน้าที่ความรับผิดชอบ..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              อำนาจหน้าที่
            </label>
            <TextArea
              value={newJD.authorities}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, authorities: e.value || '' }))}
              height={100}
              placeholder="ระบุอำนาจหน้าที่..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คุณสมบัติ
            </label>
            <TextArea
              value={newJD.qualifications}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, qualifications: e.value || '' }))}
              height={100}
              placeholder="ระบุคุณสมบัติ..."
            />
          </div>
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            stylingMode: 'contained',
            onClick: handleCreateJD,
            disabled: createJDMutation.isPending,
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            type: 'default',
            stylingMode: 'outlined',
            onClick: () => setShowJDPopup(false),
          }}
        />
      </Popup>
    </div>
  );
}
