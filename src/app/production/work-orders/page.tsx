'use client';

/**
 * Work Orders Dashboard Page
 *
 * Professional dashboard for viewing and managing production work orders.
 * Redesigned with DevExtreme UI components following GMP module patterns.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { formatNumber } from '@/lib/utils/number-format';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMobile } from '@/hooks/use-mobile';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
} from 'devextreme-react/data-grid';
import {
  PieChart,
  Series,
  Label,
  Legend,
  Tooltip,
  Connector,
} from 'devextreme-react/pie-chart';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import notify from 'devextreme/ui/notify';
import DateBox from 'devextreme-react/date-box';
import NumberBox from 'devextreme-react/number-box';
import SelectBox from 'devextreme-react/select-box';
import TextArea from 'devextreme-react/text-area';
import TextBox from 'devextreme-react/text-box';
import { DxButton } from '@/components/ui/dx-button';
import { cn } from '@/lib/utils/cn';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  Factory,
  ClipboardList,
  PlayCircle,
  CheckCircle,
  XCircle,
  Rocket,
  TrendingUp,
  Calendar,
  Percent,
  AlertTriangle,
  Eye,
  Pencil,
  Trash2,
  Target,
  Activity,
  Users,
} from 'lucide-react';

// ============================================
// Assigned Team — types and constants
// ============================================

const ROLE_OPTIONS = [
  { value: 'operator', label: 'Operator (ผู้ปฏิบัติงาน)' },
  { value: 'supervisor', label: 'Supervisor (หัวหน้าคุม)' },
  { value: 'qa_verifier', label: 'QA Verifier' },
  { value: 'ipc_checker', label: 'IPC Checker' },
  { value: 'pharmacist', label: 'Pharmacist' },
];

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  positionId: number | null;
  positionTitle: string | null;
}

interface EditAssignee {
  id?: number; // existing row id (undefined if newly added in this session)
  employeeId: number | null;
  role: string;
  positionId: number | null;
  notes: string;
}

// ============================================
// Types
// ============================================

interface WorkOrder {
  id: number;
  woNumber: string;
  batchNumber: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  status: 'draft' | 'planned' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  deliveryDate: string;
  yieldPercentage: number;
  productId: number;
  productCode: string;
  productName: string;
  bomId: number | null;
  bomCode: string | null;
  bomName: string | null;
  bomVersion: string | null;
  createdAt: string;
  notes: string | null;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  draft: {
    translationKey: 'draft',
    color: '#6b7280',
    bgClass: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: ClipboardList,
  },
  planned: {
    translationKey: 'planned',
    color: '#3b82f6',
    bgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: ClipboardList,
  },
  released: {
    translationKey: 'released',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: Rocket,
  },
  in_progress: {
    translationKey: 'inProgress',
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: PlayCircle,
  },
  completed: {
    translationKey: 'completed',
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  cancelled: {
    translationKey: 'cancelled',
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
} as const;

const EDITABLE_STATUSES = ['draft', 'planned'];

const PRIORITY_CONFIG = {
  high: {
    translationKey: 'high',
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    range: [1, 3],
  },
  medium: {
    translationKey: 'normal',
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    range: [4, 6],
  },
  low: {
    translationKey: 'low',
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    range: [7, 10],
  },
} as const;

// ============================================
// API Functions
// ============================================

async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const response = await fetch('/api/production/work-orders?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch work orders');
  }
  return result.data?.items || [];
}

// ============================================
// Helper Functions
// ============================================

function getPriorityLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority <= 3) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================
// Component
// ============================================

export default function WorkOrdersPage() {
  const router = useRouter();
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const { isMobile } = useMobile();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [editForm, setEditForm] = useState({
    batchNumber: '',
    plannedQuantity: 0,
    priority: 5,
    plannedStartDate: null as Date | null,
    plannedEndDate: null as Date | null,
    deliveryDate: null as Date | null,
    notes: '',
  });

  // Assigned Team state — lives at page level so dialog can show + edit
  const [editAssignees, setEditAssignees] = useState<EditAssignee[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Fetch employees once on mount — used by both new and edit flows
  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/hr/employees?limit=500&isActive=true');
        const data = await res.json();
        if (data.success) {
          const raw = data.data?.items || data.data || [];
          setEmployees(
            raw.map((e: { id: number; employeeCode: string; firstName: string; lastName: string; positionId?: number | null; positionTitle?: string | null }) => ({
              id: e.id,
              employeeCode: e.employeeCode,
              firstName: e.firstName,
              lastName: e.lastName,
              positionId: e.positionId ?? null,
              positionTitle: e.positionTitle ?? null,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  const addEditAssignee = () => {
    setEditAssignees((prev) => [...prev, { employeeId: null, role: 'operator', positionId: null, notes: '' }]);
  };
  const removeEditAssignee = (index: number) => {
    setEditAssignees((prev) => prev.filter((_, i) => i !== index));
  };
  const updateEditAssignee = (index: number, patch: Partial<EditAssignee>) => {
    setEditAssignees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };
  const handleEditEmployeeChange = (index: number, employeeId: number | null) => {
    const emp = employees.find((e) => e.id === employeeId);
    updateEditAssignee(index, { employeeId, positionId: emp?.positionId ?? null });
  };

  // Fetch work orders
  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['work-orders'],
    queryFn: fetchWorkOrders,
  });

  // Auto-refresh list when any work order's execution data changes
  // (cleaning, weighing, IPC, status, etc.) — keeps the dashboard live
  // for everyone watching, not just the user who made the change.
  useRealtimeTopic('work-order-changed', () => {
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  });
  useRealtimeTopic('requisition-changed', () => {
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/production/work-orders/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.body),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed to update');
      return result;
    },
    onSuccess: () => {
      notify(t('workOrders.actions.editSuccess'), 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setEditDialogVisible(false);
      setSelectedWO(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/work-orders/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed to delete');
      return result;
    },
    onSuccess: () => {
      notify(t('workOrders.actions.deleteSuccess'), 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setDeleteDialogVisible(false);
      setSelectedWO(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Handler functions
  const handleEditClick = useCallback((e: React.MouseEvent, wo: WorkOrder) => {
    e.stopPropagation();
    setSelectedWO(wo);
    setEditForm({
      batchNumber: wo.batchNumber || '',
      plannedQuantity: wo.plannedQuantity,
      priority: wo.priority,
      plannedStartDate: wo.plannedStartDate ? new Date(wo.plannedStartDate) : null,
      plannedEndDate: wo.plannedEndDate ? new Date(wo.plannedEndDate) : null,
      deliveryDate: wo.deliveryDate ? new Date(wo.deliveryDate) : null,
      notes: wo.notes || '',
    });
    // Reset then fetch existing assignees for this WO
    setEditAssignees([]);
    fetch(`/api/production/work-orders/${wo.id}/assignees`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          setEditAssignees(
            result.data.map((a: { id: number; employeeId: number; positionId: number | null; role: string; notes: string | null }) => ({
              id: a.id,
              employeeId: a.employeeId,
              role: a.role,
              positionId: a.positionId,
              notes: a.notes || '',
            }))
          );
        }
      })
      .catch((err) => console.error('Failed to load assignees:', err));
    setEditDialogVisible(true);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent, wo: WorkOrder) => {
    e.stopPropagation();
    setSelectedWO(wo);
    setDeleteDialogVisible(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedWO) return;

    // Persist assignees first (separate endpoint, replace-all semantics).
    // If this fails we still let the WO update proceed — assignees can be retried.
    try {
      const validAssignees = editAssignees
        .filter((a) => a.employeeId && a.role)
        .map((a) => ({
          employeeId: a.employeeId,
          role: a.role,
          positionId: a.positionId,
          notes: a.notes || undefined,
        }));
      await fetch(`/api/production/work-orders/${selectedWO.id}/assignees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: validAssignees }),
      });
    } catch (err) {
      console.error('Failed to save assignees:', err);
    }

    updateMutation.mutate({
      id: selectedWO.id,
      body: {
        batchNumber: editForm.batchNumber,
        plannedQuantity: editForm.plannedQuantity,
        priority: editForm.priority,
        plannedStartDate: editForm.plannedStartDate ? toLocalDateStr(editForm.plannedStartDate) : null,
        plannedEndDate: editForm.plannedEndDate ? toLocalDateStr(editForm.plannedEndDate) : null,
        deliveryDate: editForm.deliveryDate ? toLocalDateStr(editForm.deliveryDate) : null,
        notes: editForm.notes || null,
      },
    });
  }, [selectedWO, editForm, editAssignees, updateMutation]);

  const handleConfirmDelete = useCallback(() => {
    if (!selectedWO) return;
    deleteMutation.mutate(selectedWO.id);
  }, [selectedWO, deleteMutation]);

  // Calculate statistics
  const stats = useMemo(() => {
    const planned = workOrders.filter(wo => wo.status === 'planned').length;
    const released = workOrders.filter(wo => wo.status === 'released').length;
    const inProgress = workOrders.filter(wo => wo.status === 'in_progress').length;
    const completed = workOrders.filter(wo => wo.status === 'completed').length;
    const cancelled = workOrders.filter(wo => wo.status === 'cancelled').length;
    const total = workOrders.length;
    const active = planned + released + inProgress;

    // Priority breakdown
    const highPriority = workOrders.filter(wo => wo.priority <= 3 && wo.status !== 'completed' && wo.status !== 'cancelled').length;
    const mediumPriority = workOrders.filter(wo => wo.priority > 3 && wo.priority <= 6 && wo.status !== 'completed' && wo.status !== 'cancelled').length;

    // Today's work orders
    const today = toLocalDateStr(new Date());
    const todayPlanned = workOrders.filter(wo => wo.plannedStartDate?.startsWith(today)).length;

    // Completion rate
    const closedOrders = completed + cancelled;
    const completionRate = closedOrders > 0 ? (completed / closedOrders) * 100 : 0;

    // Average yield
    const completedWithYield = workOrders.filter(wo => wo.status === 'completed' && Number(wo.yieldPercentage) > 0);
    const avgYield = completedWithYield.length > 0
      ? completedWithYield.reduce((sum, wo) => sum + Number(wo.yieldPercentage), 0) / completedWithYield.length
      : 0;

    return {
      total,
      planned,
      released,
      inProgress,
      completed,
      cancelled,
      active,
      highPriority,
      mediumPriority,
      todayPlanned,
      completionRate,
      avgYield,
    };
  }, [workOrders]);

  // Filtered work orders. Newest WO surfaces first (sort by createdAt
  // descending; fall back to id desc) so the row labelled #1 at the top
  // is always the most recently created order. Row numbers are assigned
  // after sorting/filtering so they always run 1, 2, 3… top-down.
  const filteredWorkOrders = useMemo(() => {
    const base = !statusFilter ? workOrders : workOrders.filter(wo => wo.status === statusFilter);
    const sorted = [...base].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.id || 0) - (a.id || 0);
    });
    return sorted.map((wo, index) => ({ ...wo, _rowNumber: index + 1 }));
  }, [workOrders, statusFilter]);

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { status: 'Planned', count: stats.planned, color: STATUS_CONFIG.planned.color },
      { status: 'Released', count: stats.released, color: STATUS_CONFIG.released.color },
      { status: 'In Progress', count: stats.inProgress, color: STATUS_CONFIG.in_progress.color },
      { status: 'Completed', count: stats.completed, color: STATUS_CONFIG.completed.color },
      { status: 'Cancelled', count: stats.cancelled, color: STATUS_CONFIG.cancelled.color },
    ].filter(d => d.count > 0);
  }, [stats]);

  // Active = WO ที่ยังทำงานอยู่ (ไม่นับ completed / cancelled). Priority
  // ค่าน้อย = สำคัญสูง (1-3 = High, 4-6 = Medium, 7+ = Low) ตาม
  // getPriorityLevel() ที่ใช้ในส่วนอื่นของหน้านี้.
  const priorityChartData = useMemo(() => {
    const activeOrders = workOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled');
    return [
      { priority: 'High (1-3)', count: activeOrders.filter(wo => wo.priority <= 3).length, color: '#ef4444' },
      { priority: 'Medium (4-6)', count: activeOrders.filter(wo => wo.priority > 3 && wo.priority <= 6).length, color: '#f59e0b' },
      { priority: 'Low (7+)', count: activeOrders.filter(wo => wo.priority > 6).length, color: '#10b981' },
    ];
  }, [workOrders]);

  const priorityChartTotal = useMemo(
    () => priorityChartData.reduce((sum, d) => sum + d.count, 0),
    [priorityChartData],
  );

  // Status tabs
  // Status filter tabs. Each tab (except "All") carries the colour of its
  // matching status badge so the filter row stays visually in sync with the
  // status column below — selected tab = solid status colour, count pill =
  // the status' soft tint. "All" uses the emerald theme primary.
  const statusTabs = useMemo(() => [
    { status: undefined as string | undefined, text: t('workOrders.tabs.all'), icon: ClipboardList, activeBg: 'bg-emerald-600', softPill: 'bg-emerald-100 text-emerald-800' },
    { status: 'planned', text: t('workOrders.status.planned'), icon: ClipboardList, activeBg: 'bg-blue-600', softPill: 'bg-blue-100 text-blue-800' },
    { status: 'released', text: t('workOrders.status.released'), icon: Rocket, activeBg: 'bg-violet-600', softPill: 'bg-violet-100 text-violet-800' },
    { status: 'in_progress', text: t('workOrders.status.inProgress'), icon: PlayCircle, activeBg: 'bg-amber-500', softPill: 'bg-amber-100 text-amber-800' },
    { status: 'completed', text: t('workOrders.status.completed'), icon: CheckCircle, activeBg: 'bg-emerald-600', softPill: 'bg-emerald-100 text-emerald-800' },
    { status: 'cancelled', text: t('workOrders.status.cancelled'), icon: XCircle, activeBg: 'bg-red-600', softPill: 'bg-red-100 text-red-800' },
  ], [t]);

  // Count of WOs per tab status (undefined = all) for the count pill.
  const tabCount = useCallback((status: string | undefined) =>
    status === undefined ? workOrders.length : workOrders.filter((w) => w.status === status).length,
    [workOrders]);

  // Cell renderers
  const renderWOCell = useCallback((data: { data: WorkOrder }) => (
    <div className="min-w-0">
      <p className="font-mono font-semibold text-emerald-600">{data.data.woNumber || '-'}</p>
      <p className="text-xs text-gray-500 font-mono">{data.data.batchNumber || '-'}</p>
    </div>
  ), []);

  const renderProductCell = useCallback((data: { data: WorkOrder }) => (
    <div className="min-w-0">
      <p className="font-medium text-gray-900 truncate">{data.data.productName || '-'}</p>
      <p className="text-xs text-gray-500 font-mono">{data.data.productCode || '-'}</p>
    </div>
  ), []);

  const renderBomCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    if (!wo.bomCode) return <span className="text-gray-400 text-xs">-</span>;
    return (
      <div className="dx-cell-wrap">
        <p className="font-mono font-semibold text-emerald-700 text-sm break-words">{wo.bomCode}</p>
        {wo.bomVersion && (
          <p className="text-xs text-gray-500">v{wo.bomVersion}</p>
        )}
      </div>
    );
  }, []);

  const renderQuantityCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    const progress = wo.plannedQuantity > 0 ? ((wo.actualQuantity || 0) / wo.plannedQuantity) * 100 : 0;
    return (
      <div className="min-w-0">
        <p className="font-medium">
          {formatNumber(wo.actualQuantity) || '0'} / {formatNumber(wo.plannedQuantity) || '-'} {wo.unit}
        </p>
        {wo.status === 'in_progress' && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }, []);

  const renderPriorityCell = useCallback((data: { data: WorkOrder }) => {
    const level = getPriorityLevel(data.data.priority);
    const config = PRIORITY_CONFIG[level];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
        {t(`workOrders.priority.${config.translationKey}`)}
      </span>
    );
  }, [t]);

  const renderDateCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    const startDate = wo.actualStartDate || wo.plannedStartDate;
    const endDate = wo.actualEndDate || wo.plannedEndDate;
    return (
      <div className="min-w-0 text-sm">
        <p>{formatDate(startDate)}</p>
        {endDate && <p className="text-xs text-gray-500">→ {formatDate(endDate)}</p>}
      </div>
    );
  }, []);

  const renderYieldCell = useCallback((data: { data: WorkOrder }) => {
    const yield_pct = Number(data.data.yieldPercentage);
    if (!yield_pct || yield_pct === 0 || isNaN(yield_pct)) return <span className="text-gray-400">-</span>;
    const colorClass = yield_pct >= 95 ? 'text-emerald-600' : yield_pct >= 85 ? 'text-amber-600' : 'text-red-600';
    return <span className={`font-semibold ${colorClass}`}>{yield_pct.toFixed(1)}%</span>;
  }, []);

  const renderStatusCell = useCallback((data: { data: WorkOrder }) => {
    const config = STATUS_CONFIG[data.data.status];
    if (!config) return <span className="text-gray-400">{data.data.status}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${config.bgClass}`}>
        <IconComponent className="h-3 w-3 shrink-0" />
        {t(`workOrders.status.${config.translationKey}`)}
      </span>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    const isEditable = EDITABLE_STATUSES.includes(wo.status);
    return (
      <div className="flex items-center gap-1">
        {isEditable && (
          <>
            <button
              onClick={(e) => handleEditClick(e, wo)}
              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
              title={t('workOrders.actions.editWO')}
              data-testid={`edit-wo-${wo.id}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => handleDeleteClick(e, wo)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title={t('workOrders.actions.deleteWO')}
              data-testid={`delete-wo-${wo.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/production/work-orders/${wo.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
          title={t('workOrders.actions.viewWO')}
          data-testid={`view-wo-${wo.id}`}
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>
    );
  }, [router, t, handleEditClick, handleDeleteClick]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('workOrders.pageTitle')}
        subtitle={t('workOrders.description')}
        icon={Factory}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-700"
        breadcrumbs={[
          { label: t('breadcrumbs.production'), href: '/production' },
          { label: t('workOrders.breadcrumbs.workOrders') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint={tCommon('actions.refresh')}
              onClick={() => refetch()}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('workOrders.actions.analytics')}
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/production/analytics')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('workOrders.actions.newWorkOrder')}
              type="success"
              onClick={() => router.push('/production/work-orders/new')}
            />
          </div>
        }
      />

      {/* Primary KPIs — only the metrics NOT already shown by the status donut
          / status tabs below, so nothing is repeated: total volume, how many
          are actively running, how many are urgent, and the completion rate.
          Per-status counts live in the donut + the filter tabs only. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('workOrders.stats.totalOrders')}
          value={stats.total}
          icon={ClipboardList}
          iconColor="text-emerald-600"
          accentColor="border-emerald-600"
          isLoading={isLoading}
        />
        <StatCard
          label={t('workOrders.charts.activeOrders')}
          value={stats.active}
          icon={PlayCircle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('workOrders.stats.highPriority')}
          value={stats.highPriority}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('workOrders.charts.completionRate')}
          value={`${Number(stats.completionRate).toFixed(1)}%`}
          icon={Target}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5 min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              {t('workOrders.charts.byStatus')}
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <div className="flex flex-col">
              {/* Donut Chart — no built-in Legend (custom below) */}
              <PieChart
                id="status-pie"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map(d => d.color)}
                size={{ height: 180 }}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={false} />
                  <Connector visible={false} />
                </Series>
                <Legend visible={false} />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                  })}
                />
              </PieChart>
              {/* Custom Legend — flex-wrap, auto height, no clipping */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                {statusChartData.map((d) => {
                  const total = statusChartData.reduce((sum, s) => sum + s.count, 0);
                  const pct = total > 0 ? ((d.count / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={d.status} className="flex items-center gap-1.5 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-gray-700">{d.status}</span>
                      <span className="text-gray-400 font-medium">{d.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('workOrders.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Priority breakdown of ACTIVE work orders — replaces a heavy, hard-to-
            read DevExtreme bar chart with three labelled progress bars so the
            operator can see at a glance how the open workload splits by urgency.
            Each row: colour-coded label + count + %-of-active bar. */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5 md:col-span-2 lg:col-span-2">
          <div className="flex items-start justify-between mb-4 gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t('workOrders.charts.byPriority')}
              </h3>
              <p className="text-xs text-[#4B7163] mt-0.5">
                งานที่ยังดำเนินการอยู่ ({priorityChartTotal} ใบ) แบ่งตามระดับความเร่งด่วน
              </p>
            </div>
          </div>
          {priorityChartTotal > 0 ? (
            <div className="space-y-4">
              {priorityChartData.map((d) => {
                const pct = priorityChartTotal > 0 ? Math.round((d.count / priorityChartTotal) * 100) : 0;
                const meta: Record<string, { label: string; hint: string; bar: string; text: string }> = {
                  'High (1-3)': { label: 'เร่งด่วนสูง', hint: 'priority 1–3', bar: 'bg-red-500', text: 'text-red-600' },
                  'Medium (4-6)': { label: 'ปานกลาง', hint: 'priority 4–6', bar: 'bg-amber-500', text: 'text-amber-600' },
                  'Low (7+)': { label: 'ต่ำ', hint: 'priority 7+', bar: 'bg-emerald-500', text: 'text-emerald-600' },
                };
                const m = meta[d.priority] || { label: d.priority, hint: '', bar: 'bg-gray-400', text: 'text-gray-600' };
                return (
                  <div key={d.priority}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-sm ${m.bar}`} />
                        <span className="text-sm font-medium text-gray-800">{m.label}</span>
                        <span className="text-xs text-gray-400">{m.hint}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-bold ${m.text}`}>{d.count}</span>
                        <span className="text-xs text-gray-400">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-emerald-400" />
                <p className="text-sm">{t('workOrders.charts.noActiveOrders')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              {t('workOrders.charts.performance')}
            </h3>
          </div>
          <div className="space-y-3">
            {/* Completion Rate */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">{t('workOrders.charts.completionRate')}</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {Number(stats.completionRate).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Average Yield — the one quality metric not surfaced by the KPI
                row or the status donut, so it earns its place here. */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded text-white">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-gray-700">{t('workOrders.charts.averageYield')}</span>
              </div>
              <span className={`text-sm font-bold ${
                stats.avgYield >= 95 ? 'text-emerald-600' :
                stats.avgYield >= 85 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {stats.avgYield > 0 ? `${Number(stats.avgYield).toFixed(1)}%` : 'N/A'}
              </span>
            </div>

            {/* Today's planned starts — actionable, not shown elsewhere. */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded text-white">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-gray-700">{t('workOrders.stats.today')}</span>
              </div>
              <span className="text-sm font-bold text-purple-600">{stats.todayPlanned}</span>
            </div>
          </div>
        </div>
      </div>

      {/* (Removed the per-status summary card row — it duplicated the status
          donut above and the filter tabs below. Status filtering now lives in
          the tabs only.) */}

      {/* Main Content - Tabs + DataGrid */}
      <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
        {/* Tabs Header — scroll horizontally on mobile if overflowing */}
        <div className="border-b border-emerald-50 px-3 sm:px-4 py-3 bg-gradient-to-r from-white to-[#F6FCF9]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F1FAF5] border border-emerald-100 rounded-xl">
                {statusTabs.map((tab) => {
                  const isSelected = statusFilter === tab.status;
                  const Icon = tab.icon;
                  const count = tabCount(tab.status);
                  return (
                    <button
                      key={tab.text}
                      type="button"
                      onClick={() => setStatusFilter(tab.status)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                        isSelected ? `${tab.activeBg} text-white shadow-sm` : 'text-gray-600 hover:bg-white/70'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.text}</span>
                      <span className={cn(
                        'ml-0.5 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                        isSelected ? 'bg-white/25 text-white' : tab.softPill
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              <Factory className="w-4 h-4 text-gray-400" />
              <span>{t('workOrders.grid.orders', { count: filteredWorkOrders.length })}</span>
            </div>
          </div>
        </div>

        {/* Mobile Card List (shown on < md) */}
        {isMobile ? (
          <WorkOrderMobileList
            workOrders={filteredWorkOrders}
            t={t}
            onView={(id: number) => router.push(`/production/work-orders/${id}`)}
            onEdit={(wo: WorkOrder) => {
              setSelectedWO(wo);
              setEditForm({
                batchNumber: wo.batchNumber || '',
                plannedQuantity: wo.plannedQuantity || 0,
                priority: wo.priority || 5,
                plannedStartDate: wo.plannedStartDate ? new Date(wo.plannedStartDate) : null,
                plannedEndDate: wo.plannedEndDate ? new Date(wo.plannedEndDate) : null,
                deliveryDate: wo.deliveryDate ? new Date(wo.deliveryDate) : null,
                notes: wo.notes || '',
              });
              setEditDialogVisible(true);
            }}
            onDelete={(wo: WorkOrder) => {
              setSelectedWO(wo);
              setDeleteDialogVisible(true);
            }}
          />
        ) : (
        /* Desktop DataGrid (shown on >= md) */
        <DataGrid
          dataSource={filteredWorkOrders}
          showBorders={false}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          height="auto"
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onRowClick={(e) => {
            if (e.data && e.rowType === 'data') {
              router.push(`/production/work-orders/${e.data.id}`);
            }
          }}
        >
          <Paging defaultPageSize={20} />
          <Pager
            visible={true}
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo={true}
            showNavigationButtons={true}
            displayMode="full"
            infoText="หน้า {0} จาก {1} (รวม {2} รายการ)"
          />
          <FilterRow visible={false} />
          <SearchPanel visible={true} placeholder={t('workOrders.grid.searchPlaceholder')} width={250} />
          <HeaderFilter visible={false} />

          <Column
            dataField="_rowNumber"
            caption="#"
            width={60}
            alignment="center"
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cellInfo) => (
              <span className="text-gray-500 text-sm font-medium">{cellInfo.data._rowNumber}</span>
            )}
          />
          <Column
            dataField="woNumber"
            caption={t('workOrders.grid.columns.woBatch')}
            width={150}
            cellRender={renderWOCell}
          />
          <Column
            caption={t('workOrders.grid.columns.product')}
            minWidth={200}
            cellRender={renderProductCell}
            calculateCellValue={(data: WorkOrder) => data.productName}
          />
          <Column
            dataField="bomCode"
            caption="BOM"
            minWidth={180}
            allowResizing={true}
            cellRender={renderBomCell}
          />
          <Column
            caption={t('workOrders.grid.columns.quantity')}
            width={180}
            cellRender={renderQuantityCell}
          />
          <Column
            dataField="priority"
            caption={t('workOrders.grid.columns.priority')}
            width={100}
            cellRender={renderPriorityCell}
          />
          <Column
            caption={t('workOrders.grid.columns.schedule')}
            width={130}
            cellRender={renderDateCell}
          />
          <Column
            dataField="yieldPercentage"
            caption={t('workOrders.grid.columns.yield')}
            width={80}
            cellRender={renderYieldCell}
          />
          <Column
            dataField="status"
            caption={t('workOrders.grid.columns.status')}
            width={160}
            cellRender={renderStatusCell}
          />
          <Column
            dataField="createdAt"
            caption="วันที่สร้าง"
            width={130}
            dataType="date"
            sortOrder="desc"
            cellRender={(cell: { value: string | Date }) => {
              if (!cell.value) return <span className="text-gray-400">-</span>;
              const d = new Date(cell.value);
              return (
                <span className="text-sm text-gray-600">
                  {d.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' })}
                </span>
              );
            }}
          />
          <Column
            caption=""
            width={120}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        </DataGrid>
        )}
      </div>

      {/* Edit Work Order Dialog */}
      <DxPopup
        visible={editDialogVisible}
        onVisibleChange={setEditDialogVisible}
        title={t('workOrders.actions.editWO')}
        width={500}
        height="auto"
        maxHeight="90vh"
        fullScreenOnMobile
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: tCommon('actions.save'),
              type: 'success',
              icon: 'save',
              onClick: handleSaveEdit,
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: tCommon('actions.cancel'),
              stylingMode: 'outlined' as const,
              onClick: () => setEditDialogVisible(false),
            },
          },
        ]}
      >
        <div className="p-4 space-y-4">
          {selectedWO && (
            <div className="mb-3 p-3 bg-[#F4FBF7] rounded-lg border border-emerald-200">
              <p className="text-sm font-semibold text-emerald-700">{selectedWO.woNumber}</p>
              <p className="text-xs text-emerald-600">{selectedWO.productName}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('workOrders.form.batchNumber.label')}
            </label>
            <TextBox
              value={editForm.batchNumber}
              onValueChanged={(e) => setEditForm(prev => ({ ...prev, batchNumber: e.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrders.form.quantity.label')}
              </label>
              <NumberBox
                value={editForm.plannedQuantity}
                onValueChanged={(e) => setEditForm(prev => ({ ...prev, plannedQuantity: e.value }))}
                min={0.01}
                format="#,##0.##"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrders.form.priority.label')}
              </label>
              <SelectBox
                value={editForm.priority}
                onValueChanged={(e) => setEditForm(prev => ({ ...prev, priority: e.value }))}
                items={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrders.form.plannedStart.label')}
              </label>
              <DateBox
                value={editForm.plannedStartDate}
                onValueChanged={(e) => setEditForm(prev => ({ ...prev, plannedStartDate: e.value }))}
                type="date"
                displayFormat="dd/MM/yyyy"
                max={editForm.plannedEndDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrders.form.plannedEnd.label')}
              </label>
              <DateBox
                value={editForm.plannedEndDate}
                onValueChanged={(e) => setEditForm(prev => ({ ...prev, plannedEndDate: e.value }))}
                type="date"
                displayFormat="dd/MM/yyyy"
                min={editForm.plannedStartDate || undefined}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Date (วันที่ส่งมอบ)
            </label>
            <DateBox
              value={editForm.deliveryDate}
              onValueChanged={(e) => setEditForm(prev => ({ ...prev, deliveryDate: e.value }))}
              type="date"
              displayFormat="dd/MM/yyyy"
              min={editForm.plannedEndDate || undefined}
              disabled={!editForm.plannedStartDate || !editForm.plannedEndDate}
              placeholder={
                !editForm.plannedStartDate || !editForm.plannedEndDate
                  ? 'กรุณาระบุวันเริ่มต้นและวันสิ้นสุดก่อน'
                  : 'เลือกวันส่งมอบ'
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('workOrders.form.remarks.label')}
            </label>
            <TextArea
              value={editForm.notes}
              onValueChanged={(e) => setEditForm(prev => ({ ...prev, notes: e.value }))}
              height={80}
            />
          </div>

          {/* Assigned Team — view + add + remove + change role inline */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Users className="h-4 w-4 text-emerald-600" />
                Assigned Team (เจ้าหน้าที่ผู้ปฏิบัติงาน)
                {editAssignees.length > 0 && (
                  <span className="text-xs text-gray-500 font-normal">({editAssignees.length})</span>
                )}
              </label>
              <button
                type="button"
                onClick={addEditAssignee}
                disabled={loadingEmployees}
                className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                + เพิ่ม
              </button>
            </div>
            {editAssignees.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">ยังไม่มีการมอบหมายเจ้าหน้าที่ — กดปุ่ม &ldquo;+ เพิ่ม&rdquo; เพื่อระบุทีม</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {editAssignees.map((a, idx) => {
                  const emp = employees.find((e) => e.id === a.employeeId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-start p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="col-span-12 sm:col-span-6">
                        <SelectBox
                          dataSource={employees.map((e) => ({
                            id: e.id,
                            label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
                          }))}
                          displayExpr="label"
                          valueExpr="id"
                          value={a.employeeId}
                          onValueChanged={(ev) => handleEditEmployeeChange(idx, ev.value as number | null)}
                          placeholder={loadingEmployees ? 'กำลังโหลด...' : 'เลือกเจ้าหน้าที่'}
                          disabled={loadingEmployees}
                          searchEnabled
                          stylingMode="outlined"
                        />
                        {emp?.positionTitle && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate px-1">{emp.positionTitle}</p>
                        )}
                      </div>
                      <div className="col-span-10 sm:col-span-5">
                        <SelectBox
                          dataSource={ROLE_OPTIONS}
                          displayExpr="label"
                          valueExpr="value"
                          value={a.role}
                          onValueChanged={(ev) => updateEditAssignee(idx, { role: ev.value as string })}
                          stylingMode="outlined"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-start justify-end">
                        <button
                          type="button"
                          onClick={() => removeEditAssignee(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                          title="ลบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={deleteDialogVisible}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteDialogVisible(false); setSelectedWO(null); }}
        title={t('workOrders.actions.deleteWO')}
        confirmText={tCommon('actions.delete')}
        cancelText={tCommon('actions.cancel')}
        confirmType="danger"
        width={480}
      >
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>

            {/* WO Number */}
            <div className="mb-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                <Factory className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-gray-900 text-lg">{selectedWO?.woNumber}</span>
              </span>
            </div>

            {/* Product Info */}
            {selectedWO?.productName && (
              <p className="text-sm text-gray-500 mb-4">
                {selectedWO.productName}
                {selectedWO.batchNumber && (
                  <span className="ml-2 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                    Batch: {selectedWO.batchNumber}
                  </span>
                )}
              </p>
            )}

            {/* Warning Message */}
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 mb-2">
              <p className="text-sm text-red-800 font-medium">
                {t('workOrders.actions.deleteConfirm', { woNumber: selectedWO?.woNumber || '' })}
              </p>
            </div>

            {/* Additional Warning */}
            <p className="text-xs text-gray-400 mt-2">
              {tCommon('actions.cannotUndo') || 'การดำเนินการนี้ไม่สามารถย้อนกลับได้'}
            </p>
          </div>
        </div>
      </DxConfirmDialog>
    </div>
  );
}

// ============================================
// Mobile Card List — replaces DataGrid on < md
// ============================================

type WorkOrderTranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

function WorkOrderMobileList({
  workOrders,
  t,
  onView,
  onEdit,
  onDelete,
}: {
  workOrders: WorkOrder[];
  t: WorkOrderTranslateFn;
  onView: (id: number) => void;
  onEdit: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
}) {
  if (workOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
          <Factory className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('workOrders.grid.noOrders') || 'ไม่มี Work Orders'}
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          {t('workOrders.grid.noOrdersDescription') || 'ยังไม่มีรายการตามเงื่อนไขที่เลือก'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 bg-gray-50/30">
      {workOrders.map((wo) => {
        const statusConfig = STATUS_CONFIG[wo.status] || STATUS_CONFIG.planned;
        const StatusIcon = statusConfig.icon;
        const progress =
          wo.plannedQuantity > 0 ? ((wo.actualQuantity || 0) / wo.plannedQuantity) * 100 : 0;

        return (
          <div
            key={wo.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Tap card to view */}
            <button
              type="button"
              onClick={() => onView(wo.id)}
              className="w-full text-left p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-emerald-600 text-base truncate">
                    {wo.woNumber}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{wo.batchNumber || '-'}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.bgClass}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {t(`workOrders.status.${statusConfig.translationKey}`)}
                </span>
              </div>

              <p className="font-medium text-gray-900 text-sm truncate">{wo.productName || '-'}</p>
              <p className="text-xs text-gray-500 font-mono mb-2">{wo.productCode || '-'}</p>

              {wo.bomCode && (
                <p className="text-xs mb-2">
                  <span className="text-gray-500">BOM: </span>
                  <span className="font-mono font-semibold text-emerald-700">{wo.bomCode}</span>
                  {wo.bomVersion && (
                    <span className="text-gray-500 ml-1">v{wo.bomVersion}</span>
                  )}
                </p>
              )}

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-gray-600">
                  <span className="font-semibold">
                    {formatNumber(wo.actualQuantity) || '0'}
                  </span>
                  {' / '}
                  {formatNumber(wo.plannedQuantity) || '-'} {wo.unit}
                </span>
                {wo.priority && (
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Activity className="h-3 w-3" />
                    P{wo.priority}
                  </span>
                )}
              </div>

              {wo.status === 'in_progress' && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}
            </button>

            {/* Action buttons — touch-friendly (44px min-height) */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(wo.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>ดู</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(wo)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Pencil className="h-4 w-4" />
                <span>แก้ไข</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(wo)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" />
                <span>ลบ</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
