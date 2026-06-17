'use client';

// HR Training Module - Redesigned Dashboard
// Feature: 007-hr-personnel-management
// Redesigned with KPIs, DataGrid, Cards, and Analytics views

import React, { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  SearchPanel,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  StateStoring,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip as PieTooltip,
  Size,
} from 'devextreme-react/pie-chart';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import CheckBox from 'devextreme-react/check-box';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  Award,
  TrendingUp,
  List,
  Grid3X3,
  PieChartIcon,
  Filter,
  RefreshCw,
  Plus,
  Search,
  ArrowUpRight,
  MapPin,
  Timer,
  User,
  FileText,
} from 'lucide-react';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import type {
  TrainingCourse,
  TrainingSession,
  TrainingSessionStatus,
} from '@/types/hr';

// Extended types for display
interface TrainingSessionWithCourse extends TrainingSession {
  courseName?: string;
  courseCode?: string;
  instructorName?: string;
  participantCount?: number;
}

// Fetch training courses
async function fetchTrainingCourses(): Promise<TrainingCourse[]> {
  const res = await fetch('/api/hr/training/courses');
  const data = await res.json();
  return data.data || [];
}

// Fetch training sessions with course details
async function fetchTrainingSessions(): Promise<TrainingSessionWithCourse[]> {
  const [sessionsRes, coursesRes] = await Promise.all([
    fetch('/api/hr/training/sessions'),
    fetch('/api/hr/training/courses'),
  ]);

  const sessionsData = await sessionsRes.json();
  const coursesData = await coursesRes.json();

  const sessions: TrainingSession[] = sessionsData.data || [];
  const courses: TrainingCourse[] = coursesData.data || [];

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return sessions.map((session) => {
    const course = courseMap.get(session.courseId);
    return {
      ...session,
      courseName: course?.name || 'Unknown',
      courseCode: course?.code || '-',
    };
  });
}

type ViewMode = 'grid' | 'cards' | 'analytics';

// Session status badge component (uses useTranslations)
function SessionStatusBadge({ status }: { status: TrainingSessionStatus }) {
  const t = useTranslations('hr');
  const variantMap: Record<
    TrainingSessionStatus,
    'default' | 'secondary' | 'success' | 'destructive' | 'warning'
  > = {
    scheduled: 'secondary',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'destructive',
  };
  const labelMap: Record<TrainingSessionStatus, string> = {
    scheduled: t('training.sessionStatus.scheduled'),
    in_progress: t('training.sessionStatus.inProgress'),
    completed: t('training.sessionStatus.completed'),
    cancelled: t('training.sessionStatus.cancelled'),
  };
  return <Badge variant={variantMap[status] || 'default'}>{labelMap[status] || status}</Badge>;
}

// Course mandatory badge
function MandatoryBadge({ isMandatory }: { isMandatory: boolean }) {
  const t = useTranslations('hr');
  return (
    <Badge variant={isMandatory ? 'destructive' : 'secondary'}>
      {isMandatory ? t('training.mandatory') : t('training.optional')}
    </Badge>
  );
}

// Generate gradient color based on course code
function getGradientForCode(code: string): string {
  const hash = code.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const gradients = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-violet-500 to-violet-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
    'from-indigo-500 to-indigo-600',
    'from-teal-500 to-teal-600',
  ];

  return gradients[Math.abs(hash) % gradients.length];
}

// Format time for display
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  return timeStr.slice(0, 5); // Get HH:MM
}

