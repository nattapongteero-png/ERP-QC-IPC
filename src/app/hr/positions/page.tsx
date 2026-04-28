'use client';

// HR Positions Management Page - Redesigned
// Feature: 007-hr-personnel-management
// Professional layout with KPI dashboard, multiple view modes, and analytics
// Updated Task 4: Template Pattern Alignment - Page-based navigation

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
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
  Export,
  ColumnChooser,
  StateStoring,
  Grouping,
  GroupPanel,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip,
  Size,
} from 'devextreme-react/pie-chart';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import SelectBox from 'devextreme-react/select-box';
import CheckBox from 'devextreme-react/check-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard, OrgUnitPicker } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  Briefcase,
  FileText,
  Check,
  X,
  Clock,
  Grid3X3,
  List,
  BarChart3,
  Shield,
  Building2,
  Users,
  CheckCircle,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import type { Position, OrgUnit, JobDescription } from '@/types/hr';

type ViewMode = 'grid' | 'cards' | 'analytics';
type StatusFilter = 'all' | 'active' | 'inactive';

interface PositionFormData {
  code: string;
  title: string;
  titleEn: string;
  orgUnitId: number | null;
  jobGrade: string;
  isGmpCritical: boolean;
}

interface FilterState {
  orgUnitId: number | null;
  status: StatusFilter;
  gmpOnly: boolean;
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
  draft: { translationKey: 'draft', variant: 'secondary' as const, icon: FileText },
  pending_approval: { translationKey: 'pendingApproval', variant: 'warning' as const, icon: Clock },
  approved: { translationKey: 'approved', variant: 'success' as const, icon: Check },
  obsolete: { translationKey: 'obsolete', variant: 'danger' as const, icon: X },
};

// Color palette for charts
const CHART_COLORS = {
  gmpCritical: '#dc2626',
  nonGmp: '#16a34a',
  active: '#22c55e',
  inactive: '#94a3b8',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  tertiary: '#f59e0b',
};

