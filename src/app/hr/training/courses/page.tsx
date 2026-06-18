'use client';

// HR Training Courses Page
// Feature: 007-hr-personnel-management
// Updated Task 5: Template Pattern Alignment - Page-based navigation

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { BookOpen, Clock, Target, CheckCircle } from 'lucide-react';
import type { TrainingCourse } from '@/types/hr';

async function fetchCourses(): Promise<TrainingCourse[]> {
  const response = await fetch('/api/hr/training/courses?isActive=true');
  if (!response.ok) throw new Error('Failed to fetch courses');
  const result = await response.json();
  return result.data || [];
}

export default function TrainingCoursesPage() {
  const t = useTranslations('hr');
  const router = useRouter();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['hr', 'training', 'courses'],
    queryFn: fetchCourses,
  });

  // Ensure courses is always an array
  const courseList = Array.isArray(courses) ? courses : [];

  // Page-based navigation pattern - navigate to course detail page on row click
  const handleRowClick = useCallback(
    (e: { data: TrainingCourse }) => {
      router.push(`/hr/training/courses/${e.data.id}`);
    },
    [router]
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto" data-testid="hr-courses-page" data-title={t('training.courses.title')}>
      {/* T034: ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('training.courses.title')}
        subtitle={t('training.courses.description')}
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
            onClick={() => router.push('/hr/training/courses/new')}
            elementAttr={{ 'data-testid': 'hr-add-course-btn' }}
          />
        }
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-3 gap-3 md:gap-4" data-testid="hr-courses-stats">
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="hr-courses-grid">
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
          height="auto"
          onRowClick={handleRowClick}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={200} />
          <Scrolling mode="standard" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />

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
    </div>
  );
}
