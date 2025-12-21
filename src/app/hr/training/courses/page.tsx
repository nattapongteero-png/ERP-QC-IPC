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
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import NumberBox from 'devextreme-react/number-box';
import CheckBox from 'devextreme-react/check-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { BookOpen, Clock, Target, CheckCircle } from 'lucide-react';
import type { TrainingCourse } from '@/types/hr';

interface CourseFormData {
  code: string;
  name: string;
  nameEn: string;
  category: string;
  description: string;
  validityDays: number | null;
  durationHours: number | null;
  isMandatory: boolean;
}

const emptyFormData: CourseFormData = {
  code: '',
  name: '',
  nameEn: '',
  category: '',
  description: '',
  validityDays: null,
  durationHours: null,
  isMandatory: false,
};

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
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create course');
  }
  const result = await response.json();
  return result.data;
}

async function updateCourse(id: number, data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const response = await fetch(`/api/hr/training/courses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update course');
  }
  const result = await response.json();
  return result.data;
}

export default function TrainingCoursesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [gridHeight, setGridHeight] = useState(600);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [formData, setFormData] = useState<CourseFormData>(emptyFormData);

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
      setShowCreatePopup(false);
      setFormData(emptyFormData);
      toast.success('สร้างหลักสูตรอบรมสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถสร้างหลักสูตรได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TrainingCourse> }) =>
      updateCourse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      setShowEditPopup(false);
      setSelectedCourse(null);
      setFormData(emptyFormData);
      toast.success('อัปเดตหลักสูตรสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถอัปเดตหลักสูตรได้');
    },
  });

  const handleCreateCourse = useCallback(() => {
    if (!formData.code || !formData.name) return;
    createMutation.mutate({
      code: formData.code,
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      category: formData.category || undefined,
      description: formData.description || undefined,
      validityDays: formData.validityDays || undefined,
      durationHours: formData.durationHours || undefined,
      isMandatory: formData.isMandatory,
    });
  }, [formData, createMutation]);

  const handleUpdateCourse = useCallback(() => {
    if (!selectedCourse || !formData.name) return;
    updateMutation.mutate({
      id: selectedCourse.id,
      data: {
        code: formData.code,
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        validityDays: formData.validityDays || undefined,
        durationHours: formData.durationHours || undefined,
        isMandatory: formData.isMandatory,
      },
    });
  }, [selectedCourse, formData, updateMutation]);

  const openEditPopup = useCallback((course: TrainingCourse) => {
    setSelectedCourse(course);
    setFormData({
      code: course.code || '',
      name: course.name || '',
      nameEn: course.nameEn || '',
      category: course.category || '',
      description: course.description || '',
      validityDays: course.validityDays || null,
      durationHours: course.durationHours || null,
      isMandatory: course.isMandatory || false,
    });
    setShowEditPopup(true);
  }, []);

  const handleRowClick = useCallback(
    (e: { data: TrainingCourse }) => {
      openEditPopup(e.data);
    },
    [openEditPopup]
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

  // Form content for popup
  const renderFormContent = () => (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รหัสหลักสูตร <span className="text-red-500">*</span>
          </label>
          <TextBox
            value={formData.code}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, code: e.value || '' }))}
            placeholder="เช่น GMP-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมวดหมู่
          </label>
          <TextBox
            value={formData.category}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, category: e.value || '' }))}
            placeholder="เช่น GMP, Safety"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อหลักสูตร (ภาษาไทย) <span className="text-red-500">*</span>
        </label>
        <TextBox
          value={formData.name}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, name: e.value || '' }))}
          placeholder="ชื่อหลักสูตรภาษาไทย"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อหลักสูตร (ภาษาอังกฤษ)
        </label>
        <TextBox
          value={formData.nameEn}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, nameEn: e.value || '' }))}
          placeholder="Course name in English"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          รายละเอียด
        </label>
        <TextArea
          value={formData.description}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, description: e.value || '' }))}
          placeholder="ระบุรายละเอียดหลักสูตร..."
          height={100}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            อายุการรับรอง (วัน)
          </label>
          <NumberBox
            value={formData.validityDays}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, validityDays: e.value }))}
            min={0}
            showSpinButtons
            placeholder="เช่น 365"
          />
          <p className="text-xs text-gray-500 mt-1">ว่างเปล่า = ไม่มีหมดอายุ</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ระยะเวลาอบรม (ชั่วโมง)
          </label>
          <NumberBox
            value={formData.durationHours}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, durationHours: e.value }))}
            min={0}
            showSpinButtons
            placeholder="เช่น 8"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <CheckBox
          value={formData.isMandatory}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, isMandatory: e.value || false }))}
        />
        <label className="text-sm font-medium text-gray-700">
          หลักสูตรบังคับ
        </label>
      </div>
    </div>
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
        actions={
          <DxButton
            text="เพิ่มหลักสูตร"
            icon="plus"
            type="default"
            onClick={() => {
              setFormData(emptyFormData);
              setShowCreatePopup(true);
            }}
          />
        }
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
          onRowClick={handleRowClick}
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

          <Toolbar>
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
        onHiding={() => {
          setShowCreatePopup(false);
          setFormData(emptyFormData);
        }}
        title="เพิ่มหลักสูตรอบรมใหม่"
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
            disabled: !formData.code || !formData.name || createMutation.isPending,
            onClick: handleCreateCourse,
          }}
        />
      </Popup>

      {/* Edit Course Popup */}
      <Popup
        visible={showEditPopup}
        onHiding={() => {
          setShowEditPopup(false);
          setSelectedCourse(null);
          setFormData(emptyFormData);
        }}
        title={`แก้ไขหลักสูตร: ${selectedCourse?.code || ''}`}
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
              setSelectedCourse(null);
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
            disabled: !formData.name || updateMutation.isPending,
            onClick: handleUpdateCourse,
          }}
        />
      </Popup>
    </div>
  );
}