const DEPARTMENT_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

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
  const t = useTranslations('hr');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    orgUnitId: null,
    status: 'all',
    gmpOnly: false,
  });

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showJDPopup, setShowJDPopup] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [gridHeight, setGridHeight] = useState(500);
  const [formData, setFormData] = useState<PositionFormData>(emptyFormData);
  const [newJD, setNewJD] = useState({
    responsibilities: '',
    authorities: '',
    qualifications: '',
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

  const { data: positions = [], isLoading, refetch } = useQuery({
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

  // Create org unit lookup map for display
  const orgUnitMap = useMemo(() => {
    return new Map(orgUnits.map((ou) => [ou.id, ou]));
  }, [orgUnits]);

  // Filter positions
  const filteredPositions = useMemo(() => {
    return positions.filter((pos) => {
      if (filters.orgUnitId && pos.orgUnitId !== filters.orgUnitId) return false;
      if (filters.status === 'active' && !pos.isActive) return false;
      if (filters.status === 'inactive' && pos.isActive) return false;
      if (filters.gmpOnly && !pos.isGmpCritical) return false;
      return true;
    }).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [positions, filters]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const total = positions.length;
    const active = positions.filter((p) => p.isActive).length;
    const inactive = total - active;
    const gmpCritical = positions.filter((p) => p.isGmpCritical).length;
    const nonGmpCritical = total - gmpCritical;

    // Group by org unit
    const byOrgUnit = new Map<number, { name: string; count: number }>();
    positions.forEach((pos) => {
      if (pos.orgUnitId) {
        const orgUnit = orgUnitMap.get(pos.orgUnitId);
        if (orgUnit) {
          const existing = byOrgUnit.get(pos.orgUnitId) || { name: orgUnit.name, count: 0 };
          existing.count++;
          byOrgUnit.set(pos.orgUnitId, existing);
        }
      }
    });

    // Group by job grade
    const byGrade = new Map<string, number>();
    positions.forEach((pos) => {
      const grade = pos.jobGrade || t('authorizations.unknown');
      byGrade.set(grade, (byGrade.get(grade) || 0) + 1);
    });

    return {
      total,
      active,
      inactive,
      gmpCritical,
      nonGmpCritical,
      gmpDistribution: [
        { label: 'GMP Critical', value: gmpCritical, color: CHART_COLORS.gmpCritical },
        { label: 'Non-GMP', value: nonGmpCritical, color: CHART_COLORS.nonGmp },
      ],
      statusDistribution: [
        { label: t('positions.status.active'), value: active, color: CHART_COLORS.active },
        { label: t('positions.status.inactive'), value: inactive, color: CHART_COLORS.inactive },
      ],
      orgUnitDistribution: Array.from(byOrgUnit.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      gradeDistribution: Array.from(byGrade.entries())
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => b.count - a.count),
    };
  }, [positions, orgUnitMap, t]);

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      setShowCreatePopup(false);
      setFormData(emptyFormData);
      toast.success(t('positions.toast.createSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('positions.toast.createError'));
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
      toast.success(t('positions.toast.updateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('positions.toast.updateError'));
    },
  });

  const createJDMutation = useMutation({
    mutationFn: ({ positionId, data }: { positionId: number; data: Partial<JobDescription> }) =>
      createJobDescription(positionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'job-descriptions', selectedPosition?.id] });
      setShowJDPopup(false);
      setNewJD({ responsibilities: '', authorities: '', qualifications: '' });
      toast.success(t('positions.toast.jdCreateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('positions.toast.jdCreateError'));
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
    // Navigate to position detail page (page-based navigation pattern)
    router.push(`/hr/positions/${e.data.id}`);
  }, [router]);

  const handleRowDblClick = useCallback((e: { data: Position }) => {
    // Navigate to position detail page on double-click (same as single click)
    router.push(`/hr/positions/${e.data.id}`);
  }, [router]);

  const handleCreateJD = useCallback(() => {
    if (!selectedPosition) return;
    createJDMutation.mutate({
      positionId: selectedPosition.id,
      data: newJD,
    });
  }, [selectedPosition, newJD, createJDMutation]);

  // Cell renderers with icons
  const renderGmpCriticalCell = (cellData: { value: boolean }) => {
    return cellData.value ? (
      <div className="flex items-center gap-1">
        <Shield className="h-4 w-4 text-red-500" />
        <Badge variant="danger" className="text-xs">GMP</Badge>
      </div>
    ) : (
      <span className="text-gray-400">-</span>
    );
  };

  const renderActiveCell = (cellData: { value: boolean }) => {
    return (
      <div className="flex items-center gap-1">
        {cellData.value ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="success" className="text-xs">{t('positions.status.active')}</Badge>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
            <Badge variant="secondary" className="text-xs">{t('positions.status.inactive')}</Badge>
          </>
        )}
      </div>
    );
  };

  const renderOrgUnitCell = (cellData: { value: number }) => {
    const orgUnit = orgUnitMap.get(cellData.value);
    if (!orgUnit) return <span className="text-gray-400">-</span>;
    return (
      <div className="flex items-center gap-1">
        <Building2 className="h-4 w-4 text-blue-500" />
        <span>{orgUnit.name}</span>
      </div>
    );
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate gradient for position card avatar
  const getPositionGradient = (code: string) => {
    const gradients = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-amber-500',
      'from-red-500 to-rose-500',
      'from-indigo-500 to-violet-500',
      'from-teal-500 to-green-500',
      'from-pink-500 to-rose-500',
    ];
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Form content for popup
  const renderFormContent = () => (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('positions.form.code')} <span className="text-red-500">*</span>
          </label>
          <TextBox
            value={formData.code}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, code: e.value || '' }))}
            placeholder={t('positions.form.codePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('positions.form.grade')}
          </label>
          <TextBox
            value={formData.jobGrade}
            onValueChanged={(e) => setFormData((prev) => ({ ...prev, jobGrade: e.value || '' }))}
            placeholder={t('positions.form.gradePlaceholder')}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('positions.form.titleTh')} <span className="text-red-500">*</span>
        </label>
        <TextBox
          value={formData.title}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, title: e.value || '' }))}
          placeholder={t('positions.form.titleThPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('positions.form.titleEn')}
        </label>
        <TextBox
          value={formData.titleEn}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, titleEn: e.value || '' }))}
          placeholder={t('positions.form.titleEnPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('positions.form.orgUnit')}
        </label>
        <SelectBox
          dataSource={orgUnits}
          valueExpr="id"
          displayExpr="name"
          value={formData.orgUnitId}
          onValueChanged={(e) => setFormData((prev) => ({ ...prev, orgUnitId: e.value }))}
          placeholder={t('positions.form.orgUnitPlaceholder')}
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
          {t('positions.form.isGmpCritical')}
        </label>
      </div>
    </div>
  );

  // Render position card for cards view
  const renderPositionCard = (position: Position) => {
    const orgUnit = orgUnitMap.get(position.orgUnitId);
    return (
      <div
        key={position.id}
        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer"
        onClick={() => router.push(`/hr/positions/${position.id}`)}
      >
        <div className="flex items-start gap-3">
          {/* Position Avatar */}
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPositionGradient(position.code)} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
            {position.code.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 truncate">{position.title}</h3>
                <p className="text-sm text-gray-500">{position.code}</p>
              </div>
              <Badge variant={position.isActive ? 'success' : 'secondary'} className="text-xs flex-shrink-0">
                {position.isActive ? t('positions.status.active') : t('positions.status.inactive')}
              </Badge>
            </div>

            {position.titleEn && (
              <p className="text-xs text-gray-400 mt-1 truncate">{position.titleEn}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {position.isGmpCritical && (
                <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  <Shield className="h-3 w-3" />
                  GMP Critical
                </div>
              )}
              {orgUnit && (
                <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Building2 className="h-3 w-3" />
                  {orgUnit.name}
                </div>
              )}
              {position.jobGrade && (
                <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  <Users className="h-3 w-3" />
                  {position.jobGrade}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="hr-positions-page">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('positions.title')}
        subtitle={t('positions.description')}
        icon={Briefcase}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('positions.breadcrumb') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text={t('positions.refresh')}
              icon="refresh"
              stylingMode="text"
              onClick={() => refetch()}
            />
            <DxButton
              text={t('positions.addPosition')}
              icon="add"
              type="default"
              onClick={() => router.push('/hr/positions/new')}
              elementAttr={{ 'data-testid': 'hr-add-position-btn' }}
            />
          </div>
        }
      />

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="hr-positions-stats">
        <StatCard
          label={t('positions.stats.total')}
          value={analytics.total}
          icon={Briefcase}
          iconColor="text-blue-600"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('positions.stats.active')}
          value={analytics.active}
          icon={CheckCircle}
          iconColor="text-green-600"
          accentColor="border-green-500"
          trend={analytics.total > 0 ? { direction: 'up', value: `${Math.round((analytics.active / analytics.total) * 100)}%` } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('positions.stats.gmpCritical')}
          value={analytics.gmpCritical}
          icon={Shield}
          iconColor="text-red-600"
          accentColor="border-red-500"
          trend={analytics.total > 0 ? { direction: 'neutral', value: `${Math.round((analytics.gmpCritical / analytics.total) * 100)}%` } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('positions.stats.orgUnits')}
          value={analytics.orgUnitDistribution.length}
          icon={Building2}
          iconColor="text-purple-600"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* View Mode Toggle & Filter */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        {/* View Mode Buttons */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            title={t('common.viewGrid')}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.gridView')}</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            title={t('common.viewCards')}
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.cardsView')}</span>
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'analytics' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            title={t('common.viewAnalytics')}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.analyticsView')}</span>
          </button>
        </div>

        {/* Filter Button */}
        <DxButton
          text={showFilters ? t('common.hideFilters') : t('common.showFilters')}
          icon="filter"
          stylingMode="outlined"
          onClick={() => setShowFilters(!showFilters)}
        />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">{t('positions.filters.title')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('positions.filters.orgUnit')}</label>
              <OrgUnitPicker
                value={filters.orgUnitId}
                onValueChange={(val) => setFilters((prev) => ({ ...prev, orgUnitId: val }))}
                label=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('positions.filters.status')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('positions.filters.all')}</option>
                <option value="active">{t('positions.status.active')}</option>
                <option value="inactive">{t('positions.status.inactive')}</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <CheckBox
                value={filters.gmpOnly}
                onValueChanged={(e) => setFilters((prev) => ({ ...prev, gmpOnly: e.value || false }))}
              />
              <label className="text-sm text-gray-700">{t('positions.filters.gmpOnly')}</label>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="hr-positions-grid">
            <DataGrid
              key={locale}
              dataSource={filteredPositions}
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
              <SearchPanel visible placeholder={t('common.search')} width={200} />
              <HeaderFilter visible />
              <FilterRow visible />
              <Scrolling mode="virtual" />
              <Paging defaultPageSize={20} />
              <Pager
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50, 100]}
                showInfo
                showNavigationButtons
              />
              <Selection mode="single" />
              <Grouping contextMenuEnabled />
              <GroupPanel visible />
              <ColumnChooser enabled />
              <StateStoring enabled type="localStorage" storageKey="hr-positions-grid-v2" />
              <Export enabled />

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="searchPanel" />
                <Item name="columnChooserButton" />
                <Item name="exportButton" />
              </Toolbar>

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
              <Column dataField="code" caption={t('positions.columns.code')} width={100} hidingPriority={1} />
              <Column dataField="title" caption={t('positions.columns.title')} minWidth={150} hidingPriority={0} />
              <Column dataField="titleEn" caption={t('positions.columns.titleEn')} width={150} hidingPriority={4} />
              <Column
                dataField="orgUnitId"
                caption={t('positions.columns.orgUnit')}
                width={150}
                hidingPriority={3}
                cellRender={renderOrgUnitCell}
              >
                <Lookup
                  dataSource={orgUnits}
                  valueExpr="id"
                  displayExpr="name"
                />
              </Column>
              <Column dataField="jobGrade" caption={t('positions.columns.grade')} width={100} hidingPriority={5} />
              <Column
                dataField="isGmpCritical"
                caption={t('positions.columns.gmp')}
                width={100}
                cellRender={renderGmpCriticalCell}
                alignment="center"
                hidingPriority={2}
              />
              <Column
                dataField="isActive"
                caption={t('positions.columns.status')}
                width={120}
                cellRender={renderActiveCell}
                alignment="center"
                hidingPriority={6}
              />
            </DataGrid>
          </div>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && (
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPositions.map(renderPositionCard)}
            </div>
            {filteredPositions.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500">{t('positions.noPositions')}</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GMP Distribution Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  {t('positions.analytics.gmpTitle')}
                </h3>
                <PieChart
                  key={locale}
                  id="gmp-distribution"
                  dataSource={analytics.gmpDistribution}
                  type="doughnut"
                  palette={[CHART_COLORS.gmpCritical, CHART_COLORS.nonGmp]}
                >
                  <Size height={250} />
                  <Series argumentField="label" valueField="value">
                    <Label visible format="fixedPoint" customizeText={(point: { percentText: string }) => point.percentText}>
                      <Connector visible />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip enabled customizeTooltip={(point: any) => ({
                    text: `${point.argumentText}: ${point.valueText} ${t('positions.analytics.positionSuffix')}`,
                  })} />
                </PieChart>
              </div>

              {/* Status Distribution Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  {t('positions.analytics.statusTitle')}
                </h3>
                <PieChart
                  key={locale}
                  id="status-distribution"
                  dataSource={analytics.statusDistribution}
                  type="doughnut"
                  palette={[CHART_COLORS.active, CHART_COLORS.inactive]}
                >
                  <Size height={250} />
                  <Series argumentField="label" valueField="value">
                    <Label visible format="fixedPoint" customizeText={(point: { percentText: string }) => point.percentText}>
                      <Connector visible />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip enabled customizeTooltip={(point: any) => ({
                    text: `${point.argumentText}: ${point.valueText} ${t('positions.analytics.positionSuffix')}`,
                  })} />
                </PieChart>
              </div>
            </div>

            {/* Org Unit Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                {t('positions.analytics.byOrgUnit')}
              </h3>
              <div className="space-y-3">
                {analytics.orgUnitDistribution.map((dept, idx) => (
                  <div key={dept.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length] }}
                    />
                    <span className="flex-1 text-sm text-gray-700 truncate">{dept.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(dept.count / analytics.total) * 100}%`,
                            backgroundColor: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">{dept.count}</span>
                    </div>
                  </div>
                ))}
                {analytics.orgUnitDistribution.length === 0 && (
                  <p className="text-gray-500 text-center py-4">{t('positions.analytics.noOrgUnitData')}</p>
                )}
              </div>
            </div>

            {/* Grade Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                {t('positions.analytics.byGrade')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {analytics.gradeDistribution.map((item) => (
                  <div key={item.grade} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                    <p className="text-sm text-gray-500 truncate">{item.grade}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Position Details Panel */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!showDetailPanel && selectedPosition ? 'hidden lg:block' : ''}`}>
          {selectedPosition ? (
            <div className="h-full flex flex-col">
              {/* Position Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPositionGradient(selectedPosition.code)} flex items-center justify-center text-white font-bold text-lg`}>
                      {selectedPosition.code.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedPosition.title}</h3>
                      <p className="text-sm text-gray-500">{selectedPosition.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DxButton
                      icon="edit"
                      hint={t('positions.editHint')}
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
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {selectedPosition.isGmpCritical && (
                    <Badge variant="danger" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      GMP Critical
                    </Badge>
                  )}
                  {selectedPosition.jobGrade && (
                    <Badge variant="info" className="text-xs">{selectedPosition.jobGrade}</Badge>
                  )}
                  <Badge variant={selectedPosition.isActive ? 'success' : 'secondary'} className="text-xs">
                    {selectedPosition.isActive ? t('positions.status.active') : t('positions.status.inactive')}
                  </Badge>
                </div>
              </div>

              {/* Position Info */}
              <div className="p-4 border-b border-gray-200 space-y-3">
                {selectedPosition.titleEn && (
                  <div>
                    <p className="text-xs text-gray-500">{t('positions.details.titleEn')}</p>
                    <p className="text-sm text-gray-900">{selectedPosition.titleEn}</p>
                  </div>
                )}
                {selectedPosition.orgUnitId && (
                  <div>
                    <p className="text-xs text-gray-500">{t('positions.details.orgUnit')}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      {orgUnitMap.get(selectedPosition.orgUnitId)?.name || '-'}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Descriptions */}
              <div className="flex-1 overflow-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('positions.jd.title')}
                  </h4>
                  <DxButton
                    icon="add"
                    text={t('positions.jd.add')}
                    type="default"
                    stylingMode="text"
                    onClick={() => setShowJDPopup(true)}
                  />
                </div>

                {jobDescriptions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    {t('positions.jd.empty')}
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
                              {t('positions.jd.version')}{jd.version}
                            </span>
                            <Badge variant={statusConfig.variant} className="text-xs">
                              {t(`positions.jdStatus.${statusConfig.translationKey}`)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            {jd.effectiveFrom && (
                              <p>{t('positions.jd.effective')}: {formatDate(jd.effectiveFrom)}</p>
                            )}
                            {jd.approvedAt && (
                              <p>{t('positions.jd.approved')}: {formatDate(jd.approvedAt)}</p>
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
              <div className="text-center">
                <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">
                  {t('positions.detailsEmpty')}
                </p>
              </div>
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
        title={t('positions.popups.createTitle')}
        width={600}
        height="auto"
        showCloseButton
      >
        {renderFormContent()}

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: t('common.cancel'),
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
            text: t('common.create'),
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
        title={t('positions.popups.editTitle', { 0: selectedPosition?.code || '' })}
        width={600}
        height="auto"
        showCloseButton
      >
        {renderFormContent()}

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: t('common.cancel'),
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
            text: t('common.save'),
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
        title={t('positions.popups.createJdTitle', { 0: selectedPosition?.title || '' })}
        width={600}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('positions.jd.responsibilities')}
            </label>
            <TextArea
              value={newJD.responsibilities}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, responsibilities: e.value || '' }))}
              height={100}
              placeholder={t('positions.jd.responsibilitiesPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('positions.jd.authorities')}
            </label>
            <TextArea
              value={newJD.authorities}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, authorities: e.value || '' }))}
              height={100}
              placeholder={t('positions.jd.authoritiesPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('positions.jd.qualifications')}
            </label>
            <TextArea
              value={newJD.qualifications}
              onValueChanged={(e) => setNewJD((prev) => ({ ...prev, qualifications: e.value || '' }))}
              height={100}
              placeholder={t('positions.jd.qualificationsPlaceholder')}
            />
          </div>
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: t('common.cancel'),
            onClick: () => setShowJDPopup(false),
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: t('common.save'),
            type: 'default',
            disabled: createJDMutation.isPending,
            onClick: handleCreateJD,
          }}
        />
      </Popup>
    </div>
  );
}
