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
  Popup as GridPopup,
  Form as GridForm,
} from 'devextreme-react/data-grid';
import { SimpleItem, GroupItem } from 'devextreme-react/form';
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
  const [gridHeight, setGridHeight] = useState(600);

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

  // Ensure courses is always an array
  const courseList = Array.isArray(courses) ? courses : [];

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
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
        subtitle={`Training Courses Catalog • ${courseList.length} หลักสูตร`}
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
          value={courseList.length}
          icon={BookOpen}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="หลักสูตรบังคับ"
          value={courseList.filter((c) => c.isMandatory).length}
          icon={Target}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="มีวันหมดอายุ"
          value={courseList.filter((c) => c.validityDays).length}
          icon={Clock}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* T035: DataGrid with columnHidingEnabled */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={courseList}
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
          <Editing mode="popup" allowAdding allowUpdating useIcons>
            <GridPopup title="หลักสูตรอบรม" showTitle width={600} height="auto" />
            <GridForm>
              <GroupItem colCount={2}>
                <SimpleItem dataField="code" isRequired>
                  <label text="รหัสหลักสูตร" />
                </SimpleItem>
                <SimpleItem dataField="category">
                  <label text="หมวดหมู่" />
                </SimpleItem>
              </GroupItem>
              <SimpleItem dataField="name" isRequired>
                <label text="ชื่อหลักสูตร (ภาษาไทย)" />
              </SimpleItem>
              <SimpleItem dataField="nameEn">
                <label text="ชื่อหลักสูตร (ภาษาอังกฤษ)" />
              </SimpleItem>
              <SimpleItem dataField="description" editorType="dxTextArea" editorOptions={{ height: 100 }}>
                <label text="รายละเอียด" />
              </SimpleItem>
              <GroupItem colCount={2}>
                <SimpleItem dataField="validityDays" editorType="dxNumberBox" editorOptions={{ min: 0 }}>
                  <label text="อายุการรับรอง (วัน)" />
                </SimpleItem>
                <SimpleItem dataField="durationHours" editorType="dxNumberBox" editorOptions={{ min: 0 }}>
                  <label text="ระยะเวลาอบรม (ชั่วโมง)" />
                </SimpleItem>
              </GroupItem>
              <SimpleItem dataField="isMandatory" editorType="dxCheckBox">
                <label text="หลักสูตรบังคับ" />
              </SimpleItem>
            </GridForm>
          </Editing>

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
    </div>
  );
}
