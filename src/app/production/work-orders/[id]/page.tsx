'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Users,
  Info,
  Cog,
  Boxes,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';

interface WOAssignee {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeFirstName: string;
  employeeLastName: string;
  positionId: number | null;
  positionTitle: string | null;
  role: string;
  notes: string | null;
}

// Role → badge colour. The label is resolved at the call site via
// t('workOrderDetail.roles.<role>') so it follows the EN/TH toggle.
const ROLE_COLOR: Record<string, string> = {
  operator: 'bg-emerald-100 text-emerald-700',
  supervisor: 'bg-purple-100 text-purple-700',
  qa_verifier: 'bg-emerald-100 text-emerald-700',
  ipc_checker: 'bg-amber-100 text-amber-700',
  pharmacist: 'bg-rose-100 text-rose-700',
};
import { useToast } from '@/components/ui/toast';
import { ExecutionDashboard } from '@/components/production/ExecutionDashboard';
import { formatSpecSummary, getCriteriaTypeLabel } from '@/lib/master-data/ipc-spec-payload';
import { computeIPCStats, computePercentDeviation } from '@/lib/utils/ipc-statistics';
// Feature 018: material withdrawal approval
import { WithdrawalPanel } from '@/components/production/withdrawal-panel';
import { EbmrPrintPreviewOverlay } from '@/components/production/ebmr-print-preview-overlay';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { StatusStepper } from '@/components/shared';

interface LineClearanceStatus {
  required: boolean;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  canStartProduction: boolean;
  message: string;
}

interface WorkOrderDetail {
  workOrder: {
    id: number;
    woNumber: string;
    productId: number;
    productCode: string;
    productName: string;
    productNameEn: string;
    productUnit: string;
    ttmtCode: string | null;
    drugCode24: string | null;
    gRegNumber: string | null;
    batchNumber: string;
    plannedQty: number;
    actualQty: number;
    status: string;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate: string;
    actualEndDate: string;
    deliveryDate: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    lineClearanceRequired?: boolean;
    lineClearanceStatus?: string;
    bomId?: number | null;
    bomCode?: string | null;
    bomName?: string | null;
    bomVersion?: string | null;
  };
  materials: Array<{
    id: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    itemNameEn: string;
    itemUnit: string;
    plannedQty: number;
    actualQty: number;
    lotId: number;
    lotNumber: string;
    lotExpiryDate: string;
    consumptionPercent: number;
    variance: number;
  }>;
  qcTests: Array<{
    id: number;
    testCode: string;
    testType: string;
    status: string;
    result: string;
    testedAt: string;
  }>;
  ebmr: {
    batchNumber: string;
    productCode: string;
    productName: string;
    ttmtCode: string | null;
    drugCode24: string | null;
    gRegNumber: string | null;
    plannedQty: number;
    actualQty: number;
    yieldPercent: number;
    productionTimeHours: number;
    status: string;
    // eBMR audit gap #1 — Production Summary extras
    bulkOutputQty: number | null;
    finishedOutputQty: number | null;
    bulkYieldPercent: number | null;
    packagingLossQty: number | null;
    packagingLossPercent: number | null;
    totalLossQty: number | null;
    totalLossPercent: number | null;
    productUnit: string | null;
    materials: any[];
    qcTests: any[];
    operations: Array<{
      id: number;
      sequence: number;
      name: string;
      description: string;
      standardTime: number;
      setupTime: number;
      cleaningTime: number;
      instructions: string;
    }>;
    batchRecords: Array<{
      id: number;
      sequence: number;
      stepName: string;
      instructions: string;
      parameters: any[] | null;
      actualValues: Record<string, any> | null;
      status: string;
      startTime: string;
      endTime: string;
      performerName: string | null;
      verifierName: string | null;
      verifiedAt: string;
      notes: string;
    }>;
    timeline: {
      plannedStart: string;
      plannedEnd: string;
      actualStart: string;
      actualEnd: string;
    };
    // Execution workflow data
    sopExecution: any[];
    cleaningLogs: any[];
    environmentalLogs: any[];
    materialWeighing: any[];
    ipcTests: any[];
    // eBMR GMP structure — formula / personnel / health / gowning
    bomCode?: string | null;
    bomName?: string | null;
    bomVersion?: string | null;
    bomLines: any[];
    assignees: any[];
    healthChecks: any[];
    gowning: any[];
    finishedPhotos: { id: number; fileName: string; mimeType: string }[];
    // eBMR Approval Signatures (Produced By / Verified By QC / Approved By QA)
    signatures?: {
      producedBy: { userId: number; name: string; signedAt: string; source: string } | null;
      verifiedByQc: { userId: number; name: string; signedAt: string; source: string } | null;
      approvedByQa: { userId: number; name: string; signedAt: string; source: string } | null;
    };
  };
  summary: {
    yieldPercent: number;
    productionTimeHours: number;
    materialCount: number;
    qcTestCount: number;
    qcPassCount: number;
  };
}

interface Lot {
  id: number;
  lotNumber: string;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  expiryDate: string;
  itemId: number;
  itemCode: string;
  itemName: string;
}