export default function TrainingDashboardPage() {
  const t = useTranslations('hr');
  const locale = useLocale();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainingSessionStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [mandatoryFilter, setMandatoryFilter] = useState<boolean | null>(null);

  // Data queries
  const {
    data: courses = [],
    isLoading: coursesLoading,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ['hr', 'training', 'courses'],
    queryFn: fetchTrainingCourses,
    staleTime: 30000,
  });

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['hr', 'training', 'sessions'],
    queryFn: fetchTrainingSessions,
    staleTime: 30000,
  });

  const isLoading = coursesLoading || sessionsLoading;

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalCourses = courses.length;
    const activeCourses = courses.filter((c) => c.isActive).length;
    const mandatoryCourses = courses.filter((c) => c.isMandatory).length;

    const totalSessions = sessions.length;
    const scheduledSessions = sessions.filter((s) => s.status === 'scheduled').length;
    const inProgressSessions = sessions.filter((s) => s.status === 'in_progress').length;
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const cancelledSessions = sessions.filter((s) => s.status === 'cancelled').length;

    // Course categories
    const categoryMap = new Map<string, number>();
    courses.forEach((c) => {
      const cat = c.category || t('authorizations.unknown');
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    const categoryDistribution = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Session status distribution
    const sessionStatusDistribution = [
      { name: t('training.sessionStatus.scheduled'), count: scheduledSessions, color: '#6b7280' },
      { name: t('training.sessionStatus.inProgress'), count: inProgressSessions, color: '#f59e0b' },
      { name: t('training.sessionStatus.completed'), count: completedSessions, color: '#10b981' },
      { name: t('training.sessionStatus.cancelled'), count: cancelledSessions, color: '#ef4444' },
    ].filter((s) => s.count > 0);

    // This month's sessions
    const now = new Date();
    const thisMonthSessions = sessions.filter((s) => {
      const sessionDate = new Date(s.sessionDate);
      return (
        sessionDate.getMonth() === now.getMonth() &&
        sessionDate.getFullYear() === now.getFullYear()
      );
    }).length;

    // Upcoming sessions (next 7 days)
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const upcomingSessions = sessions.filter((s) => {
      const sessionDate = new Date(s.sessionDate);
      return (
        sessionDate >= now &&
        sessionDate <= sevenDaysLater &&
        (s.status === 'scheduled' || s.status === 'in_progress')
      );
    }).length;

    return {
      totalCourses,
      activeCourses,
      mandatoryCourses,
      totalSessions,
      scheduledSessions,
      inProgressSessions,
      completedSessions,
      cancelledSessions,
      categoryDistribution,
      sessionStatusDistribution,
      thisMonthSessions,
      upcomingSessions,
    };
  }, [courses, sessions, t]);

  // Filtered data
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch =
        !searchText ||
        session.courseName?.toLowerCase().includes(searchText.toLowerCase()) ||
        session.courseCode?.toLowerCase().includes(searchText.toLowerCase()) ||
        session.location?.toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus = !statusFilter || session.status === statusFilter;

      return matchesSearch && matchesStatus;
    }).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [sessions, searchText, statusFilter]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !searchText ||
        course.name.toLowerCase().includes(searchText.toLowerCase()) ||
        course.code.toLowerCase().includes(searchText.toLowerCase());

      const matchesCategory = !categoryFilter || course.category === categoryFilter;
      const matchesMandatory = mandatoryFilter === null || course.isMandatory === mandatoryFilter;

      return matchesSearch && matchesCategory && matchesMandatory;
    });
  }, [courses, searchText, categoryFilter, mandatoryFilter]);

  // Handle refresh
  const handleRefresh = () => {
    refetchCourses();
    refetchSessions();
  };

  // Handle row click for sessions
  const handleSessionRowClick = (e: { data: TrainingSessionWithCourse }) => {
    router.push(`/hr/training/sessions/${e.data.id}`);
  };

  // Handle card click for courses
  const handleCourseClick = (course: TrainingCourse) => {
    router.push(`/hr/training/courses/${course.id}`);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchText('');
    setStatusFilter(null);
    setCategoryFilter(null);
    setMandatoryFilter(null);
  };

  // Session status options
  const statusOptions = useMemo(
    () => [
      { value: 'scheduled', text: t('training.sessionStatus.scheduled') },
      { value: 'in_progress', text: t('training.sessionStatus.inProgress') },
      { value: 'completed', text: t('training.sessionStatus.completed') },
      { value: 'cancelled', text: t('training.sessionStatus.cancelled') },
    ],
    [t]
  );

  // Category options from courses
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    courses.forEach((c) => {
      if (c.category) categories.add(c.category);
    });
    return Array.from(categories).map((cat) => ({ value: cat, text: cat }));
  }, [courses]);

  return (
    <div className="p-4 md:p-6 space-y-6" data-title={t('training.title')}>
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('training.title')}
        subtitle={t('training.description')}
        icon={GraduationCap}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'การอบรม' }]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              onClick={handleRefresh}
              hint="รีเฟรชข้อมูล"
            />
            <DxButton
              icon="filter"
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? 'default' : 'normal'}
              hint="ตัวกรอง"
            />
          </div>
        }
      />

      {/* KPI Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="หลักสูตรทั้งหมด"
          value={analytics.totalCourses}
          icon={BookOpen}
          iconColor="text-blue-600"
          accentColor="border-blue-500"
          href="/hr/training/courses"
          isLoading={isLoading}
        />
        <StatCard
          label="หลักสูตรบังคับ"
          value={analytics.mandatoryCourses}
          icon={Award}
          iconColor="text-red-600"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="รอบอบรมทั้งหมด"
          value={analytics.totalSessions}
          icon={Calendar}
          iconColor="text-emerald-600"
          accentColor="border-emerald-500"
          href="/hr/training/sessions"
          isLoading={isLoading}
        />
        <StatCard
          label="กำลังดำเนินการ"
          value={analytics.scheduledSessions + analytics.inProgressSessions}
          icon={Clock}
          iconColor="text-amber-600"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label="เสร็จสิ้นแล้ว"
          value={analytics.completedSessions}
          icon={CheckCircle2}
          iconColor="text-green-600"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ใน 7 วันข้างหน้า"
          value={analytics.upcomingSessions}
          icon={TrendingUp}
          iconColor="text-violet-600"
          accentColor="border-violet-500"
          trend={
            analytics.upcomingSessions > 0
              ? { direction: 'up', value: `${analytics.upcomingSessions} รอบ` }
              : undefined
          }
          isLoading={isLoading}
        />
      </div>

      {/* Quick Access Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/hr/training/courses"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              จัดการหลักสูตร
            </h3>
            <p className="text-sm text-gray-500">
              {analytics.totalCourses} หลักสูตร ({analytics.activeCourses} ใช้งาน)
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </Link>

        <Link
          href="/hr/training/sessions"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-emerald-100 rounded-lg group-hover:scale-110 transition-transform">
            <Calendar className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
              จัดการรอบอบรม
            </h3>
            <p className="text-sm text-gray-500">
              {analytics.inProgressSessions} กำลังดำเนินการ, {analytics.scheduledSessions} รอ
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
        </Link>

        <Link
          href="/hr/training/matrix"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-violet-100 rounded-lg group-hover:scale-110 transition-transform">
            <LayoutGrid className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
              Competency Matrix
            </h3>
            <p className="text-sm text-gray-500">ตารางทักษะและความสามารถ</p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
        </Link>
      </div>

      {/* View Mode Switcher and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">มุมมอง:</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองตาราง (รอบอบรม)"
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 border-x border-gray-200 ${
                viewMode === 'cards'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองการ์ด (หลักสูตร)"
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`p-2 ${
                viewMode === 'analytics'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองวิเคราะห์"
            >
              <PieChartIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'grid' && (
            <DxButton
              text="เพิ่มรอบอบรม"
              icon="add"
              type="default"
              stylingMode="contained"
              onClick={() => router.push('/hr/training/sessions/new')}
            />
          )}
          {viewMode === 'cards' && (
            <DxButton
              text="เพิ่มหลักสูตร"
              icon="add"
              type="default"
              stylingMode="contained"
              onClick={() => router.push('/hr/training/courses/new')}
            />
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรองข้อมูล
            </h3>
            <button
              onClick={clearFilters}
              className="text-sm text-amber-600 hover:text-amber-700"
            >
              ล้างตัวกรอง
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">ค้นหา</label>
              <TextBox
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                placeholder="ชื่อหลักสูตร, รหัส..."
                showClearButton
                mode="search"
              />
            </div>

            {/* Status filter (for sessions view) */}
            {viewMode === 'grid' && (
              <div>
                <label className="block text-sm text-gray-500 mb-1">สถานะรอบอบรม</label>
                <SelectBox
                  dataSource={statusOptions}
                  value={statusFilter}
                  onValueChanged={(e) => setStatusFilter(e.value)}
                  displayExpr="text"
                  valueExpr="value"
                  placeholder="ทุกสถานะ"
                  showClearButton
                />
              </div>
            )}

            {/* Category filter (for cards view) */}
            {viewMode === 'cards' && (
              <div>
                <label className="block text-sm text-gray-500 mb-1">หมวดหมู่</label>
                <SelectBox
                  dataSource={categoryOptions}
                  value={categoryFilter}
                  onValueChanged={(e) => setCategoryFilter(e.value)}
                  displayExpr="text"
                  valueExpr="value"
                  placeholder="ทุกหมวดหมู่"
                  showClearButton
                />
              </div>
            )}

            {/* Mandatory filter (for cards view) */}
            {viewMode === 'cards' && (
              <div className="flex items-end gap-4">
                <CheckBox
                  text="แสดงเฉพาะหลักสูตรบังคับ"
                  value={mandatoryFilter === true}
                  onValueChanged={(e) =>
                    setMandatoryFilter(e.value ? true : null)
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid View - Training Sessions DataGrid */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <DataGrid
            dataSource={filteredSessions}
            showBorders={false}
            rowAlternationEnabled
            allowColumnReordering
            allowColumnResizing
            columnAutoWidth
            height="calc(100vh - 500px)"
            onRowClick={handleSessionRowClick}
            hoverStateEnabled
          >
            <SearchPanel visible placeholder="ค้นหารอบอบรม..." />
            <Grouping autoExpandAll={false} />
            <GroupPanel visible />
            <StateStoring
              enabled
              type="localStorage"
              storageKey="hr_training_sessions_grid_v2"
            />
            <Scrolling mode="virtual" />

            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              dataField="courseCode"
              caption="รหัสหลักสูตร"
              width={120}
              allowGrouping
            />
            <Column
              dataField="courseName"
              caption="ชื่อหลักสูตร"
              minWidth={200}
              allowGrouping
            />
            <Column
              dataField="sessionDate"
              caption="วันที่อบรม"
              width={130}
              dataType="date"
              format="dd/MM/yyyy"
              sortOrder="desc"
            />
            <Column
              dataField="startTime"
              caption="เวลาเริ่ม"
              width={90}
              cellRender={({ value }) => (
                <span>{formatTime(value)}</span>
              )}
            />
            <Column
              dataField="endTime"
              caption="เวลาสิ้นสุด"
              width={90}
              cellRender={({ value }) => (
                <span>{formatTime(value)}</span>
              )}
            />
            <Column
              dataField="location"
              caption="สถานที่"
              width={150}
              cellRender={({ value }) => (
                <span className="flex items-center gap-1">
                  {value && <MapPin className="h-3 w-3 text-gray-400" />}
                  {value || '-'}
                </span>
              )}
            />
            <Column
              dataField="maxParticipants"
              caption="จำนวนรับ"
              width={90}
              alignment="center"
              cellRender={({ value }) => (
                <span className="flex items-center justify-center gap-1">
                  <Users className="h-3 w-3 text-gray-400" />
                  {value || '-'}
                </span>
              )}
            />
            <Column
              dataField="status"
              caption="สถานะ"
              width={130}
              allowGrouping
              cellRender={({ value }) => (
                <SessionStatusBadge status={value} />
              )}
            />

            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </div>
      )}

      {/* Cards View - Training Courses */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>ไม่พบหลักสูตรที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            filteredCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => handleCourseClick(course)}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer group"
              >
                {/* Course Header */}
                <div
                  className={`h-2 bg-gradient-to-r ${getGradientForCode(course.code)}`}
                />

                <div className="p-4">
                  {/* Course Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getGradientForCode(
                        course.code
                      )} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                    >
                      {course.code.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <MandatoryBadge isMandatory={course.isMandatory} />
                      <Badge variant={course.isActive ? 'success' : 'secondary'}>
                        {course.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                    </div>
                  </div>

                  {/* Course Title */}
                  <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors line-clamp-2 mb-1">
                    {course.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{course.code}</p>

                  {/* Course Details */}
                  <div className="space-y-2 text-sm">
                    {course.category && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{course.category}</span>
                      </div>
                    )}
                    {course.durationHours && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Timer className="h-4 w-4 text-gray-400" />
                        <span>{course.durationHours} ชั่วโมง</span>
                      </div>
                    )}
                    {course.validityDays && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>อายุ {course.validityDays} วัน</span>
                      </div>
                    )}
                  </div>

                  {/* Description Preview */}
                  {course.description && (
                    <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Session Status Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                สถานะรอบอบรม
              </h3>
              {analytics.sessionStatusDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.sessionStatusDistribution}
                  type="doughnut"
                  palette="Material"
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    orientation="vertical"
                    horizontalAlignment="right"
                    verticalAlignment="top"
                    itemTextPosition="right"
                    customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                      const d = analytics.sessionStatusDistribution[info.pointIndex ?? -1];
                      return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                    }}
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} รอบ`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูลรอบอบรม
                </div>
              )}
            </div>

            {/* Course Category Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                หมวดหมู่หลักสูตร
              </h3>
              {analytics.categoryDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.categoryDistribution}
                  type="doughnut"
                  palette="Soft Pastel"
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    orientation="vertical"
                    horizontalAlignment="right"
                    verticalAlignment="top"
                    itemTextPosition="right"
                    customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                      const d = analytics.categoryDistribution[info.pointIndex ?? -1];
                      return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                    }}
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} หลักสูตร`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูลหมวดหมู่
                </div>
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sessions Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                สรุปรอบอบรม
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">รอดำเนินการ</span>
                  <span className="font-semibold text-gray-700">
                    {analytics.scheduledSessions}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">กำลังอบรม</span>
                  <span className="font-semibold text-amber-600">
                    {analytics.inProgressSessions}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">เสร็จสิ้น</span>
                  <span className="font-semibold text-green-600">
                    {analytics.completedSessions}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ยกเลิก</span>
                  <span className="font-semibold text-red-600">
                    {analytics.cancelledSessions}
                  </span>
                </div>
              </div>
            </div>

            {/* Courses Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                สรุปหลักสูตร
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ทั้งหมด</span>
                  <span className="font-semibold text-gray-700">
                    {analytics.totalCourses}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ใช้งาน</span>
                  <span className="font-semibold text-green-600">
                    {analytics.activeCourses}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">บังคับ</span>
                  <span className="font-semibold text-red-600">
                    {analytics.mandatoryCourses}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">หมวดหมู่</span>
                  <span className="font-semibold text-gray-700">
                    {analytics.categoryDistribution.length}
                  </span>
                </div>
              </div>
            </div>

            {/* This Month Activity */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                เดือนนี้
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">รอบอบรมทั้งหมด</span>
                  <span className="font-semibold text-gray-700">
                    {analytics.thisMonthSessions}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">7 วันข้างหน้า</span>
                  <span className="font-semibold text-violet-600">
                    {analytics.upcomingSessions}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-600" />
                ดำเนินการด่วน
              </h4>
              <div className="space-y-2">
                <DxButton
                  text="เพิ่มหลักสูตรใหม่"
                  icon="add"
                  type="default"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/hr/training/courses/new')}
                />
                <DxButton
                  text="เพิ่มรอบอบรม"
                  icon="event"
                  type="default"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/hr/training/sessions/new')}
                />
                <DxButton
                  text="ดู Competency Matrix"
                  icon="smalliconslayout"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/hr/training/matrix')}
                />
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-amber-600" />
              จำนวนหลักสูตรตามหมวดหมู่
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {analytics.categoryDistribution.map((cat, index) => (
                <div
                  key={index}
                  className="text-center p-4 bg-gray-50 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <div className="text-2xl font-bold text-amber-600">{cat.count}</div>
                  <div className="text-sm text-gray-600 truncate" title={cat.name}>
                    {cat.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
