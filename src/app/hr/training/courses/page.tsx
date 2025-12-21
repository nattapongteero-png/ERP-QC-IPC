'use client';

// HR Training Courses Page
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
  Editing,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import NumberBox from 'devextreme-react/number-box';
import CheckBox from 'devextreme-react/check-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { BookOpen, Clock, Target, CheckCircle } from 'lucide-react';
import type { TrainingCourse } from '@/types/hr';
import type { RowInsertingEvent, RowUpdatingEvent } from 'devextreme/ui/data_grid';

async function fetchCourses(): Promise<TrainingCourse[]> {
  const response = await fetch('/api/hr/training/courses?isActive=true');
  if (!response.ok) throw new Error('Failed to fetch courses');
  const result = await response.json();
  return result.data || [];
}

async function createCourse(data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const response = await fetch('/api/hr/training/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create course');
  const result = await response.json();
  return result.data;
}

async function updateCourse(id: number, data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const response = await fetch(`/api/hr/training/courses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update course');
  const result = await response.json();
  return result.data;
}

export default function TrainingCoursesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);
  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    nameEn: '',
    description: '',
    category: '',
    validityDays: undefined as number | undefined,
    durationHours: undefined as number | undefined,
    isMandatory: false,
  });

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 280;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['hr', 'training', 'courses'],
    queryFn: fetchCourses,
  });

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      setShowCreatePopup(false);
      setNewCourse({
        code: '',
        name: '',
        nameEn: '',
        description: '',
        category: '',
        validityDays: undefined,
        durationHours: undefined,
        isMandatory: false,
      });
      toast.success('สร้างหลักสูตรอบรมสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถสร้างหลักสูตรได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TrainingCourse> }) =>
      updateCourse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      toast.success('อัปเดตหลักสูตรสำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถอัปเดตหลักสูตรได้');
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

  const handleCreateCourse = useCallback(() => {
    createMutation.mutate(newCourse);
  }, [newCourse, createMutation]);

  const renderMandatoryCell = (cellData: { value: boolean }) => {
    return cellData.value ? (
      <Badge variant="danger" className="text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        บังคับ
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">ไม่บังคับ</Badge>
    );
  };

  const renderValidityCell = (cellData: { value: number | null }) => {
    if (!cellData.value) {
      return <span className="text-gray-400">ไม่มีหมดอายุ</span>;
    }
    const years = Math.floor(cellData.value / 365);
    const months = Math.floor((cellData.value % 365) / 30);
    if (years > 0) {
      return (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-blue-500" />
          {years} ปี {months > 0 ? `${months} เดือน` : ''}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3 text-blue-500" />
        {cellData.value} วัน
      </span>
    );
  };

  const renderDurationCell = (cellData: { value: number | null }) => {
    if (!cellData.value) return <span className="text-gray-400">-</span>;
    return <span>{cellData.value} ชม.</span>;
  };

  const renderActiveCell = (cellData: { value: boolean }) => (
    <Badge variant={cellData.value ? 'success' : 'secondary'} className="text-xs">
      {cellData.value ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </Badge>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* T034: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="หลักสูตรอบรม"
        subtitle={`Training Courses Catalog • ${courses.length} หลักสูตร`}
        icon={BookOpen}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'การอบรม', href: '/hr/training' },
          { label: 'หลักสูตร' },
        ]}
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label="หลักสูตรทั้งหมด"
          value={courses.length}
          icon={BookOpen}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="หลักสูตรบังคับ"
          value={courses.filter((c) => c.isMandatory).length}
          icon={Target}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="มีวันหมดอายุ"
          value={courses.filter((c) => c.validityDays).length}
          icon={Clock}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* T035: DataGrid with columnHidingEnabled */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={courses}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          allowColumnReordering
          allowColumnResizing
          columnHidingEnabled
          height={gridHeight}
          onRowInserting={handleRowInserting}
          onRowUpdating={handleRowUpdating}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={200} />
          <HeaderFilter visible />
          <FilterRow visible />
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
          <Selection mode="single" />
          <Editing mode="row" allowAdding allowUpdating useIcons />

          <Toolbar>
            <Item name="addRowButton" />
            <Item name="searchPanel" />
          </Toolbar>

          <Column dataField="code" caption="รหัส" width={100} hidingPriority={1} />
          <Column dataField="name" caption="ชื่อหลักสูตร" minWidth={180} hidingPriority={0} />
          <Column dataField="nameEn" caption="ชื่อภาษาอังกฤษ" width={180} hidingPriority={5} />
          <Column dataField="category" caption="หมวดหมู่" width={120} hidingPriority={3} />
          <Column
            dataField="isMandatory"
            caption="ประเภท"
            width={100}
            cellRender={renderMandatoryCell}
            alignment="center"
            hidingPriority={2}
          />
          <Column
            dataField="validityDays"
            caption="อายุการรับรอง"
            width={140}
            cellRender={renderValidityCell}
            hidingPriority={4}
          />
          <Column
            dataField="durationHours"
            caption="ระยะเวลา"
            width={90}
            cellRender={renderDurationCell}
            alignment="center"
            hidingPriority={6}
          />
          <Column
            dataField="isActive"
            caption="สถานะ"
            width={90}
            cellRender={renderActiveCell}
            alignment="center"
            hidingPriority={7}
          />
        </DataGrid>
      </div>

      {/* Create Course Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => setShowCreatePopup(false)}
        title="สร้างหลักสูตรอบรมใหม่"
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextBox
              value={newCourse.code}
              onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, code: e.value || '' }))}
              label="รหัสหลักสูตร"
              labelMode="floating"
            />
            <TextBox
              value={newCourse.category}
              onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, category: e.value || '' }))}
              label="หมวดหมู่"
              labelMode="floating"
            />
          </div>
          <TextBox
            value={newCourse.name}
            onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, name: e.value || '' }))}
            label="ชื่อหลักสูตร (ภาษาไทย)"
            labelMode="floating"
          />
          <TextBox
            value={newCourse.nameEn}
            onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, nameEn: e.value || '' }))}
            label="ชื่อหลักสูตร (ภาษาอังกฤษ)"
            labelMode="floating"
          />
          <TextArea
            value={newCourse.description}
            onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, description: e.value || '' }))}
            label="รายละเอียด"
            labelMode="floating"
            height={100}
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberBox
              value={newCourse.validityDays}
              onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, validityDays: e.value }))}
              label="อายุการรับรอง (วัน)"
              labelMode="floating"
              min={0}
            />
            <NumberBox
              value={newCourse.durationHours}
              onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, durationHours: e.value }))}
              label="ระยะเวลาอบรม (ชั่วโมง)"
              labelMode="floating"
              min={0}
            />
          </div>
          <CheckBox
            value={newCourse.isMandatory}
            onValueChanged={(e) => setNewCourse((prev) => ({ ...prev, isMandatory: e.value || false }))}
            text="หลักสูตรบังคับ"
          />
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            stylingMode: 'contained',
            onClick: handleCreateCourse,
            disabled: createMutation.isPending || !newCourse.code || !newCourse.name,
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            type: 'default',
            stylingMode: 'outlined',
            onClick: () => setShowCreatePopup(false),
          }}
        />
      </Popup>
    </div>
  );
}