interface ProductSpec {
  id: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  isCritical: boolean;
}

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('workOrderDetail.title');
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Tab persists in URL via ?tab=... so sub-pages can return the user to the
  // exact tab they came from (Execution, Materials, …). Falls back to 0.
  const tabNameToIndex: Record<string, number> = {
    overview: 0, execution: 1, materials: 2, qc: 3, deviations: 4, ebmr: 5,
  };
  const initialTabIndex = tabNameToIndex[searchParams.get('tab') || ''] ?? 0;
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
  const [assignees, setAssignees] = useState<WOAssignee[]>([]);
  // In-app eBMR print preview (A4 WYSIWYG overlay) so users can review the
  // document before printing without relying on the browser's print preview.
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Add Material Dialog State
  const [itemSearchDialogOpen, setItemSearchDialogOpen] = useState(false);
  const [materialDetailsDialogOpen, setMaterialDetailsDialogOpen] = useState(false);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState(0);
  const [actualQuantity, setActualQuantity] = useState(0);
  const [addingMaterial, setAddingMaterial] = useState(false);

  // Add QC Test Dialog State
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [testType, setTestType] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [testMethod, setTestMethod] = useState('');
  const [testNotes, setTestNotes] = useState('');
  const [addingQCTest, setAddingQCTest] = useState(false);
  const [productSpecs, setProductSpecs] = useState<ProductSpec[]>([]);

  // Line Clearance State (FR-062)
  const [lineClearanceStatus, setLineClearanceStatus] = useState<LineClearanceStatus | null>(null);

  // Phase 7c — deviations linked to this work order. Auto-created when an
  // operator records a failing IPC during SOP execution; the badge under
  // the tab gives the production team an at-a-glance count of CAPA work.
  interface WODeviation {
    id: number;
    deviationNumber: string;
    title: string | null;
    severity: string;
    status: string;
    type: string | null;
    sourceType: string | null;
    sourceId: number | null;
    reportedAt: string | null;
    createdAt: string;
  }
  const [deviations, setDeviations] = useState<WODeviation[]>([]);

  const fetchDeviations = async () => {
    try {
      const response = await fetch(`/api/quality/deviations?workOrderId=${params.id}&limit=200`);
      const result = await response.json();
      if (result.success) {
        const devList = result.data?.items ?? result.data ?? [];
        setDeviations(Array.isArray(devList) ? devList : []);
      }
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
    }
  };

  const tabs: { text: string; Icon: LucideIcon }[] = [
    { text: t('workOrderDetail.tabs.overview'), Icon: Info },
    { text: t('workOrderDetail.tabs.execution'), Icon: Cog },
    { text: t('workOrderDetail.tabs.materials'), Icon: Boxes },
    { text: t('workOrderDetail.tabs.qc'), Icon: CheckCircle2 },
    { text: t('workOrderDetail.tabs.deviations'), Icon: AlertCircle },
    { text: t('workOrderDetail.tabs.ebmr'), Icon: FileText },
  ];

  useEffect(() => {
    fetchWorkOrderDetail();
    fetchLineClearanceStatus();
    fetchDeviations();
    fetchAssignees();
  }, [params.id]);

  // Realtime sync — when another user (or another tab on the same machine)
  // changes any execution sub-section on this work order, refetch the
  // detail + line-clearance status so the header / KPIs / progress bars
  // stay in sync without a manual reload.
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== Number(params.id)) return;
    fetchWorkOrderDetail();
    fetchLineClearanceStatus();
    fetchDeviations();
  });
  // Also reflect requisition state flips initiated from /inventory/lots.
  useRealtimeTopic('requisition-changed', (data) => {
    if (data.workOrderId !== Number(params.id)) return;
    fetchWorkOrderDetail();
  });

  useEffect(() => {
    if (selectedItem) {
      fetchLots(selectedItem.id);
    } else {
      setLots([]);
    }
  }, [selectedItem]);

  const fetchLineClearanceStatus = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/line-clearance`);
      const result = await response.json();
      if (result.success) {
        setLineClearanceStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch line clearance status:', error);
    }
  };

  const fetchAssignees = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/assignees`);
      const result = await response.json();
      if (result.success) {
        setAssignees(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch assignees:', error);
    }
  };

  const fetchWorkOrderDetail = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Fetch product-specific QC specs
        if (result.data.workOrder?.productId) {
          fetchProductSpecs(result.data.workOrder.productId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch work order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductSpecs = async (productId: number) => {
    try {
      const response = await fetch(`/api/quality/specs?itemId=${productId}&isActive=true&limit=100`);
      const result = await response.json();
      if (result.success) {
        const specs = result.data?.items || result.data?.data || (Array.isArray(result.data) ? result.data : []);
        setProductSpecs(specs);
      }
    } catch (error) {
      console.error('Failed to fetch product specs:', error);
    }
  };

  const fetchLots = async (itemId: number) => {
    try {
      const response = await fetch(`/api/inventory/lots?itemId=${itemId}&status=released&limit=50`);
      const result = await response.json();
      if (result.success) {
        setLots(result.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemSearchDialogOpen(false);
    setMaterialDetailsDialogOpen(true);
  };

  const handleAddMaterial = async () => {
    if (!selectedItem || !plannedQuantity) return;

    setAddingMaterial(true);
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          lotId: selectedLot?.id || null,
          plannedQuantity: plannedQuantity,
          actualQuantity: actualQuantity || null,
          unit: selectedItem.primaryUnit,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setMaterialDetailsDialogOpen(false);
        resetMaterialForm();
        fetchWorkOrderDetail();
      }
    } catch (error) {
      console.error('Failed to add material:', error);
    } finally {
      setAddingMaterial(false);
    }
  };

  const resetMaterialForm = () => {
    setSelectedItem(null);
    setSelectedLot(null);
    setPlannedQuantity(0);
    setActualQuantity(0);
    setLots([]);
  };

  const handleAddQCTest = async () => {
    if (!selectedSpecId && !testType) return;

    setAddingQCTest(true);
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/qc-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specId: selectedSpecId || null,
          testType: testType || 'in_process',
          notes: testNotes || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setQcDialogOpen(false);
        resetQCForm();
        fetchWorkOrderDetail();
      }
    } catch (error) {
      console.error('Failed to add QC test:', error);
    } finally {
      setAddingQCTest(false);
    }
  };

  const resetQCForm = () => {
    setTestType('');
    setSelectedSpecId(null);
    setTestMethod('');
    setTestNotes('');
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(t('workOrderDetail.toast.statusUpdated', { status: getStatusLabel(newStatus) }));
        fetchWorkOrderDetail();
        fetchLineClearanceStatus();
      } else {
        // Show blocker details from gate validation
        toast.error(result.error || t('workOrderDetail.toast.statusFailed'));
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(t('workOrderDetail.toast.statusFailed'));
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'completed': return 'primary';
      case 'in_progress': return 'secondary';
      case 'cancelled': return 'danger';
      case 'pass': return 'primary';
      case 'fail': return 'danger';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const known = ['draft', 'planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'];
    return known.includes(status) ? t(`workOrderDetail.status.${status}`) : status;
  };

  // QC/IPC spec column sometimes carries a raw JSON config blob instead of a
  // simple range — extract a readable acceptance range/target from it so the
  // eBMR table shows "0.096–0.110 g" instead of a giant {"type":...} string.
  const formatQcSpec = (raw: unknown): string => {
    if (raw == null || raw === '') return '-';
    const s = String(raw).trim();
    if (!s.startsWith('{') && !s.startsWith('[')) return s; // already human-readable
    try {
      const cfg = JSON.parse(s) as Record<string, any>;
      const unit = cfg.unit || cfg.referenceUnit || '';
      const min = cfg.acceptanceMin ?? cfg.specMin ?? cfg.min;
      const max = cfg.acceptanceMax ?? cfg.specMax ?? cfg.max;
      if (min != null && max != null) return `${min}–${max} ${unit}`.trim();
      if (cfg.perPointTarget != null) {
        const tol = cfg.perPointTolerance != null ? ` ±${cfg.perPointTolerance}%` : '';
        return `${t('workOrderDetail.ebmr.qcTarget')} ${cfg.perPointTarget}${unit ? ' ' + unit : ''}${tol}`.trim();
      }
      if (cfg.quantity?.every != null) {
        return `${t('workOrderDetail.ebmr.qcEvery')} ${cfg.quantity.every}`;
      }
      if (cfg.referenceLabel) return String(cfg.referenceLabel);
      if (cfg.label) return String(cfg.label);
      if (cfg.type) return t(`workOrderDetail.ebmr.qcSpecType.${String(cfg.type)}` as Parameters<typeof t>[0]);
      return t('workOrderDetail.ebmr.qcSpecConfigured');
    } catch {
      return t('workOrderDetail.ebmr.qcSpecConfigured');
    }
  };

  // eBMR batch-record step status → label (reuses batchRecords.status keys)
  const getStepStatusLabel = (status: string): string => {
    const known = ['pending', 'in_progress', 'completed', 'deviation'];
    return known.includes(status)
      ? t(`batchRecords.status.${status}`)
      : status.replace(/_/g, ' ');
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      'draft': 'planned',
      'planned': 'released',
      'released': 'in_progress',
      'in_progress': 'completed',
      'completed': 'closed',
    };
    return flow[currentStatus] || null;
  };

  // Grid columns for materials
  const materialsColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: t('workOrderDetail.materials.colItem'),
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: t('workOrderDetail.materials.colLot'),
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.lotNumber || '-'}</p>
          {cellInfo.data.lotExpiryDate && (
            <p className="text-sm text-gray-500">{t('workOrderDetail.materials.expiry', { date: new Date(cellInfo.data.lotExpiryDate).toLocaleDateString('th-TH') })}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'plannedQty',
      caption: t('workOrderDetail.materials.colPlannedQty'),
      // Unit priority: workOrderMaterials.unit (from weighing/BOM record) → items.primaryUnit (fallback)
      // The `unit` column on work_order_materials is the source of truth for how the material
      // was planned/weighed. Only fall back to itemUnit if no unit was ever recorded.
      cellRender: (cellInfo) => <span>{cellInfo.data.plannedQty} {cellInfo.data.unit || cellInfo.data.itemUnit}</span>,
    },
    {
      dataField: 'actualQty',
      caption: t('workOrderDetail.materials.colActualQty'),
      cellRender: (cellInfo) => {
        const displayUnit = cellInfo.data.unit || cellInfo.data.itemUnit;
        return <span>{cellInfo.data.actualQty || '-'} {cellInfo.data.actualQty ? displayUnit : ''}</span>;
      },
    },
    {
      dataField: 'variance',
      caption: t('workOrderDetail.materials.colVariance'),
      cellRender: (cellInfo) => {
        const v = cellInfo.data.variance;
        if (v === null || v === undefined) return <span>-</span>;
        const planned = Number(cellInfo.data.plannedQty) || 0;
        const pct = planned > 0 ? ((v / planned) * 100) : 0;
        const sign = v > 0 ? '+' : '';
        const pctSign = pct > 0 ? '+' : '';
        const color = v > 0 ? 'text-red-600' : v < 0 ? 'text-green-600' : 'text-gray-500';
        const unit = cellInfo.data.unit || cellInfo.data.itemUnit || '';
        return (
          <div className={color}>
            <div className="font-medium">{sign}{v} {unit}</div>
            <div className="text-xs opacity-75">({pctSign}{pct.toFixed(2)}%)</div>
          </div>
        );
      },
    },
    {
      dataField: 'consumptionPercent',
      caption: t('workOrderDetail.materials.colConsumption'),
      cellRender: (cellInfo) => (
        cellInfo.data.consumptionPercent !== null ? (
          <Badge variant={cellInfo.data.consumptionPercent <= 100 ? 'primary' : 'danger'}>
            {cellInfo.data.consumptionPercent}%
          </Badge>
        ) : <span>-</span>
      ),
    },
  ];

  // Grid columns for QC tests
  // Map source → label + badge colour. The convention matches the
  // classification done in /api/.../detail (sample_number prefix).
  // Label resolved at call site via t('workOrderDetail.qc.source.<key>').
  const sourceConfig: Record<string, { labelKey: string; bg: string; text: string }> = {
    'sop': { labelKey: 'sop', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'bom-ipc': { labelKey: 'bomIpc', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'incoming': { labelKey: 'incoming', bg: 'bg-amber-50', text: 'text-amber-700' },
    'final': { labelKey: 'final', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'other': { labelKey: 'other', bg: 'bg-gray-50', text: 'text-gray-700' },
  };

  /** Drill-in target for a QC test row. */
  const buildQCDrillUrl = (row: Record<string, unknown>): string => {
    if (row.source === 'sop') {
      const phase = row.ipcPhase ? String(row.ipcPhase) : 'production';
      return `/production/work-orders/${params.id}/sop-execution?phase=${phase}`;
    }
    if (row.source === 'bom-ipc') {
      const phase = row.ipcPhase ? String(row.ipcPhase) : 'production';
      return `/production/work-orders/${params.id}/ipc?phase=${phase}`;
    }
    return `/quality/tests/${row.id}`;
  };

  const qcTestsColumns: DxDataGridColumn[] = [
    {
      dataField: 'testCode',
      caption: t('workOrderDetail.qc.colTestCode'),
      width: 110,
      cellRender: (cellInfo) => <span className="font-mono text-xs font-medium">{cellInfo.data.testCode}</span>,
    },
    {
      dataField: 'source',
      caption: t('workOrderDetail.qc.colSource'),
      width: 110,
      cellRender: (cellInfo) => {
        const cfg = sourceConfig[cellInfo.data.source as string] || sourceConfig.other;
        return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>{t(`workOrderDetail.qc.source.${cfg.labelKey}`)}</span>;
      },
    },
    {
      dataField: 'specSpecification',
      caption: t('workOrderDetail.qc.colTestSpec'),
      cellRender: (cellInfo) => {
        const d = cellInfo.data;
        // Headline: criterion name. Lines: structured spec from envelope
        // (pass_fail def, numeric range, multi-point summary, …). Type badge
        // helps the reader scan the grid quickly.
        const ctype = d.criteriaType || 'numeric';
        const lines = formatSpecSummary({
          criteriaType: ctype,
          specification: d.specSpecification,
          sampleSize: d.sampleSize,
          minValue: d.specMinValue,
          maxValue: d.specMaxValue,
          unit: d.specUnit,
        });
        const headline = d.notes || (d.testType !== 'in_process' ? d.testType : null) || '-';
        return (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-px rounded">
                {getCriteriaTypeLabel(ctype)}
              </span>
              <span className="text-gray-900 break-words">{headline}</span>
            </div>
            {lines.slice(0, 3).map((ln: { icon: string; text: string; tone?: string }, i: number) => (
              <div key={i} className={`flex items-start gap-1 ${
                ln.tone === 'pass' ? 'text-emerald-700'
                : ln.tone === 'fail' ? 'text-rose-700'
                : 'text-gray-500'
              }`}>
                <span className="flex-none w-3 text-center">{ln.icon}</span>
                <span className="break-words">{ln.text}</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      dataField: 'status',
      caption: t('workOrderDetail.qc.colStatus'),
      width: 100,
      cellRender: (cellInfo) => <Badge variant={getStatusVariant(cellInfo.data.status)}>{cellInfo.data.status}</Badge>,
    },
    {
      dataField: 'result',
      caption: t('workOrderDetail.qc.colResult'),
      width: 90,
      cellRender: (cellInfo) => (
        cellInfo.data.result ? <Badge variant={getStatusVariant(cellInfo.data.result)}>{cellInfo.data.result}</Badge> : null
      ),
    },
    {
      dataField: 'testedByName',
      caption: t('workOrderDetail.qc.colTestedBy'),
      width: 160,
      cellRender: (cellInfo) => (
        <span className="text-xs text-gray-700">{cellInfo.data.testedByName || <span className="text-gray-400">—</span>}</span>
      ),
    },
    {
      dataField: 'approvedByName',
      caption: t('workOrderDetail.qc.colApprovedBy'),
      width: 140,
      cellRender: (cellInfo) => (
        <span className="text-xs text-gray-700">{cellInfo.data.approvedByName || <span className="text-gray-400">{t('workOrderDetail.qc.waitingQc')}</span>}</span>
      ),
    },
    {
      dataField: 'testedAt',
      caption: t('workOrderDetail.qc.colTestedAt'),
      width: 150,
      cellRender: (cellInfo) => <span className="text-xs">{cellInfo.data.testedAt ? new Date(cellInfo.data.testedAt).toLocaleString('th-TH') : '-'}</span>,
    },
    {
      caption: t('workOrderDetail.qc.colDetails'),
      width: 130,
      alignment: 'center',
      cellRender: (cellInfo) => (
        <div className="flex justify-center pr-1">
          <button
            type="button"
            onClick={() => router.push(buildQCDrillUrl(cellInfo.data))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            {t('workOrderDetail.qc.viewDetails')}
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('workOrderDetail.notFound.message')}</p>
        <DxButton
          text={t('workOrderDetail.notFound.back')}
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  const { workOrder, materials: materialsRaw, qcTests: qcTestsRaw, ebmr: ebmrRaw, summary } = data;
  const nextStatus = getNextStatus(workOrder.status);

  // Harden against a transient non-array shape during navigation/refetch — a
  // single bad field would otherwise crash the whole page with
  // "(intermediate value).map is not a function". Coerce every list we .map()
  // over to a real array, preserving the original element type. (Repro: record
  // a material return, then SPA-navigate back to ?tab=execution before the
  // query cache settles.)
  const asArr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
  const materials = asArr(materialsRaw);
  const qcTests = asArr(qcTestsRaw);
  const ebmr = {
    ...ebmrRaw,
    operations: asArr(ebmrRaw?.operations),
    batchRecords: asArr(ebmrRaw?.batchRecords),
    materials: asArr(ebmrRaw?.materials),
    qcTests: asArr(ebmrRaw?.qcTests),
    sopExecution: asArr(ebmrRaw?.sopExecution),
    cleaningLogs: asArr(ebmrRaw?.cleaningLogs),
    environmentalLogs: asArr(ebmrRaw?.environmentalLogs),
    materialWeighing: asArr(ebmrRaw?.materialWeighing),
    ipcTests: asArr(ebmrRaw?.ipcTests),
    bomLines: asArr(ebmrRaw?.bomLines),
    assignees: asArr(ebmrRaw?.assignees),
    healthChecks: asArr(ebmrRaw?.healthChecks),
    gowning: asArr(ebmrRaw?.gowning),
    finishedPhotos: asArr(ebmrRaw?.finishedPhotos),
  };

  // ════════ Section 7 phase grouping (eBMR Production Records) ════════
  // Records are bucketed under one of 5 phases. Some records carry an explicit
  // phase field; others are hardcoded to a phase by their nature.
  const PHASE_ORDER = ['pre_production', 'production', 'post_production', 'packaging', 'inspection'] as const;
  type Phase = typeof PHASE_ORDER[number];
  // Normalize a raw phase string: 'pre_packaging' → 'packaging'; unknown/missing → fallback.
  const normPhase = (p: unknown, fallback: Phase): Phase => {
    const raw = String(p || '').toLowerCase();
    if (raw === 'pre_packaging') return 'packaging';
    return (PHASE_ORDER as readonly string[]).includes(raw) ? (raw as Phase) : fallback;
  };
  const phaseLabel = (phase: Phase): string => {
    const map: Record<Phase, string> = {
      pre_production: t('workOrderDetail.ebmr.ipcPhasePreProduction'),
      production: t('workOrderDetail.ebmr.ipcPhaseProduction'),
      post_production: t('workOrderDetail.ebmr.ipcPhasePostProduction'),
      packaging: t('workOrderDetail.ebmr.ipcPhasePackaging'),
      inspection: t('workOrderDetail.ebmr.ipcPhaseInspection'),
    };
    return map[phase];
  };

  // ── Per-card render helpers (return null when their array is empty) ──

  const renderOperationsCard = (ops: typeof ebmr.operations) => {
    if (!ops || ops.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.operations')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={6}>{t('workOrderDetail.ebmr.operations')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-center text-gray-700 w-16">{t('workOrderDetail.ebmr.opSeq')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.opName')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.opDescription')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.opStandardTime')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.opSetupTime')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.opCleaningTime')}</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => (
                <tr key={op.id}>
                  <td className="border p-2 text-center text-gray-900 font-medium">{op.sequence}</td>
                  <td className="border p-2 text-gray-900 font-medium">{op.name}</td>
                  <td className="border p-2 text-gray-900">{op.description || '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{op.standardTime ?? '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{op.setupTime ?? '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{op.cleaningTime ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderBatchRecordsCard = (brs: typeof ebmr.batchRecords) => {
    if (!brs || brs.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.batchRecords')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {brs.map((br) => (
              <div key={br.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-medium">
                      {br.sequence}
                    </span>
                    <h4 className="font-medium text-gray-900">{br.stepName}</h4>
                  </div>
                  <Badge variant={
                    br.status === 'completed' ? 'primary' :
                    br.status === 'in_progress' ? 'secondary' :
                    br.status === 'deviation' ? 'danger' : 'default'
                  }>
                    {getStepStatusLabel(br.status)}
                  </Badge>
                </div>
                {br.instructions && (
                  <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{br.instructions}</p>
                )}
                {br.actualValues && Object.keys(br.actualValues).length > 0 && (
                  <div className="bg-gray-50 rounded p-2 mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">{t('workOrderDetail.ebmr.recordedValues')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(br.actualValues).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-gray-500">{key.replace(/_/g, ' ')}:</span>{' '}
                          <span className="font-medium text-gray-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {br.performerName && <span>{t('workOrderDetail.ebmr.performedBy', { name: br.performerName })}</span>}
                  {br.verifierName && <span>{t('workOrderDetail.ebmr.verifiedBy', { name: br.verifierName })}</span>}
                  {br.startTime && <span>{t('workOrderDetail.ebmr.stepStart', { value: new Date(br.startTime).toLocaleString('th-TH') })}</span>}
                  {br.endTime && <span>{t('workOrderDetail.ebmr.stepEnd', { value: new Date(br.endTime).toLocaleString('th-TH') })}</span>}
                </div>
                {br.notes && (
                  <p className="text-sm text-gray-600 mt-1 italic">{t('workOrderDetail.ebmr.stepNotes', { value: br.notes })}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeighingCard = (rows: typeof ebmr.materialWeighing) => {
    if (!rows || rows.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.weighing')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={7}>{t('workOrderDetail.ebmr.weighing')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.weighItem')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.weighLot')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.weighPlanned')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.weighWeighed')}</th>
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.weighStatus')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.weighWeigher')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.weighVerifier')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((mat: any) => (
                <tr key={mat.id}>
                  <td className="border p-2 text-gray-900">
                    <div>{mat.itemNameTh || mat.itemName}</div>
                    <div className="text-xs text-gray-500">{mat.itemCode}</div>
                  </td>
                  <td className="border p-2 text-gray-900 text-sm">{mat.lotNumber || '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{mat.plannedQty} {mat.unit}</td>
                  <td className="border p-2 text-right text-gray-900">{mat.weighedQty ?? '-'}</td>
                  <td className="border p-2 text-center">
                    <Badge variant={
                      mat.verifiedAt ? 'primary' :
                      mat.weighedAt ? 'secondary' : 'default'
                    }>
                      {mat.verifiedAt ? t('workOrderDetail.stepStatus.verified') : mat.weighedAt ? t('workOrderDetail.stepStatus.weighed') : t('workOrderDetail.stepStatus.pending')}
                    </Badge>
                  </td>
                  <td className="border p-2 text-gray-900 text-sm">
                    {mat.weighedByName || (mat.weighedBy ? `User#${mat.weighedBy}` : '-')}
                    {mat.weighedAt && <div className="text-xs text-gray-500">{new Date(mat.weighedAt).toLocaleString('th-TH')}</div>}
                  </td>
                  <td className="border p-2 text-gray-900 text-sm">
                    {mat.verifiedByName || (mat.verifiedBy ? `User#${mat.verifiedBy}` : '-')}
                    {mat.verifiedAt && <div className="text-xs text-gray-500">{new Date(mat.verifiedAt).toLocaleString('th-TH')}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderMaterialsCard = (mats: typeof ebmr.materials) => {
    if (!mats || mats.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.materialConsumption')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={9}>{t('workOrderDetail.ebmr.materialConsumption')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.matItemCode')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.matItemName')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.matLot')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matPlanned')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matIssued')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matWeighed')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matReturned')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matNetUsed')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.matVariance')}</th>
              </tr>
            </thead>
            <tbody>
              {mats.map((mat: any, index: number) => {
                const displayUnit = mat.unit || mat.itemUnit;
                const weighed = mat.weighedQty;
                const hasWeighed = weighed !== null && weighed !== undefined;
                const plannedNum = Number(mat.plannedQty);
                const variance = hasWeighed ? Number(weighed) - plannedNum : null;
                const variancePct =
                  hasWeighed && plannedNum > 0 ? (variance! / plannedNum) * 100 : null;
                const issued = mat.issuedQty;
                const returned = mat.returnedQty || 0;
                const netUsed = mat.netUsedQty;

                return (
                  <tr key={index}>
                    <td className="border p-2 text-gray-900">{mat.itemCode}</td>
                    <td className="border p-2 text-gray-900">{mat.itemName}</td>
                    <td className="border p-2 text-gray-900">{mat.lotNumber || '-'}</td>
                    <td className="border p-2 text-right text-gray-900">
                      {mat.plannedQty} {displayUnit}
                    </td>
                    <td className="border p-2 text-right text-gray-900">
                      {issued != null ? <>{issued} {displayUnit}</> : '-'}
                    </td>
                    <td className="border p-2 text-right text-gray-900">
                      {hasWeighed ? (
                        <>{weighed} {displayUnit}</>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="border p-2 text-right text-gray-900">
                      {returned > 0 ? (
                        <span className="text-amber-700">{returned} {displayUnit}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border p-2 text-right text-gray-900 font-semibold">
                      {netUsed != null ? <>{netUsed} {displayUnit}</> : '-'}
                    </td>
                    <td className="border p-2 text-right text-gray-900">
                      {hasWeighed ? (
                        <>
                          <span
                            className={
                              variance! > 0
                                ? 'text-red-600'
                                : variance! < 0
                                  ? 'text-green-600'
                                  : ''
                            }
                          >
                            {variance! > 0 ? '+' : ''}
                            {variance} {displayUnit}
                          </span>
                          {variancePct !== null && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({variancePct.toFixed(2)}%)
                            </span>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderCleaningCard = (logs: typeof ebmr.cleaningLogs) => {
    if (!logs || logs.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.cleaning')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={8}>{t('workOrderDetail.ebmr.cleaning')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanPhase')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanType')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanTarget')}</th>
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.cleanIsClean')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanOperator')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanPerformedAt')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanVerified')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.cleanNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => {
                // eBMR audit gap #5 — show equipment / room code + name.
                const targetCode = log.equipmentCode || log.roomCode;
                const targetName = log.equipmentName || log.roomName;
                return (
                  <tr key={log.id}>
                    <td className="border p-2 text-gray-900 capitalize">
                      {(log.phase || '').replace(/_/g, ' ')}
                    </td>
                    <td className="border p-2 text-gray-900 capitalize">
                      {log.itemType || '-'}
                    </td>
                    <td className="border p-2 text-gray-900">
                      {targetCode || targetName ? (
                        <>
                          {targetCode && (
                            <span className="font-medium">{targetCode}</span>
                          )}
                          {targetName && (
                            <span className="text-gray-600">
                              {targetCode ? ' — ' : ''}
                              {targetName}
                            </span>
                          )}
                        </>
                      ) : log.equipmentId ? (
                        `EQP#${log.equipmentId}`
                      ) : log.roomId ? (
                        `ROOM#${log.roomId}`
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border p-2 text-center">
                      {log.isClean ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-red-600 font-bold">✗</span>
                      )}
                    </td>
                    <td className="border p-2 text-gray-900">
                      {log.operatorName || (log.operatorId ? `User#${log.operatorId}` : '-')}
                    </td>
                    <td className="border p-2 text-gray-900">
                      {log.performedAt
                        ? new Date(log.performedAt).toLocaleString('th-TH')
                        : '-'}
                    </td>
                    <td className="border p-2 text-gray-900">
                      {log.verifierName || (log.verifierId ? `User#${log.verifierId}` : '-')}
                      {log.verifiedAt && (
                        <div className="text-xs text-gray-500">
                          {new Date(log.verifiedAt).toLocaleString('th-TH')}
                        </div>
                      )}
                    </td>
                    <td className="border p-2 text-gray-900">{log.notes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderEnvCard = (logs: typeof ebmr.environmentalLogs) => {
    if (!logs || logs.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.environmental')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={7}>{t('workOrderDetail.ebmr.environmental')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.envPhase')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.envDate')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.envTime')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.envTemperature')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.envHumidity')}</th>
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.envNormal')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.envNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td className="border p-2 text-gray-900 capitalize">{(log.phase || '').replace(/_/g, ' ')}</td>
                  <td className="border p-2 text-gray-900">{log.recordedDate || '-'}</td>
                  <td className="border p-2 text-gray-900">{log.recordedTime || '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{log.temperature ?? '-'}</td>
                  <td className="border p-2 text-right text-gray-900">{log.humidity ?? '-'}</td>
                  <td className="border p-2 text-center">
                    {log.isNormal ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-600 font-bold">✗</span>}
                  </td>
                  <td className="border p-2 text-gray-900 text-sm">{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderSopCard = (steps: typeof ebmr.sopExecution) => {
    if (!steps || steps.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.sopExecution')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border table-fixed">
            <colgroup>
              <col style={{ width: '6%' }} />{/* Step (fits "Step" label on one line) */}
              <col style={{ width: '28%' }} />{/* Step Name + sub-steps */}
              <col style={{ width: '9%' }} />{/* Status */}
              <col style={{ width: '16%' }} />{/* Parameters */}
              <col style={{ width: '13%' }} />{/* Notes */}
              <col style={{ width: '14%' }} />{/* Operator */}
              <col style={{ width: '14%' }} />{/* Verified */}
            </colgroup>
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={7}>{t('workOrderDetail.ebmr.sopExecution')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.sopStep')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.sopStepName')}</th>
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.sopStatus')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.sopParameters')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.sopNotes')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.sopOperator')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.sopVerified')}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step: any) => {
                const lang = (typeof navigator !== 'undefined' && navigator.language?.startsWith('th')) ? 'th' : 'en';
                const instructions = lang === 'th' ? (step.instructionsTh || step.instructions) : (step.instructions || step.instructionsTh);
                const subSteps: Array<{ id: number; sequence: number; stepName: string; stepNameTh?: string; instructions?: string; instructionsTh?: string }> =
                  Array.isArray(step.templateSteps) ? step.templateSteps : [];
                return (
                  <tr key={step.id}>
                    <td className="border p-2 text-center text-gray-900 font-medium align-top">{step.sequence}</td>
                    <td className="border p-2 text-gray-900 align-top">
                      <div className="font-medium">{step.stepNameTh || step.stepName}</div>
                      {instructions && (
                        <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                          <span className="font-semibold">{t('workOrderDetail.ebmr.sopInstructions')}</span>{instructions}
                        </div>
                      )}
                      {subSteps.length > 0 && (
                        <ol className="text-xs text-gray-700 mt-1.5 ml-3 list-decimal space-y-0.5">
                          {subSteps.map((ss) => (
                            <li key={ss.id}>
                              <span className="font-medium">{lang === 'th' ? (ss.stepNameTh || ss.stepName) : (ss.stepName || ss.stepNameTh)}</span>
                              {(ss.instructionsTh || ss.instructions) && (
                                <span className="text-gray-500"> — {lang === 'th' ? (ss.instructionsTh || ss.instructions) : (ss.instructions || ss.instructionsTh)}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </td>
                    <td className="border p-2 text-center align-top">
                      <Badge variant={
                        step.verifiedAt ? 'primary' :
                        step.isCompleted ? 'secondary' :
                        step.status === 'in_progress' ? 'warning' : 'default'
                      }>
                        {step.verifiedAt ? t('workOrderDetail.stepStatus.verified') : step.isCompleted ? t('workOrderDetail.stepStatus.completed') : step.status || t('workOrderDetail.stepStatus.pending')}
                      </Badge>
                    </td>
                    <td className="border p-2 text-gray-900 text-sm align-top">
                      {(() => {
                        // eBMR audit gap #4 — render actual parameters, falling back
                        // to the expected (BOM template) parameters with a marker so
                        // the reader sees what was supposed to be captured.
                        let actual: Record<string, unknown> | null = null;
                        try {
                          if (step.actualParameters) {
                            actual =
                              typeof step.actualParameters === 'string'
                                ? JSON.parse(step.actualParameters)
                                : step.actualParameters;
                          }
                        } catch {
                          /* keep null */
                        }
                        const cleanedActual: Array<[string, unknown]> = actual
                          ? Object.entries(actual).filter(([k]) => !k.startsWith('_'))
                          : [];
                        let expected: Record<string, unknown> | null = null;
                        try {
                          if (step.expectedParameters) {
                            expected =
                              typeof step.expectedParameters === 'string'
                                ? JSON.parse(step.expectedParameters)
                                : step.expectedParameters;
                          }
                        } catch {
                          /* keep null */
                        }
                        if (cleanedActual.length > 0) {
                          return (
                            <div className="space-y-0.5">
                              {cleanedActual.map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-gray-600">{k}:</span>{' '}
                                  <span className="font-medium">{String(v)}</span>
                                  {expected && expected[k] != null && (
                                    <span className="text-xs text-gray-400 ml-1">
                                      {t('workOrderDetail.ebmr.sopTarget', { value: String(expected[k]) })}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (expected && Object.keys(expected).length > 0) {
                          return (
                            <div className="text-xs text-amber-700">
                              <div className="font-semibold mb-0.5">
                                {t('workOrderDetail.ebmr.sopNotRecorded')}
                              </div>
                              {Object.entries(expected)
                                .filter(([k]) => !k.startsWith('_'))
                                .map(([k, v]) => (
                                  <div key={k} className="text-gray-500">
                                    {t('workOrderDetail.ebmr.sopTargetLine', { key: k, value: String(v) })}
                                  </div>
                                ))}
                            </div>
                          );
                        }
                        return <span className="text-gray-400">-</span>;
                      })()}
                    </td>
                    <td className="border p-2 text-gray-900 text-sm align-top">{step.notes || '-'}</td>
                    <td className="border p-2 text-gray-900 text-sm align-top">
                      {step.operatorName || (step.operatorId ? `User#${step.operatorId}` : '-')}
                      {step.completedAt && <div className="text-xs text-gray-500">{new Date(step.completedAt).toLocaleString('th-TH')}</div>}
                    </td>
                    <td className="border p-2 text-gray-900 text-sm align-top">
                      {step.verifierName || (step.verifierId ? `User#${step.verifierId}` : '-')}
                      {step.verifiedAt && <div className="text-xs text-gray-500">{new Date(step.verifiedAt).toLocaleString('th-TH')}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  // Readable IPC status text (raw values are 'pass'/'fail'/'pending').
  const ipcStatusLabel = (s: string): string => {
    const key = String(s || 'pending').toLowerCase();
    return t(`workOrderDetail.ebmr.ipcStatusValue.${key}` as Parameters<typeof t>[0]);
  };

  // Single-phase IPC card: the outer phase heading already provides grouping,
  // so this renders just the stats row + one table for the tests passed in.
  const renderIpcCard = (tests: any[]) => {
    if (!tests || tests.length === 0) return null;
    const stats = computeIPCStats(tests.map((t: any) => ({ numericResult: t.numericResult })));
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.ipcTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1 text-sm">
              <div className="font-semibold text-gray-800">
                <span className="text-xs text-gray-500">{t('workOrderDetail.ebmr.ipcTestCount', { count: tests.length })}</span>
              </div>
              {stats.count >= 1 && (
                <div className="text-xs text-gray-600 flex gap-3">
                  <span>n={stats.count}</span>
                  {stats.mean != null && (
                    <span>mean={stats.mean.toFixed(2)}</span>
                  )}
                  {stats.stdDev != null && (
                    <span>SD={stats.stdDev.toFixed(3)}</span>
                  )}
                  {stats.min != null && (
                    <span>
                      range={stats.min.toFixed(2)}…{stats.max!.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.ipcTest')}</th>
                  <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.ipcSpec')}</th>
                  <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.ipcValue')}</th>
                  <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.ipcDeviation')}</th>
                  <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.ipcStatus')}</th>
                  <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.ipcTestedBy')}</th>
                  <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.ipcApprovedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test: any) => {
                  const dev = computePercentDeviation(
                    test.numericResult,
                    test.specMinValue,
                    test.specMaxValue,
                  );
                  return (
                    <tr key={test.id}>
                      <td className="border p-2 text-gray-900">
                        {test.testName || `IPC-${test.id}`}
                      </td>
                      <td className="border p-2 text-gray-900">
                        {test.specMinValue != null && test.specMaxValue != null
                          ? `${test.specMinValue}–${test.specMaxValue} ${test.specUnit || ''}`
                          : formatQcSpec(test.specSpecification)}
                      </td>
                      <td className="border p-2 text-right text-gray-900 font-medium">
                        {test.numericResult ?? test.result ?? '-'}{' '}
                        {test.specUnit || ''}
                      </td>
                      <td className="border p-2 text-right text-gray-900">
                        {dev != null ? (
                          <span
                            className={
                              Math.abs(dev) > 5
                                ? 'text-amber-600 font-semibold'
                                : 'text-gray-700'
                            }
                          >
                            {dev > 0 ? '+' : ''}
                            {dev.toFixed(2)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border p-2 text-center">
                        <Badge
                          variant={
                            test.status === 'pass'
                              ? 'primary'
                              : test.status === 'fail'
                                ? 'danger'
                                : 'default'
                          }
                        >
                          {ipcStatusLabel(test.status)}
                        </Badge>
                      </td>
                      <td className="border p-2 text-gray-900 text-sm">
                        {test.testedByName || '-'}
                      </td>
                      <td className="border p-2 text-gray-900 text-sm">
                        {test.approvedByName || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQcCard = (tests: typeof ebmr.qcTests) => {
    if (!tests || tests.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.qcSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="ebmr-print-title-row">
                <th colSpan={7}>{t('workOrderDetail.ebmr.qcSummary')}</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.qcCode')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.qcTestName')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.qcType')}</th>
                <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.qcValue')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.qcSpecRange')}</th>
                <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.qcResult')}</th>
                <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.qcTestedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test: any, index: number) => {
                const value =
                  test.numericResult != null
                    ? `${test.numericResult} ${test.specUnit || ''}`.trim()
                    : test.result || '-';
                const specRange =
                  test.specMinValue != null && test.specMaxValue != null
                    ? `${test.specMinValue}–${test.specMaxValue} ${test.specUnit || ''}`.trim()
                    : formatQcSpec(test.specSpecification);
                return (
                  <tr key={index}>
                    <td className="border p-2 text-gray-900">{test.testCode}</td>
                    <td className="border p-2 text-gray-900">
                      {test.testName || '-'}
                    </td>
                    <td className="border p-2 text-gray-900 capitalize">
                      {test.testType?.replace(/_/g, ' ') || '-'}
                    </td>
                    <td className="border p-2 text-right text-gray-900 font-medium">
                      {value}
                    </td>
                    <td className="border p-2 text-gray-900">{specRange}</td>
                    <td className="border p-2 text-center">
                      <Badge variant={getStatusVariant(test.result)}>
                        {test.result || test.status}
                      </Badge>
                    </td>
                    <td className="border p-2 text-gray-900">
                      {test.testedAt
                        ? new Date(test.testedAt).toLocaleString('th-TH')
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderFinishedPhotosCard = (photos: typeof ebmr.finishedPhotos) => {
    if (!photos || photos.length === 0) return null;
    return (
      <Card className="ebmr-section-with-table" data-has-table="true">
        <CardHeader>
          <CardTitle>{t('workOrderDetail.ebmr.finishedPhotos')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <a
                key={p.id}
                href={`/api/attachments/${p.id}/download?inline=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="block border rounded-lg overflow-hidden bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/attachments/${p.id}/download?inline=1`}
                  alt={p.fileName}
                  className="w-full h-32 object-cover"
                />
                <div className="p-1 text-[10px] text-gray-600 truncate text-center">
                  {p.fileName}
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Build per-phase datasets, then render a heading + its cards for each phase
  // that has any data. Records without an explicit phase are hardcoded.
  const renderPhaseGroups = () => {
    const byPhase = (phase: Phase) => ({
      cleaning: ebmr.cleaningLogs.filter((l: any) => normPhase(l.phase, 'production') === phase),
      env: ebmr.environmentalLogs.filter((l: any) => normPhase(l.phase, 'production') === phase),
      sop: ebmr.sopExecution.filter((s: any) => normPhase(s.phase, 'production') === phase),
      ipc: ebmr.ipcTests.filter((tst: any) => normPhase(tst.ipcPhase, 'production') === phase),
      operations: phase === 'production' ? ebmr.operations : [],
      batchRecords: phase === 'production' ? ebmr.batchRecords : [],
      weighing: phase === 'pre_production' ? ebmr.materialWeighing : [],
      materials: phase === 'pre_production' ? ebmr.materials : [],
      qc: phase === 'inspection' ? ebmr.qcTests : [],
      photos: phase === 'inspection' ? ebmr.finishedPhotos : [],
    });

    return PHASE_ORDER.map((phase) => {
      const d = byPhase(phase);
      const hasData =
        d.operations.length > 0 || d.batchRecords.length > 0 || d.weighing.length > 0 ||
        d.materials.length > 0 || d.cleaning.length > 0 || d.env.length > 0 ||
        d.sop.length > 0 || d.ipc.length > 0 || d.qc.length > 0 || d.photos.length > 0;
      if (!hasData) return null;
      return (
        <div key={phase} className="ebmr-phase-group space-y-6">
          <h3 className="text-lg font-bold text-gray-800 border-l-4 border-emerald-500 pl-3 py-1 mt-2">
            {phaseLabel(phase)}
          </h3>
          {renderOperationsCard(d.operations)}
          {renderBatchRecordsCard(d.batchRecords)}
          {renderWeighingCard(d.weighing)}
          {renderMaterialsCard(d.materials)}
          {renderCleaningCard(d.cleaning)}
          {renderEnvCard(d.env)}
          {renderSopCard(d.sop)}
          {renderIpcCard(d.ipc)}
          {renderQcCard(d.qc)}
          {renderFinishedPhotosCard(d.photos)}
        </div>
      );
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text={t('workOrderDetail.header.back')}
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/production/work-orders')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{t('workOrderDetail.header.title', { woNumber: workOrder.woNumber })}</h1>
              <Badge variant={getStatusVariant(workOrder.status)}>
                {getStatusLabel(workOrder.status)}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">
              {t('workOrderDetail.header.batch', { batch: workOrder.batchNumber || 'N/A' })}
              {workOrder.bomCode && (
                <span className="ml-3">
                  · BOM: <span className="font-mono font-semibold text-emerald-700">{workOrder.bomCode}</span>
                  {workOrder.bomVersion && <span className="text-xs text-gray-500 ml-1">v{workOrder.bomVersion}</span>}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Line Clearance moved into per-card buttons inside ExecutionDashboard
                (cleaning / sop-execution / material-weighing cards). Each card
                gates its own start with a phase-scoped clearance, replacing the
                single WO-level button that used to live here. */}
            {nextStatus && (
              <DxButton
                text={t('workOrderDetail.header.changeStatus', { status: getStatusLabel(nextStatus) })}
                type="default"
                onClick={() => handleStatusChange(nextStatus)}
              />
            )}
            {activeTabIndex === 5 && (
              <DxButton
                text={t('workOrderDetail.header.previewEbmr')}
                icon="eyeopen"
                type="normal"
                stylingMode="outlined"
                onClick={() => setShowPrintPreview(true)}
              />
            )}
            <DxButton
              text={t('workOrderDetail.header.printEbmr')}
              icon="print"
              type="normal"
              stylingMode="outlined"
              onClick={() => window.print()}
            />
          </div>
        </div>

        {/* Status Stepper */}
        <div className="mb-6 no-print">
          <StatusStepper
            title={t('workOrderDetail.header.stepperTitle')}
            steps={[
              { key: 'draft', label: t('workOrderDetail.header.stepDraft') },
              { key: 'released', label: t('workOrderDetail.header.stepReleased') },
              { key: 'in_progress', label: t('workOrderDetail.header.stepInProgress') },
              { key: 'completed', label: t('workOrderDetail.header.stepCompleted') },
              { key: 'closed', label: t('workOrderDetail.header.stepClosed') },
            ]}
            current={String(workOrder.status).toLowerCase()}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('workOrderDetail.summary.plannedQty')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(workOrder.plannedQty) || 0}</p>
              <p className="text-xs text-gray-500">{workOrder.productUnit}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('workOrderDetail.summary.actualQty')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(workOrder.actualQty) || 0}</p>
              <p className="text-xs text-gray-500">{workOrder.productUnit}</p>
            </div>
          </div>
          <div className={`bg-white border border-gray-200 border-l-4 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4 ${summary.yieldPercent && summary.yieldPercent >= 95 ? 'border-l-emerald-500' : summary.yieldPercent && summary.yieldPercent >= 90 ? 'border-l-amber-500' : 'border-l-rose-500'}`}>
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('workOrderDetail.summary.yield')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.yieldPercent ? `${summary.yieldPercent}%` : 'N/A'}
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-4 border-l-gray-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('workOrderDetail.summary.productionTime')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.productionTimeHours ? `${summary.productionTimeHours}h` : 'N/A'}
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-4 border-l-cyan-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('workOrderDetail.summary.qcTesting')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.qcPassCount}/{summary.qcTestCount}
              </p>
              <p className="text-xs text-gray-500">{t('workOrderDetail.summary.passed')}</p>
            </div>
          </div>
        </div>

        {/* Line Clearance Status Card removed — clearance now lives in
            per-card buttons inside ExecutionDashboard (cleaning / sop-execution
            / material-weighing). The single WO-level indicator was replaced. */}
        {false && lineClearanceStatus?.required && workOrder.status === 'released' && (
          <Card className="hidden"><CardContent /></Card>
        )}

        {/* Feature 018: Material Withdrawal Approval panel — screen-only,
            must never appear in the printed eBMR document. */}
        <div className="no-print">
          <WithdrawalPanel
            workOrderId={Number(workOrder.id)}
            workOrderNumber={workOrder.woNumber}
          />
        </div>

        {/* Tabs — lightweight underline bar matching the dashboard's module-KPI
            tabs (clean blue underline on the active tab, no DevExtreme box or
            cross-fade). Plain buttons keep tab switching instant: the body is
            still rendered via the activeTabIndex blocks below, so there's no
            flicker or ghosting when moving between tabs. */}
        <div className="no-print border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-1 min-w-max" role="tablist">
            {tabs.map((tab, index) => {
              const active = activeTabIndex === index;
              return (
                <button
                  key={tab.text}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTabIndex(index)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 focus:outline-none ${
                    active
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  data-testid={`wo-tab-${index}`}
                >
                  <tab.Icon className="h-4 w-4" />
                  <span>{tab.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTabIndex === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workOrderDetail.overview.productInfo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.productCode')}</dt>
                    <dd className="font-medium">{workOrder.productCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.productName')}</dt>
                    <dd className="font-medium">{workOrder.productName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.batchNumber')}</dt>
                    <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.unit')}</dt>
                    <dd className="font-medium">{workOrder.productUnit}</dd>
                  </div>
                  {workOrder.bomCode && (
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.bom')}</dt>
                      <dd className="font-medium">
                        <span className="font-mono text-emerald-700">{workOrder.bomCode}</span>
                        {workOrder.bomVersion && (
                          <span className="text-xs text-gray-500 ml-2">v{workOrder.bomVersion}</span>
                        )}
                        {workOrder.bomName && (
                          <span className="text-sm text-gray-700 ml-2">— {workOrder.bomName}</span>
                        )}
                      </dd>
                    </div>
                  )}
                  {workOrder.ttmtCode && (
                    <div>
                      <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.ttmtCode')}</dt>
                      <dd className="font-medium text-green-700">{workOrder.ttmtCode}</dd>
                    </div>
                  )}
                  {workOrder.drugCode24 && (
                    <div>
                      <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.drugCode24')}</dt>
                      <dd className="font-medium text-emerald-700">{workOrder.drugCode24}</dd>
                    </div>
                  )}
                  {workOrder.gRegNumber && (
                    <div>
                      <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.gRegNumber')}</dt>
                      <dd className="font-medium text-purple-700">{workOrder.gRegNumber}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Assigned Team */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-600" />
                  {t('workOrderDetail.overview.assignedTeam')}
                  {assignees.length > 0 && (
                    <span className="text-xs text-gray-500 font-normal">({assignees.length})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignees.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">{t('workOrderDetail.overview.noAssignees')}</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {assignees.map((a) => {
                      const roleColor = ROLE_COLOR[a.role] || 'bg-gray-100 text-gray-700';
                      const knownRoles = ['operator', 'supervisor', 'qa_verifier', 'ipc_checker', 'pharmacist'];
                      const roleLabel = knownRoles.includes(a.role) ? t(`workOrderDetail.roles.${a.role}`) : a.role;
                      return (
                        <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {a.employeeFirstName} {a.employeeLastName}
                              <span className="ml-2 text-xs text-gray-500 font-normal font-mono">
                                {a.employeeCode}
                              </span>
                            </p>
                            {a.positionTitle && (
                              <p className="text-xs text-gray-500 truncate">{a.positionTitle}</p>
                            )}
                            {a.notes && (
                              <p className="text-xs text-gray-400 italic mt-0.5">{a.notes}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${roleColor}`}>
                            {roleLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workOrderDetail.overview.timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.plannedStart')}</dt>
                    <dd className="font-medium">
                      {workOrder.plannedStartDate ? new Date(workOrder.plannedStartDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.plannedEnd')}</dt>
                    <dd className="font-medium">
                      {workOrder.plannedEndDate ? new Date(workOrder.plannedEndDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.actualStart')}</dt>
                    <dd className="font-medium">
                      {workOrder.actualStartDate ? new Date(workOrder.actualStartDate).toLocaleString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.actualEnd')}</dt>
                    <dd className="font-medium">
                      {workOrder.actualEndDate ? new Date(workOrder.actualEndDate).toLocaleString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <dt className="text-sm text-gray-500">{t('workOrderDetail.overview.deliveryDate')}</dt>
                    <dd className={`font-medium text-lg ${workOrder.deliveryDate && new Date(workOrder.deliveryDate) < new Date(new Date().toDateString()) ? 'text-red-600' : 'text-orange-700'}`}>
                      {workOrder.deliveryDate ? new Date(workOrder.deliveryDate).toLocaleDateString('th-TH') : '-'}
                      {workOrder.deliveryDate && new Date(workOrder.deliveryDate) < new Date(new Date().toDateString()) && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <AlertCircle className="w-3 h-3" />
                          {t('workOrderDetail.overview.overdue')}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('workOrderDetail.overview.notes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{workOrder.notes || t('workOrderDetail.overview.noNotes')}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTabIndex === 1 && (
          <div className="no-print">
            <SectionErrorBoundary label="Execution">
              <ExecutionDashboard workOrderId={workOrder.id} />
            </SectionErrorBoundary>
          </div>
        )}

        {activeTabIndex === 2 && (
          <Card className="no-print">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('workOrderDetail.materials.title')}</CardTitle>
                <DxButton
                  text={t('workOrderDetail.materials.add')}
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setItemSearchDialogOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={materials}
                keyExpr="id"
                columns={materialsColumns}
                showBorders
                rowAlternationEnabled
                noDataText={t('workOrderDetail.materials.noData')}
              />
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 3 && (
          <Card className="no-print">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('workOrderDetail.qc.title')}</CardTitle>
                <DxButton
                  text={t('workOrderDetail.qc.add')}
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setQcDialogOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={qcTests}
                keyExpr="id"
                columns={qcTestsColumns}
                showBorders
                rowAlternationEnabled
                noDataText={t('workOrderDetail.qc.noData')}
              />
            </CardContent>
          </Card>
        )}

        {/* eBMR Tab Content - always rendered so print works from any tab */}
        {activeTabIndex === 4 && (
          <Card className="no-print">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {t('workOrderDetail.deviations.title')}
                  {deviations.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                      {deviations.length}
                    </span>
                  )}
                </CardTitle>
                <DxButton
                  text={t('workOrderDetail.deviations.openLink')}
                  icon="link"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => router.push(`/quality/deviations?workOrderId=${params.id}`)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {deviations.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  {t('workOrderDetail.deviations.empty')}
                  <p className="text-xs text-gray-400 mt-1">
                    {t('workOrderDetail.deviations.emptyHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deviations.map((d) => {
                    const sev = d.severity || 'minor';
                    const sevColor = sev === 'critical' ? 'bg-red-100 text-red-800'
                      : sev === 'major' ? 'bg-orange-100 text-orange-800'
                      : 'bg-amber-100 text-amber-800';
                    const statusColor = d.status === 'closed' ? 'bg-emerald-100 text-emerald-700'
                      : d.status === 'resolved' ? 'bg-emerald-100 text-emerald-700'
                      : d.status === 'investigating' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-rose-100 text-rose-700';
                    return (
                      <div
                        key={d.id}
                        onClick={() => router.push(`/quality/deviations/${d.id}`)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-emerald-100 bg-white hover:border-rose-300 hover:bg-rose-50/30 cursor-pointer transition-colors"
                      >
                        <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-rose-700">{d.deviationNumber}</span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${sevColor}`}>{sev}</span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${statusColor}`}>{d.status}</span>
                            {d.type && (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">{d.type}</span>
                            )}
                          </div>
                          {d.title && (
                            <p className="text-sm text-gray-800 mt-1 truncate" title={d.title}>{d.title}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {d.sourceType && <span>{t('workOrderDetail.deviations.source', { source: d.sourceType })}</span>}
                            {d.reportedAt && <span> · {t('workOrderDetail.deviations.reportedAt', { date: new Date(d.reportedAt).toLocaleString('th-TH') })}</span>}
                          </p>
                        </div>
                        <span className="text-xs text-rose-600 flex-shrink-0">{t('workOrderDetail.deviations.viewDetails')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* eBMR content is always mounted (only CSS-hidden) so Print works from
            any tab — which means a render issue here would otherwise crash the
            whole page even on other tabs. Isolate it. */}
        <SectionErrorBoundary label="eBMR">
        <div className={`space-y-6 ${activeTabIndex !== 5 ? 'hidden' : ''}`} id="ebmr-content">
          {/* Print-only document header */}
          <div className="print-only ebmr-print-header">
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">{t('workOrderDetail.ebmr.companyName')}</h1>
              <p className="text-sm text-gray-600">{t('workOrderDetail.ebmr.companyNameEn')}</p>
              <h2 className="text-lg font-bold text-gray-800 mt-2">{t('workOrderDetail.ebmr.docTitle')}</h2>
              <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.docSubtitle')}</p>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3 text-xs border-t pt-2">
              <div><span className="text-gray-500">{t('workOrderDetail.ebmr.woNumber')}</span> <strong className="text-gray-900">{workOrder.woNumber}</strong></div>
              <div><span className="text-gray-500">{t('workOrderDetail.ebmr.batchNumber')}</span> <strong className="text-gray-900">{ebmr.batchNumber || 'N/A'}</strong></div>
              <div><span className="text-gray-500">{t('workOrderDetail.ebmr.product')}</span> <strong className="text-gray-900">{ebmr.productCode} - {ebmr.productName}</strong></div>
              <div><span className="text-gray-500">{t('workOrderDetail.ebmr.printDate')}</span> <strong className="text-gray-900">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
            </div>
          </div>

          {/* eBMR Header */}
            <Card>
              <CardHeader>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900">{t('workOrderDetail.ebmr.docTitle')}</h2>
                  <p className="text-gray-600">{t('workOrderDetail.ebmr.headerSubtitle')}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.batchNumberLabel')}</p>
                    <p className="font-bold text-lg text-gray-900">{ebmr.batchNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.productLabel')}</p>
                    <p className="font-bold text-gray-900">{ebmr.productCode}</p>
                    <p className="text-sm text-gray-700">{ebmr.productName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.status')}</p>
                    <Badge variant={getStatusVariant(ebmr.status)} className="text-lg">
                      {getStatusLabel(ebmr.status)}
                    </Badge>
                  </div>
                </div>
                {(ebmr.ttmtCode || ebmr.drugCode24 || ebmr.gRegNumber) && (
                  <div className="grid grid-cols-3 gap-4 border border-t-0 p-4 rounded-b-lg -mt-1">
                    {ebmr.ttmtCode && (
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.ttmtCode')}</p>
                        <p className="font-semibold text-green-700 break-all">{ebmr.ttmtCode}</p>
                      </div>
                    )}
                    {ebmr.drugCode24 && (
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.drugCode24')}</p>
                        <p className="font-semibold text-emerald-700 break-all">{ebmr.drugCode24}</p>
                      </div>
                    )}
                    {ebmr.gRegNumber && (
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">{t('workOrderDetail.ebmr.gRegNumber')}</p>
                        <p className="font-semibold text-purple-700 break-all">{ebmr.gRegNumber}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ════════ eBMR GMP Sections 2–6 (Formula / Requisition / Personnel / Health / Gowning) ════════ */}

            {/* (2) สูตรที่ใช้ในการผลิต — Formula / BOM */}
            <Card className="ebmr-section-with-table" data-has-table="true">
              <CardHeader>
                <CardTitle>
                  {t('workOrderDetail.ebmr.formula')}
                  {ebmr.bomCode && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {ebmr.bomCode}{ebmr.bomVersion ? ` v${ebmr.bomVersion}` : ''}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ebmr.bomLines.length > 0 ? (
                  <table className="w-full border-collapse border text-xs">
                    <thead>
                      <tr className="ebmr-print-title-row"><th colSpan={5}>{t('workOrderDetail.ebmr.formula')}</th></tr>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.formulaSeq')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.formulaItem')}</th>
                        <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.formulaQty')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.formulaUnit')}</th>
                        <th className="border p-2 text-right text-gray-700">{t('workOrderDetail.ebmr.formulaPercent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebmr.bomLines.map((line: any, i: number) => (
                        <tr key={i}>
                          <td className="border p-2 text-gray-900">{line.sequence ?? i + 1}</td>
                          <td className="border p-2 text-gray-900">
                            {line.itemCode ? `${line.itemCode} — ` : ''}{line.itemName || '-'}
                            {line.isOptional ? <span className="text-xs text-gray-400 ml-1">({t('workOrderDetail.ebmr.formulaOptional')})</span> : null}
                          </td>
                          <td className="border p-2 text-right text-gray-900">{line.quantity ?? '-'}</td>
                          <td className="border p-2 text-gray-900">{line.unit || '-'}</td>
                          <td className="border p-2 text-right text-gray-900">{line.percentageInFormula != null ? `${line.percentageInFormula}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">{t('workOrderDetail.ebmr.noData')}</p>
                )}
              </CardContent>
            </Card>

            {/* (4) รายชื่อพนักงานและผู้ตรวจสอบ — Personnel roster */}
            <Card className="ebmr-section-with-table" data-has-table="true">
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.personnel')}</CardTitle>
              </CardHeader>
              <CardContent>
                {ebmr.assignees.length > 0 ? (
                  <table className="w-full border-collapse border text-xs">
                    <thead>
                      <tr className="ebmr-print-title-row"><th colSpan={4}>{t('workOrderDetail.ebmr.personnel')}</th></tr>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.personnelCode')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.personnelName')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.personnelPosition')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.personnelRole')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebmr.assignees.map((a: any, i: number) => (
                        <tr key={i}>
                          <td className="border p-2 text-gray-900">{a.employeeCode || '-'}</td>
                          <td className="border p-2 text-gray-900">{[a.firstName, a.lastName].filter(Boolean).join(' ') || '-'}</td>
                          <td className="border p-2 text-gray-900">{a.positionTitle || '-'}</td>
                          <td className="border p-2 text-gray-900">
                            {(() => { try { return t(`workOrderDetail.roles.${a.role}` as Parameters<typeof t>[0]); } catch { return a.role; } })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">{t('workOrderDetail.ebmr.noData')}</p>
                )}
              </CardContent>
            </Card>

            {/* (5) การตรวจสุขภาพและความพร้อมของพนักงาน — Staff health check */}
            <Card className="ebmr-section-with-table" data-has-table="true">
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.health')}</CardTitle>
              </CardHeader>
              <CardContent>
                {ebmr.assignees.length > 0 ? (
                  <table className="w-full border-collapse border text-xs">
                    <thead>
                      <tr className="ebmr-print-title-row"><th colSpan={5}>{t('workOrderDetail.ebmr.health')}</th></tr>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.personnelName')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.healthExamDate')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.healthFitness')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.healthRestrictions')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.healthNextDue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebmr.assignees.map((a: any, i: number) => {
                        const hc = ebmr.healthChecks.find((h: any) => Number(h.employeeId) === Number(a.employeeId));
                        const fit = hc?.fitnessStatus;
                        const fitCls = fit === 'fit' ? 'bg-green-100 text-green-700'
                          : fit === 'restricted' ? 'bg-amber-100 text-amber-700'
                          : fit === 'unfit' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500';
                        return (
                          <tr key={i}>
                            <td className="border p-2 text-gray-900">{[a.firstName, a.lastName].filter(Boolean).join(' ') || '-'}</td>
                            <td className="border p-2 text-gray-900">{hc?.examinationDate || t('workOrderDetail.ebmr.noData')}</td>
                            <td className="border p-2 text-center">
                              {fit ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${fitCls}`}>
                                  {(() => { try { return t(`workOrderDetail.ebmr.fitness.${fit}` as Parameters<typeof t>[0]); } catch { return fit; } })()}
                                </span>
                              ) : <span className="text-gray-400">{t('workOrderDetail.ebmr.noData')}</span>}
                            </td>
                            <td className="border p-2 text-gray-900">{hc?.restrictions || '-'}</td>
                            <td className="border p-2 text-gray-900">{hc?.nextExamDue || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">{t('workOrderDetail.ebmr.noData')}</p>
                )}
              </CardContent>
            </Card>

            {/* (6) การตรวจสอบการแต่งกาย — Gowning verification */}
            <Card className="ebmr-section-with-table" data-has-table="true">
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.gowning')}</CardTitle>
              </CardHeader>
              <CardContent>
                {ebmr.gowning.length > 0 ? (
                  <table className="w-full border-collapse border text-xs">
                    <thead>
                      <tr className="ebmr-print-title-row"><th colSpan={9}>{t('workOrderDetail.ebmr.gowning')}</th></tr>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.gowningGownClean')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningGlovesOn')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningMaskOn')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningHairnetOn')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningShoeCoverOn')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningHandsSanitized')}</th>
                        <th className="border p-2 text-center text-gray-700">{t('workOrderDetail.ebmr.gowningStatus')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.gowningPerformedBy')}</th>
                        <th className="border p-2 text-left text-gray-700">{t('workOrderDetail.ebmr.gowningVerifiedBy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebmr.gowning.map((g: any, i: number) => {
                        const yn = (v: boolean) => v ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-500 font-bold">✗</span>;
                        return (
                          <tr key={i}>
                            <td className="border p-2 text-center">{yn(g.gownClean)}</td>
                            <td className="border p-2 text-center">{yn(g.glovesOn)}</td>
                            <td className="border p-2 text-center">{yn(g.maskOn)}</td>
                            <td className="border p-2 text-center">{yn(g.hairnetOn)}</td>
                            <td className="border p-2 text-center">{yn(g.shoeCoverOn)}</td>
                            <td className="border p-2 text-center">{yn(g.handsSanitized)}</td>
                            <td className="border p-2 text-center">
                              <Badge variant={g.status === 'verified' ? 'primary' : g.status === 'rejected' ? 'danger' : 'default'}>
                                {(() => { try { return t(`gowning.status.${g.status}` as Parameters<typeof t>[0]); } catch { return g.status; } })()}
                              </Badge>
                            </td>
                            <td className="border p-2 text-gray-900">{g.performerName || '-'}{g.performedAt ? ` · ${new Date(g.performedAt).toLocaleString('th-TH')}` : ''}</td>
                            <td className="border p-2 text-gray-900">{g.verifierName || '-'}{g.verifiedAt ? ` · ${new Date(g.verifiedAt).toLocaleString('th-TH')}` : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">{t('workOrderDetail.ebmr.noData')}</p>
                )}
              </CardContent>
            </Card>

            {/* ════════ Section 7: การบันทึกการผลิต (run overview + execution records by phase) ════════ */}

            {/* Production Summary — audit gap #1: Bulk Yield + Loss breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.productionSummary')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.plannedQty')}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {ebmr.plannedQty} {ebmr.productUnit || ''}
                    </p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.bulkOutput')}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {ebmr.bulkOutputQty != null
                        ? <>{ebmr.bulkOutputQty} {ebmr.productUnit || ''}</>
                        : '-'}
                    </p>
                    {ebmr.bulkYieldPercent != null && (
                      <p className={`text-xs mt-0.5 ${ebmr.bulkYieldPercent >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                        {t('workOrderDetail.ebmr.bulkYield', { percent: ebmr.bulkYieldPercent })}
                      </p>
                    )}
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.finishedOutput')}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {ebmr.finishedOutputQty != null
                        ? <>{ebmr.finishedOutputQty} {ebmr.productUnit || ''}</>
                        : ebmr.actualQty || '-'}
                    </p>
                    {ebmr.yieldPercent != null && (
                      <p className={`text-xs mt-0.5 ${ebmr.yieldPercent >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                        {t('workOrderDetail.ebmr.finalYield', { percent: ebmr.yieldPercent })}
                      </p>
                    )}
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.productionTime')}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {ebmr.productionTimeHours ? `${ebmr.productionTimeHours}h` : '-'}
                    </p>
                  </div>
                </div>

                {/* Loss breakdown */}
                {(ebmr.totalLossQty != null || ebmr.packagingLossQty != null) && (
                  <div className="mt-3 border rounded-lg bg-amber-50/40 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">{t('workOrderDetail.ebmr.lossBreakdown')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {ebmr.packagingLossQty != null && (
                        <div>
                          <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.packagingLoss')}</p>
                          <p className="font-semibold text-gray-900">
                            {ebmr.packagingLossQty} {ebmr.productUnit || ''}
                            {ebmr.packagingLossPercent != null && (
                              <span className="text-xs text-amber-600 ml-1">
                                ({ebmr.packagingLossPercent}%)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      {ebmr.totalLossQty != null && (
                        <div>
                          <p className="text-xs text-gray-500">{t('workOrderDetail.ebmr.totalLoss')}</p>
                          <p className="font-semibold text-gray-900">
                            {ebmr.totalLossQty} {ebmr.productUnit || ''}
                            {ebmr.totalLossPercent != null && (
                              <span className="text-xs text-amber-600 ml-1">
                                ({ebmr.totalLossPercent}%)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.productionTimeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border p-3 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">{t('workOrderDetail.ebmr.planned')}</p>
                    <p className="text-gray-900">{t('workOrderDetail.ebmr.start', { value: ebmr.timeline.plannedStart ? new Date(ebmr.timeline.plannedStart).toLocaleString('th-TH') : '-' })}</p>
                    <p className="text-gray-900">{t('workOrderDetail.ebmr.end', { value: ebmr.timeline.plannedEnd ? new Date(ebmr.timeline.plannedEnd).toLocaleString('th-TH') : '-' })}</p>
                  </div>
                  <div className="border p-3 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">{t('workOrderDetail.ebmr.actual')}</p>
                    <p className="text-gray-900">{t('workOrderDetail.ebmr.start', { value: ebmr.timeline.actualStart ? new Date(ebmr.timeline.actualStart).toLocaleString('th-TH') : '-' })}</p>
                    <p className="text-gray-900">{t('workOrderDetail.ebmr.end', { value: ebmr.timeline.actualEnd ? new Date(ebmr.timeline.actualEnd).toLocaleString('th-TH') : '-' })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ════════ Production Records grouped by phase ════════ */}
            {renderPhaseGroups()}


            {/* Signatures — audit gap #6 — explicit Produced/QC/QA signatures + QA sign action */}
            <Card id="ebmr-signatures">
              <CardHeader>
                <CardTitle>{t('workOrderDetail.ebmr.signatures')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    { key: 'producedBy', label: t('workOrderDetail.ebmr.sigProducedBy') },
                    { key: 'verifiedByQc', label: t('workOrderDetail.ebmr.sigVerifiedByQc') },
                    { key: 'approvedByQa', label: t('workOrderDetail.ebmr.sigApprovedByQa') },
                  ] as const).map(({ key, label }) => {
                    const sig = ebmr.signatures?.[key];
                    return (
                      <div key={key} className="border p-4 rounded-lg text-center">
                        <p className="text-sm text-gray-500 mb-8">{label}</p>
                        <div className="border-t pt-2">
                          <p className="text-sm text-gray-900">
                            {t('workOrderDetail.ebmr.sigName', { value: sig?.name || '_________________' })}
                          </p>
                          <p className="text-sm text-gray-900">
                            {t('workOrderDetail.ebmr.sigDate', { value: sig?.signedAt
                              ? new Date(sig.signedAt).toLocaleString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '_________________' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* QA sign-off button — visible when there's no QA signature yet and
                    the WO is at least 'completed' (preconditions enforced server-side) */}
                {!ebmr.signatures?.approvedByQa &&
                  ['completed', 'closed'].includes(workOrder.status as string) && (
                    <div className="mt-4 flex justify-end print:hidden">
                      <DxButton
                        text={t('workOrderDetail.ebmr.qaApprove')}
                        type="success"
                        onClick={async () => {
                          if (!confirm(t('workOrderDetail.toast.confirmQaApprove'))) return;
                          const res = await fetch(
                            `/api/production/work-orders/${workOrder.id}/qa-approve`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ notes: null }),
                            },
                          );
                          const json = await res.json();
                          if (!res.ok) {
                            toast.error(t('workOrderDetail.toast.approveFailed'), json?.error);
                          } else {
                            toast.success(t('workOrderDetail.toast.qaSigned'), t('workOrderDetail.toast.ebmrLocked'));
                            await fetchWorkOrderDetail();
                          }
                        }}
                        data-testid="ebmr-qa-approve"
                      />
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Print-only footer */}
            <div className="print-only ebmr-print-footer">
              <p>{t('workOrderDetail.ebmr.footerPrintedFrom', { date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</p>
              <p className="mt-1">{t('workOrderDetail.ebmr.footerNote')}</p>
            </div>
        </div>
        </SectionErrorBoundary>

        {/* In-app A4 print preview overlay — renders #ebmr-content (the same
            DOM that prints) as A4 pages on a gray backdrop, with zoom + print
            controls. Toggled by the ebmr-preview-active body class (see
            globals.css). Lets users WYSIWYG-review before printing without the
            browser's confusing print-preview pager. */}
        {showPrintPreview && (
          <EbmrPrintPreviewOverlay onClose={() => setShowPrintPreview(false)} />
        )}

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={itemSearchDialogOpen}
        onOpenChange={setItemSearchDialogOpen}
        onSelect={handleSelectItem}
        title={t('workOrderDetail.dialogs.selectMaterial')}
        excludeType="finished_goods"
        allowCreate
      />

      {/* Material Details Dialog */}
      <DxPopup
        visible={materialDetailsDialogOpen}
        onHiding={() => { setMaterialDetailsDialogOpen(false); resetMaterialForm(); }}
        title={t('workOrderDetail.dialogs.materialDetails')}
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          {/* Selected Item Display */}
          {selectedItem && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div>
                <p className="font-medium text-emerald-800">{selectedItem.code}</p>
                <p className="text-sm text-emerald-600">{selectedItem.nameTh}</p>
              </div>
              <DxButton
                text={t('workOrderDetail.dialogs.change')}
                type="normal"
                stylingMode="outlined"
                onClick={() => {
                  setMaterialDetailsDialogOpen(false);
                  setItemSearchDialogOpen(true);
                }}
              />
            </div>
          )}

          {/* Lot Selection */}
          {selectedItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrderDetail.dialogs.lotOptional')}
              </label>
              {lots.length > 0 ? (
                <DxSelectBox
                  items={lots.map(lot => ({
                    id: lot.id,
                    label: t('workOrderDetail.dialogs.lotBalance', {
                      lotNumber: lot.lotNumber,
                      balance: Number(lot.quantity) - Number(lot.reservedQuantity || 0),
                      unit: lot.unit,
                    }) + (lot.expiryDate ? t('workOrderDetail.dialogs.lotExpiry', { date: new Date(lot.expiryDate).toLocaleDateString() }) : '')
                  }))}
                  value={selectedLot?.id || null}
                  onValueChange={(value) => {
                    const lot = lots.find((l) => l.id === value);
                    setSelectedLot(lot || null);
                  }}
                  valueExpr="id"
                  displayExpr="label"
                  placeholder={t('workOrderDetail.dialogs.selectLotPlaceholder')}
                />
              ) : (
                <p className="text-sm text-gray-500 p-2 bg-gray-50 rounded">{t('workOrderDetail.dialogs.noLots')}</p>
              )}
            </div>
          )}

          {/* Quantities */}
          {selectedItem && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('workOrderDetail.dialogs.plannedQty')} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 items-center">
                  <DxNumberBox
                    value={plannedQuantity}
                    onValueChange={(value) => setPlannedQuantity(value || 0)}
                    format="#,##0.###"
                  />
                  <span className="text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('workOrderDetail.dialogs.actualQty')}
                </label>
                <div className="flex gap-2 items-center">
                  <DxNumberBox
                    value={actualQuantity}
                    onValueChange={(value) => setActualQuantity(value || 0)}
                    format="#,##0.###"
                  />
                  <span className="text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text={t('workOrderDetail.dialogs.cancel')}
              type="normal"
              stylingMode="outlined"
              onClick={() => { setMaterialDetailsDialogOpen(false); resetMaterialForm(); }}
            />
            <DxButton
              text={addingMaterial ? t('workOrderDetail.dialogs.adding') : t('workOrderDetail.dialogs.addMaterial')}
              type="default"
              onClick={handleAddMaterial}
              disabled={!selectedItem || !plannedQuantity || addingMaterial}
            />
          </div>
        </div>
      </DxPopup>

      {/* Add QC Test Dialog */}
      <DxPopup
        visible={qcDialogOpen}
        onHiding={() => { setQcDialogOpen(false); resetQCForm(); }}
        title={t('workOrderDetail.dialogs.addQcTitle')}
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            {t('workOrderDetail.dialogs.qcIntro')}
          </p>

          {productSpecs.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('workOrderDetail.dialogs.specification')} <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                items={productSpecs.map((spec) => ({
                  value: spec.id,
                  label: `${spec.testName}${spec.specification ? ` (${spec.specification})` : ''}`,
                  testMethod: spec.testMethod,
                }))}
                value={selectedSpecId}
                onValueChange={(val) => {
                  setSelectedSpecId(val);
                  const spec = productSpecs.find(s => s.id === val);
                  if (spec) {
                    setTestType(spec.testName);
                    setTestMethod(spec.testMethod || '');
                  }
                }}
                valueExpr="value"
                displayExpr="label"
                placeholder={t('workOrderDetail.dialogs.selectTestPlaceholder')}
                searchEnabled
              />
              {selectedSpecId && (() => {
                const spec = productSpecs.find(s => s.id === selectedSpecId);
                if (!spec) return null;
                return (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                    {spec.testMethod && <p>{t('workOrderDetail.dialogs.method', { value: spec.testMethod })}</p>}
                    {spec.specification && <p>{t('workOrderDetail.dialogs.spec', { value: spec.specification })}</p>}
                    {(spec.minValue !== null || spec.maxValue !== null) && (
                      <p>{t('workOrderDetail.dialogs.range', { min: spec.minValue ?? '-', max: spec.maxValue ?? '-', unit: spec.unit || '' })}</p>
                    )}
                    {spec.isCritical && <p className="text-red-600 font-medium">{t('workOrderDetail.dialogs.criticalTest')}</p>}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              {t('workOrderDetail.dialogs.noSpecs')}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('workOrderDetail.dialogs.notes')}
            </label>
            <DxTextArea
              value={testNotes}
              onValueChange={setTestNotes}
              placeholder={t('workOrderDetail.dialogs.notesPlaceholder')}
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text={t('workOrderDetail.dialogs.cancel')}
              type="normal"
              stylingMode="outlined"
              onClick={() => { setQcDialogOpen(false); resetQCForm(); }}
            />
            <DxButton
              text={addingQCTest ? t('workOrderDetail.dialogs.adding') : t('workOrderDetail.dialogs.addQcTest')}
              type="default"
              onClick={handleAddQCTest}
              disabled={(!selectedSpecId && !testType) || addingQCTest}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
