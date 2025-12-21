'use client';

// HR Positions Management Page
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Selection,
  Scrolling,
  Toolbar,
  Item,
  Lookup,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import SelectBox from 'devextreme-react/select-box';
import CheckBox from 'devextreme-react/check-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { Briefcase, FileText, Check, X, Clock } from 'lucide-react';
import type { Position, OrgUnit, JobDescription } from '@/types/hr';

interface PositionFormData {
  code: string;
  title: string;
  titleEn: string;
  orgUnitId: number | null;
  jobGrade: string;
  isGmpCritical: boolean;
}

const emptyFormData: PositionFormData = {
  code: '',
  title: '',
  titleEn: '',
  orgUnitId: null,
  jobGrade: '',
  isGmpCritical: false,
};

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
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create position');
  }
  const result = await response.json();
  return result.data;
}

async function updatePosition(id: number, data: Partial<Position>): Promise<Position> {
  const response = await fetch(`/api/hr/positions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update position');
  }
  const result = await response.json();
  return result.data;
}

async function createJobDescription(positionId: number, data: Partial<JobDescription>): Promise<JobDescription> {
  const response = await fetch(`/api/hr/positions/${positionId}/job-descriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create job description');
  }
  const result = await response.json();
  return result.data;
}

export default function PositionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showJDPopup, setShowJDPopup] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);
  const [formData, setFormData] = useState<PositionFormData>(emptyFormData);
  const [newJD, setNewJD] = useState({
    responsibilities: '',
    authorities: '',
    qualifications: '',
  });

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 180;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

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
      setShowCreatePopup(false);
      setFormData(emptyFormData);
      toast.success('สร้างตำแหน่งสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถสร้างตำแหน่งได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Position> }) =>
      updatePosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      setShowEditPopup(false);
      setSelectedPosition(null);
      setFormData(emptyFormData);
      toast.success('อัปเดตตำแหน่งสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถอัปเดตตำแหน่งได้');
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
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถสร้างรายละเอียดงานได้');
    },
  });

  const handleCreatePosition = useCallback(() => {
    if (!formData.code || !formData.title) return;
    createMutation.mutate({
      code: formData.code,
      title: formData.title,
      titleEn: formData.titleEn || undefined,
      orgUnitId: formData.orgUnitId || undefined,
      jobGrade: formData.jobGrade || undefined,
      isGmpCritical: formData.isGmpCritical,
    });
  }, [formData, createMutation]);

  const handleUpdatePosition = useCallback(() => {
    if (!selectedPosition || !formData.title) return;
    updateMutation.mutate({
      id: selectedPosition.id,
      data: {
        code: formData.code,
        title: formData.title,
        titleEn: formData.titleEn || undefined,
        orgUnitId: formData.orgUnitId || undefined,
        jobGrade: formData.jobGrade || undefined,
        isGmpCritical: formData.isGmpCritical,
      },
    });
  }, [selectedPosition, formData, updateMutation]);

  const openEditPopup = useCallback((position: Position) => {
    setSelectedPosition(position);
    setFormData({
      code: position.code || '',
      title: position.title || '',
      titleEn: position.titleEn || '',
      orgUnitId: position.orgUnitId || null,
      jobGrade: position.jobGrade || '',
      isGmpCritical: position.isGmpCritical || false,
    });
    setShowEditPopup(true);
  }, []);

  const handleRowClick = useCallback((e: { data: Position }) => {
    setSelectedPosition(e.data);
    setShowDetailPanel(true);
  }, []);

  const handleRowDblClick = useCallback((e: { data: Position }) => {
    openEditPopup(e.data);
  }, [openEditPopup]);

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

  // Form content for popup
  const renderFormContent = () => (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รหัสตำแหน่ง <span className="text-red-500">*</span>
          </label>
          <TextBox
            value={formData.code}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, code: e.value || '' }))}
            placeholder="เช่น QC-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ระดับตำแหน่ง
          </label>
          <TextBox
            value={formData.jobGrade}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, jobGrade: e.value || '' }))}
            placeholder="เช่น Manager, Supervisor"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อตำแหน่ง (ภาษาไทย) <span className="text-red-500">*</span>
        </label>
        <TextBox
          value={formData.title}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, title: e.value || '' }))}
          placeholder="ชื่อตำแหน่งภาษาไทย"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อตำแหน่ง (ภาษาอังกฤษ)
        </label>
        <TextBox
          value={formData.titleEn}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, titleEn: e.value || '' }))}
          placeholder="Position title in English"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          หน่วยงาน
        </label>
        <SelectBox
          dataSource={orgUnits}
          valueExpr="id"
          displayExpr="name"
          value={formData.orgUnitId}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, orgUnitId: e.value }))}
          placeholder="เลือกหน่วยงาน..."
          searchEnabled
          showClearButton
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <CheckBox
          value={formData.isGmpCritical}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, isGmpCritical: e.value || false }))}
        />
        <label className="text-sm font-medium text-gray-700">
          ตำแหน่ง GMP Critical
        </label>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* T026: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="ตำแหน่งงาน"
        subtitle={`Position Management • ${positions.length} รายการ`}
        icon={Briefcase}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'ตำแหน่งงาน' },
        ]}
        actions={
          <DxButton
            text="เพิ่มตำแหน่ง"
            icon="plus"
            type="default"
            onClick={() => {
              setFormData(emptyFormData);
              setShowCreatePopup(true);
            }}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* T027: Positions DataGrid with columnHidingEnabled */}
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
            columnHidingEnabled
            height={gridHeight}
            onRowClick={handleRowClick}
            onRowDblClick={handleRowDblClick}
            hoverStateEnabled
            loadPanel={{ enabled: isLoading }}
            selectedRowKeys={selectedPosition ? [selectedPosition.id] : []}
          >
            <SearchPanel visible placeholder="ค้นหา..." width={200} />
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

            <Toolbar>
              <Item name="searchPanel" />
            </Toolbar>

            <Column dataField="code" caption="รหัส" width={100} hidingPriority={1} />
            <Column dataField="title" caption="ชื่อตำแหน่ง" minWidth={150} hidingPriority={0} />
            <Column dataField="titleEn" caption="ชื่อภาษาอังกฤษ" width={150} hidingPriority={4} />
            <Column
              dataField="orgUnitId"
              caption="หน่วยงาน"
              width={150}
              hidingPriority={3}
            >
              <Lookup
                dataSource={orgUnits}
                valueExpr="id"
                displayExpr="name"
              />
            </Column>
            <Column dataField="jobGrade" caption="ระดับ" width={80} hidingPriority={5} />
            <Column
              dataField="isGmpCritical"
              caption="GMP"
              width={70}
              cellRender={renderGmpCriticalCell}
              alignment="center"
              hidingPriority={2}
            />
            <Column
              dataField="isActive"
              caption="สถานะ"
              width={90}
              cellRender={renderActiveCell}
              alignment="center"
              hidingPriority={6}
            />
          </DataGrid>
        </div>

        {/* T028: Position Details Panel - collapsible on mobile */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!showDetailPanel && selectedPosition ? 'hidden lg:block' : ''}`}>
          {selectedPosition ? (
            <div className="h-full flex flex-col">
              {/* Position Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedPosition.title}</h3>
                    <p className="text-sm text-gray-500">{selectedPosition.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DxButton
                      icon="edit"
                      hint="แก้ไข"
                      type="default"
                      stylingMode="text"
                      onClick={() => openEditPopup(selectedPosition)}
                    />
                    <button
                      onClick={() => setShowDetailPanel(false)}
                      className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Close panel"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
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

      {/* Create Position Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => {
          setShowCreatePopup(false);
          setFormData(emptyFormData);
        }}
        title="เพิ่มตำแหน่งงานใหม่"
        width={600}
        height="auto"
        showCloseButton
      >
        {renderFormContent()}

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowCreatePopup(false);
              setFormData(emptyFormData);
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'สร้าง',
            type: 'default',
            disabled: !formData.code || !formData.title || createMutation.isPending,
            onClick: handleCreatePosition,
          }}
        />
      </Popup>

      {/* Edit Position Popup */}
      <Popup
        visible={showEditPopup}
        onHiding={() => {
          setShowEditPopup(false);
          setSelectedPosition(null);
          setFormData(emptyFormData);
        }}
        title={`แก้ไขตำแหน่ง: ${selectedPosition?.code || ''}`}
        width={600}
        height="auto"
        showCloseButton
      >
        {renderFormContent()}

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowEditPopup(false);
              setSelectedPosition(null);
              setFormData(emptyFormData);
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            disabled: !formData.title || updateMutation.isPending,
            onClick: handleUpdatePosition,
          }}
        />
      </Popup>

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
            text: 'ยกเลิก',
            onClick: () => setShowJDPopup(false),
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            disabled: createJDMutation.isPending,
            onClick: handleCreateJD,
          }}
        />
      </Popup>
    </div>
  );
}
