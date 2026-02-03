'use client';

// HR Competency Matrix Page
// Feature: 007-hr-personnel-management

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  HeaderFilter,
  Scrolling,
  Paging,
  ColumnFixing,
  Export,
} from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Grid3X3, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { CompetencyMatrix, TrainingCourse, TrainingRecordStatus, OrgUnit } from '@/types/hr';

const STATUS_CONFIG: Record<TrainingRecordStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  valid: { label: 'ผ่าน', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  expiring_soon: { label: 'ใกล้หมดอายุ', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: AlertTriangle },
  expired: { label: 'หมดอายุ', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  not_taken: { label: 'ยังไม่อบรม', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
};

async function fetchCompetencyMatrix(): Promise<CompetencyMatrix[]> {
  const response = await fetch('/api/hr/training/competency-matrix');
  if (!response.ok) throw new Error('Failed to fetch competency matrix');
  const result = await response.json();
  return result.data || [];
}

async function fetchCourses(): Promise<TrainingCourse[]> {
  const response = await fetch('/api/hr/training/courses?isActive=true');
  if (!response.ok) throw new Error('Failed to fetch courses');
  const result = await response.json();
  return result.data || [];
}

async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const response = await fetch('/api/hr/org-units');
  if (!response.ok) throw new Error('Failed to fetch org units');
  const result = await response.json();
  return result.data || [];
}

interface MatrixRow {
  employeeId: number;
  employeeName: string;
  [courseKey: string]: string | number | boolean | null | undefined;
}

export default function CompetencyMatrixPage() {
  const t = useTranslations('hr');
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<number | null>(null);
  const [showMandatoryOnly, setShowMandatoryOnly] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 350;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const { data: matricesData = [], isLoading } = useQuery({
    queryKey: ['hr', 'training', 'competency-matrix'],
    queryFn: fetchCompetencyMatrix,
  });

  const { data: coursesData = [] } = useQuery({
    queryKey: ['hr', 'training', 'courses'],
    queryFn: fetchCourses,
  });

  const { data: orgUnitsData = [] } = useQuery({
    queryKey: ['hr', 'org-units'],
    queryFn: fetchOrgUnits,
  });

  // Ensure data is always an array
  const matrices = useMemo(() => Array.isArray(matricesData) ? matricesData : [], [matricesData]);
  const courses = useMemo(() => Array.isArray(coursesData) ? coursesData : [], [coursesData]);
  const orgUnits = useMemo(() => Array.isArray(orgUnitsData) ? orgUnitsData : [], [orgUnitsData]);

  // Transform matrix data for DataGrid
  const gridData = useMemo(() => {
    return matrices.map((matrix) => {
      const row: MatrixRow = {
        employeeId: matrix.employeeId,
        employeeName: matrix.employeeName,
      };

      matrix.courses.forEach((course) => {
        row['course_' + course.courseId] = course.status;
        row['course_' + course.courseId + '_required'] = course.isRequired;
        row['course_' + course.courseId + '_expiry'] = course.expiryDate;
      });

      return row;
    });
  }, [matrices]);

  // Filter courses for display
  const displayCourses = useMemo(() => {
    let filtered = courses;
    if (showMandatoryOnly) {
      filtered = filtered.filter((c) => c.isMandatory);
    }
    return filtered;
  }, [courses, showMandatoryOnly]);

  // Calculate stats
  const stats = useMemo(() => {
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;
    let notTaken = 0;

    matrices.forEach((matrix) => {
      matrix.courses.forEach((course) => {
        if (course.isRequired) {
          switch (course.status) {
            case 'valid':
              valid++;
              break;
            case 'expiring_soon':
              expiringSoon++;
              break;
            case 'expired':
              expired++;
              break;
            case 'not_taken':
              notTaken++;
              break;
          }
        }
      });
    });

    return { valid, expiringSoon, expired, notTaken };
  }, [matrices]);

  const renderStatusCell = (courseId: number) => {
    // eslint-disable-next-line react/display-name
    return (cellData: { data: MatrixRow }) => {
      const status = cellData.data['course_' + courseId] as TrainingRecordStatus | undefined;
      const isRequired = cellData.data['course_' + courseId + '_required'] as boolean | undefined;

      if (!status) return <span className="text-gray-300">-</span>;

      const config = STATUS_CONFIG[status];
      const Icon = config.icon;

      return (
        <div className={'flex items-center justify-center p-1 rounded ' + config.bgColor}>
          <Icon className={'h-4 w-4 ' + config.color} />
          {isRequired && (
            <span className="ml-1 text-xs text-red-500">*</span>
          )}
        </div>
      );
    };
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-full mx-auto" data-title={t('training.matrix.title')}>
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('training.matrix.title')}
        subtitle={t('training.matrix.description')}
        icon={Grid3X3}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'การอบรม', href: '/hr/training' },
          { label: 'Competency Matrix' },
        ]}
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="ผ่านการอบรม"
          value={stats.valid}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ใกล้หมดอายุ"
          value={stats.expiringSoon}
          icon={AlertTriangle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label="หมดอายุ"
          value={stats.expired}
          icon={XCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ยังไม่อบรม"
          value={stats.notTaken}
          icon={Clock}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-600 whitespace-nowrap">หน่วยงาน:</span>
            <SelectBox
              dataSource={[{ id: null, name: 'ทั้งหมด' }, ...orgUnits]}
              valueExpr="id"
              displayExpr="name"
              value={selectedOrgUnit}
              onValueChanged={(e) => setSelectedOrgUnit(e.value)}
              width="100%"
              placeholder="เลือกหน่วยงาน..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
            <input
              type="checkbox"
              checked={showMandatoryOnly}
              onChange={(e) => setShowMandatoryOnly(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-5 h-5"
            />
            <span className="text-sm text-gray-600">แสดงเฉพาะหลักสูตรบังคับ</span>
          </label>

          {/* Legend - Hide on mobile */}
          <div className="hidden md:flex items-center gap-4 ml-auto">
            <span className="text-sm text-gray-500">สถานะ:</span>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1">
                  <div className={'p-1 rounded ' + config.bgColor}>
                    <Icon className={'h-3 w-3 ' + config.color} />
                  </div>
                  <span className="text-xs text-gray-600">{config.label}</span>
                </div>
              );
            })}
            <span className="text-xs text-red-500">* = บังคับ</span>
          </div>
        </div>

        {/* Legend - Mobile only */}
        <div className="flex md:hidden flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-center gap-1">
                <div className={'p-1 rounded ' + config.bgColor}>
                  <Icon className={'h-3 w-3 ' + config.color} />
                </div>
                <span className="text-xs text-gray-600">{config.label}</span>
              </div>
            );
          })}
          <span className="text-xs text-red-500">* = บังคับ</span>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={gridData}
          keyExpr="employeeId"
          showBorders={false}
          showRowLines
          showColumnLines
          rowAlternationEnabled
          height={gridHeight}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
          columnAutoWidth={false}
        >
          <HeaderFilter visible />
          <Scrolling mode="virtual" columnRenderingMode="virtual" />
          <ColumnFixing enabled />
          <Paging enabled={false} />
          <Export enabled />

          <Column
            dataField="employeeName"
            caption="พนักงาน"
            width={200}
            fixed
            fixedPosition="left"
          />

          {displayCourses.map((course) => (
            <Column
              key={course.id}
              dataField={'course_' + course.id}
              caption={course.code}
              width={80}
              alignment="center"
              cellRender={renderStatusCell(course.id)}
              headerCellRender={() => (
                <div className="text-center">
                  <div className="font-medium text-xs">{course.code}</div>
                  {course.isMandatory && (
                    <Badge variant="danger" className="text-[10px] px-1 py-0">บังคับ</Badge>
                  )}
                </div>
              )}
            />
          ))}
        </DataGrid>
      </div>
    </div>
  );
}
