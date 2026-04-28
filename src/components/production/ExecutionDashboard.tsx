'use client';

/**
 * Reusable Execution Dashboard Component
 * Shows execution sections grouped by phase with progress bars
 * Used in both WO detail page (Execution tab) and standalone execution page
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardCheck,
  Thermometer,
  Scale,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ClipboardList,
  FlaskConical,
  Lock,
  Boxes,
} from 'lucide-react';

interface ExecutionSummary {
  workOrderStatus?: string;
  materialWeighing: { total: number; completed: number; verified: number };
  preProductionCleaning: { total: number; completed: number; verified: number };
  preProductionEnvironmental: { total: number; recorded: number; normal: number };
  productionCleaning?: { total: number; completed: number; verified: number };
  sopExecution: { total: number; completed: number; verified: number };
  productionEnvironmental: { total: number; recorded: number; normal: number };
  productionOutput: { recorded: boolean; actualQuantity: number | null; yieldPercent: number | null };
  bulkOutput?: { recorded: boolean; quantity: number | null; recordedAt: string | null };
  finishedOutput?: { recorded: boolean; quantity: number | null; recordedAt: string | null };
  postProductionCleaning: { total: number; completed: number; verified: number };
  prePackagingCleaning: { total: number; completed: number; verified: number };
  packagingCleaning?: { total: number; completed: number; verified: number };
  packagingWeight: { total: number; passed: number };
  packagingIntegrity: { total: number; passed: number };
  packagingEnvironmental: { total: number; recorded: number; normal: number };
  finishedInspection: { status: 'pending' | 'in_progress' | 'passed' | 'failed' };
  ipc: { total: number; completed: number; approved: number };
  // Per-phase breakdowns — drive dynamic SOP/IPC cards on the dashboard.
  // Phases without items are simply absent (no card rendered).
  sopByPhase?: Record<string, { total: number; completed: number; verified: number }>;
  ipcByPhase?: Record<string, { total: number; completed: number; approved: number }>;
  materialRequisition: {
    status: 'none' | 'requested' | 'approved';
    requestedBy: number | null;
    requestedAt: string | null;
    approvedBy: number | null;
    approvedAt: string | null;
    requestedByName?: string;
    approvedByName?: string;
  };
}

interface ExecutionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
  phase: 'pre_production' | 'production' | 'post_production' | 'pre_packaging' | 'packaging' | 'inspection';
  description: string;
  getStatus: (summary: ExecutionSummary) => { completed: number; verified: number; total: number; status: 'pending' | 'in_progress' | 'completed' | 'verified' };
}

const phaseColors = {
  pre_production: 'bg-amber-100 text-amber-800 border-amber-200',
  production: 'bg-blue-100 text-blue-800 border-blue-200',
  post_production: 'bg-green-100 text-green-800 border-green-200',
  pre_packaging: 'bg-purple-100 text-purple-800 border-purple-200',
  packaging: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  inspection: 'bg-teal-100 text-teal-800 border-teal-200',
};

const phaseLabels = {
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  pre_packaging: 'Pre-Packaging',
  packaging: 'Packaging',
  inspection: 'Inspection',
};

const defaultSummaryValue: ExecutionSummary = {
  workOrderStatus: 'planned',
  materialWeighing: { total: 0, completed: 0, verified: 0 },
  preProductionCleaning: { total: 0, completed: 0, verified: 0 },
  preProductionEnvironmental: { total: 0, recorded: 0, normal: 0 },
  productionCleaning: { total: 0, completed: 0, verified: 0 },
  sopExecution: { total: 0, completed: 0, verified: 0 },
  productionEnvironmental: { total: 0, recorded: 0, normal: 0 },
  productionOutput: { recorded: false, actualQuantity: null, yieldPercent: null },
  bulkOutput: { recorded: false, quantity: null, recordedAt: null },
  finishedOutput: { recorded: false, quantity: null, recordedAt: null },
  postProductionCleaning: { total: 0, completed: 0, verified: 0 },
  prePackagingCleaning: { total: 0, completed: 0, verified: 0 },
  packagingCleaning: { total: 0, completed: 0, verified: 0 },
  packagingWeight: { total: 0, passed: 0 },
  packagingIntegrity: { total: 0, passed: 0 },
  packagingEnvironmental: { total: 0, recorded: 0, normal: 0 },
  finishedInspection: { status: 'pending' },
  ipc: { total: 0, completed: 0, approved: 0 },
  materialRequisition: { status: 'none', requestedBy: null, requestedAt: null, approvedBy: null, approvedAt: null },
};

interface ExecutionDashboardProps {
  workOrderId: number;
}

export function ExecutionDashboard({ workOrderId }: ExecutionDashboardProps) {
  const toast = useToast();
  const t = useTranslations('production');
  const queryClient = useQueryClient();

  // Idempotent BOM↔WO sync on mount. Fires once per WO mount; if the BOM
  // gained new SOP steps or IPC criteria after this WO was initialized
  // (or pre-existing IPC tests are missing ipc_phase from the legacy
  // schema), the sync endpoint inserts what's missing and backfills phases.
  // Operator progress is preserved — no rows updated except NULL phase fill.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/production/work-orders/${workOrderId}/sync-bom`, {
          method: 'POST',
        });
        if (cancelled) return;
        const result = await res.json();
        if (!result.success) return;
        const sopAdded = result.data?.sopInserted ?? 0;
        const ipcAdded = result.data?.ipcInserted ?? 0;
        if (sopAdded > 0 || ipcAdded > 0) {
          // New rows landed — refetch the summary so the new cards appear.
          queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
        }
      } catch {
        // Sync is best-effort; failure must never break the dashboard.
      }
    })();

    return () => { cancelled = true; };
  }, [workOrderId, queryClient]);

  // staleTime:0 + refetchOnMount:'always' overrides the global 60s cache —
  // the user typically clicks into a card, records data, then comes back; if
  // we trusted the cache the dashboard would show pre-record state for up to
  // a minute. refetchOnWindowFocus catches Alt-Tab back from another tab.
  // Realtime events still cover the "two users open at once" case below.
  const { data: summary, isLoading } = useQuery<ExecutionSummary>({
    queryKey: ['wo-execution-summary', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/execution-summary`);
      const data = await res.json();
      if (!data.success) return defaultSummaryValue;
      return data.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Auto-update when another user changes this requisition's status
  // (e.g. warehouse approves on /inventory/lots → status here flips
  // from 'รอคลังอนุมัติ' to 'อนุมัติแล้ว' without manual refresh).
  useRealtimeTopic('requisition-changed', (data) => {
    const eventWorkOrderId = data.workOrderId as number | undefined;
    if (eventWorkOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Phase: any execution sub-section change re-fetches the dashboard summary
  // so progress bars / status pills stay in sync across users.
  useRealtimeTopic('work-order-changed', (data) => {
    const eventWorkOrderId = data.workOrderId as number | undefined;
    if (eventWorkOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  const requisitionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      toast.success('ส่งใบเบิกวัตถุดิบสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Resolve summary up-front so per-phase card generation below has access
  // to sopByPhase / ipcByPhase before sectionsByPhase is built.
  const currentSummary = summary || defaultSummaryValue;

  const executionSections: ExecutionSection[] = [
    {
      id: 'material-requisition',
      title: 'ใบเบิกวัตถุดิบ',
      icon: <ClipboardList className="h-5 w-5" />,
      href: '',
      phase: 'pre_production',
      description: 'ส่งใบเบิกวัตถุดิบให้คลังอนุมัติก่อนชั่ง',
      getStatus: (s) => ({
        completed: s.materialRequisition.status === 'approved' ? 1 : 0,
        verified: s.materialRequisition.status === 'approved' ? 1 : 0,
        total: 1,
        status: s.materialRequisition.status === 'approved' ? 'verified'
          : s.materialRequisition.status === 'requested' ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'pre-production-cleaning',
      title: 'Pre-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=pre_production`,
      phase: 'pre_production',
      description: 'Verify room and equipment cleanliness before production',
      getStatus: (s) => ({
        completed: s.preProductionCleaning.completed,
        verified: s.preProductionCleaning.verified,
        total: s.preProductionCleaning.total,
        status: s.preProductionCleaning.verified === s.preProductionCleaning.total && s.preProductionCleaning.total > 0 ? 'verified'
          : s.preProductionCleaning.completed === s.preProductionCleaning.total && s.preProductionCleaning.total > 0 ? 'completed'
          : s.preProductionCleaning.completed > 0 ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'pre-production-environmental',
      title: 'Environmental Monitoring (Pre-Production)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=pre_production`,
      phase: 'pre_production',
      description: 'Record temperature and humidity before production',
      getStatus: (s) => ({
        completed: s.preProductionEnvironmental?.recorded ?? 0,
        verified: 0,
        total: s.preProductionEnvironmental?.total ?? 0,
        status: (s.preProductionEnvironmental?.recorded ?? 0) >= (s.preProductionEnvironmental?.total ?? 0) && (s.preProductionEnvironmental?.total ?? 0) > 0 ? 'completed'
          : (s.preProductionEnvironmental?.recorded ?? 0) > 0 ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'material-weighing',
      title: 'Material Weighing',
      icon: <Scale className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/material-weighing`,
      phase: 'pre_production',
      description: 'Weigh and verify all raw materials according to BOM',
      getStatus: (s) => ({
        completed: s.materialWeighing.completed,
        verified: s.materialWeighing.verified,
        total: s.materialWeighing.total,
        status: s.materialWeighing.verified === s.materialWeighing.total && s.materialWeighing.total > 0 ? 'verified'
          : s.materialWeighing.completed === s.materialWeighing.total && s.materialWeighing.total > 0 ? 'completed'
          : s.materialWeighing.completed > 0 ? 'in_progress' : 'pending',
      }),
    },
    // SOP cards are generated per-phase from sopByPhase below.
    {
      id: 'production-cleaning',
      title: 'Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=production`,
      phase: 'production',
      description: 'Verify room and equipment cleanliness during production',
      getStatus: (s) => {
        const c = s.productionCleaning ?? { total: 0, completed: 0, verified: 0 };
        return {
          completed: c.completed,
          verified: c.verified,
          total: c.total,
          status: c.verified === c.total && c.total > 0 ? 'verified'
            : c.completed === c.total && c.total > 0 ? 'completed'
            : c.completed > 0 ? 'in_progress' : 'pending',
        };
      },
    },
    // IPC cards are generated per-phase from ipcByPhase below.
    {
      id: 'production-environmental',
      title: 'Environmental Monitoring (Production)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=production`,
      phase: 'production',
      description: 'Record temperature and humidity during production',
      getStatus: (s) => ({
        completed: s.productionEnvironmental.recorded,
        verified: 0,
        total: s.productionEnvironmental.total,
        status: s.productionEnvironmental.recorded >= s.productionEnvironmental.total && s.productionEnvironmental.total > 0 ? 'completed'
          : s.productionEnvironmental.recorded > 0 ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'post-production-cleaning',
      title: 'Post-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=post_production`,
      phase: 'post_production',
      description: 'Clean room and equipment after production',
      getStatus: (s) => ({
        completed: s.postProductionCleaning.completed,
        verified: s.postProductionCleaning.verified,
        total: s.postProductionCleaning.total,
        status: s.postProductionCleaning.verified === s.postProductionCleaning.total && s.postProductionCleaning.total > 0 ? 'verified'
          : s.postProductionCleaning.completed === s.postProductionCleaning.total && s.postProductionCleaning.total > 0 ? 'completed'
          : s.postProductionCleaning.completed > 0 ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'bulk-product-yield',
      title: 'Bulk Product Yield',
      icon: <Package className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/production-output?stage=bulk`,
      phase: 'post_production',
      description: 'บันทึกจำนวนผลิตภัณฑ์บัลก์หลังกระบวนการผลิต ก่อนเข้าสู่การบรรจุภัณฑ์',
      getStatus: (s) => ({
        completed: s.bulkOutput?.recorded ? 1 : 0,
        verified: 0,
        total: 1,
        status: s.bulkOutput?.recorded ? 'completed' : 'pending',
      }),
    },
    {
      id: 'packaging-cleaning',
      title: 'Packaging Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=packaging`,
      phase: 'packaging',
      description: 'Line clearance + packaging area cleanliness',
      getStatus: (s) => {
        const pre = s.prePackagingCleaning ?? { total: 0, completed: 0, verified: 0 };
        const pkg = s.packagingCleaning ?? { total: 0, completed: 0, verified: 0 };
        const total = pre.total + pkg.total;
        const completed = pre.completed + pkg.completed;
        const verified = pre.verified + pkg.verified;
        return {
          completed,
          verified,
          total,
          status: total > 0 && verified === total ? 'verified'
            : total > 0 && completed === total ? 'completed'
            : completed > 0 ? 'in_progress' : 'pending',
        };
      },
    },
    // Packaging Weight Control + Packaging Integrity cards removed — these
    // criteria now live as IPC criteria (phase=packaging) and surface in the
    // per-phase IPC card. Legacy /packaging-qc page remains for viewing
    // historical bom_packaging_qc data but no card links to it.
    {
      id: 'packaging-environmental',
      title: 'Environmental Monitoring (Packaging)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=packaging`,
      phase: 'packaging',
      description: 'Record temperature and humidity during packaging',
      getStatus: (s) => ({
        completed: s.packagingEnvironmental.recorded,
        verified: 0,
        total: s.packagingEnvironmental.total,
        status: s.packagingEnvironmental.recorded >= s.packagingEnvironmental.total && s.packagingEnvironmental.total > 0 ? 'completed'
          : s.packagingEnvironmental.recorded > 0 ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'finished-inspection',
      title: 'Finished Product Inspection',
      icon: <ClipboardCheck className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/finished-inspection`,
      phase: 'inspection',
      description: '15-point inspection checklist',
      getStatus: (s) => ({
        completed: s.finishedInspection.status === 'passed' ? 1 : 0,
        verified: 0,
        total: 1,
        status: s.finishedInspection.status === 'passed' ? 'completed'
          : s.finishedInspection.status === 'in_progress' ? 'in_progress' : 'pending',
      }),
    },
    {
      id: 'production-output',
      title: 'Production Output / Yield',
      icon: <Boxes className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/production-output?stage=finished`,
      phase: 'inspection',
      description: 'บันทึกจำนวนผลิตภัณฑ์สำเร็จรูปหลัง Inspection เพื่อเข้าคลัง FG',
      getStatus: (s) => ({
        completed: s.finishedOutput?.recorded ? 1 : 0,
        verified: 0,
        total: 1,
        status: s.finishedOutput?.recorded ? 'completed' : 'pending',
      }),
    },
  ];

  // Generate per-phase SOP cards from sopByPhase. Each phase that has at least
  // one SOP step gets its own card linking to /sop-execution?phase=<phase>.
  const sopPhaseLabels: Record<string, string> = {
    pre_production: 'Pre-Production',
    production: 'Production',
    post_production: 'Post-Production',
    packaging: 'Packaging',
  };
  const sopPhaseOrder: Array<keyof typeof sopPhaseLabels> = [
    'pre_production', 'production', 'post_production', 'packaging',
  ];
  const sopByPhase = currentSummary.sopByPhase ?? {};
  for (const ph of sopPhaseOrder) {
    const counts = sopByPhase[ph];
    if (!counts || counts.total === 0) continue;
    executionSections.push({
      id: `sop-execution-${ph}`,
      title: `SOP Execution — ${sopPhaseLabels[ph]}`,
      icon: <ClipboardList className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/sop-execution?phase=${ph}`,
      phase: ph as ExecutionSection['phase'],
      description: 'Execute production steps with parameter recording',
      getStatus: () => ({
        completed: counts.completed,
        verified: counts.verified,
        total: counts.total,
        status: counts.total > 0 && counts.verified === counts.total ? 'verified'
          : counts.total > 0 && counts.completed === counts.total ? 'completed'
          : counts.completed > 0 ? 'in_progress' : 'pending',
      }),
    });
  }

  // Generate per-phase IPC cards (same pattern as SOP).
  const ipcByPhase = currentSummary.ipcByPhase ?? {};
  for (const ph of sopPhaseOrder) {
    const counts = ipcByPhase[ph];
    if (!counts || counts.total === 0) continue;
    executionSections.push({
      id: `ipc-${ph}`,
      title: `${t('execution.ipc')} — ${sopPhaseLabels[ph]}`,
      icon: <FlaskConical className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/ipc?phase=${ph}`,
      phase: ph as ExecutionSection['phase'],
      description: t('execution.ipcDescription'),
      // IPC has no separate verify gate — record is the result.
      getStatus: () => ({
        completed: counts.completed,
        verified: 0,
        total: counts.total,
        status: counts.total > 0 && counts.completed === counts.total ? 'completed'
          : counts.completed > 0 ? 'in_progress' : 'pending',
      }),
    });
  }

  // Cards that should always render even when their underlying counts are 0.
  // Process steps (requisition, yield, inspection, output) are always relevant
  // because they don't come from BOM-configurable lists.
  const alwaysShowCardIds = new Set([
    'material-requisition',
    'material-weighing',
    'bulk-product-yield',
    'finished-inspection',
    'production-output',
  ]);

  const renderStatusBadge = (status: 'pending' | 'in_progress' | 'completed' | 'verified') => {
    const styles = {
      pending: 'bg-gray-100 text-gray-600',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      verified: 'bg-blue-100 text-blue-700',
    };
    const labels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      verified: 'Verified',
    };
    const icons = {
      pending: <Clock className="h-3 w-3" />,
      in_progress: <Clock className="h-3 w-3" />,
      completed: <CheckCircle2 className="h-3 w-3" />,
      verified: <CheckCircle2 className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {labels[status]}
      </span>
    );
  };

  // Dual-layer progress bar:
  //  - Green fill = items completed by operator (width = completed/total)
  //  - Blue overlay = items verified by supervisor (width = verified/total),
  //    rendered ON TOP of green so verified portion appears blue while the
  //    remaining completed-but-unverified portion stays green. When fully
  //    verified the bar is entirely blue; when work is in progress with no
  //    verifications the bar is entirely green over gray.
  const renderProgressBar = (completed: number, verified: number, total: number) => {
    const completedPct = total > 0 ? (completed / total) * 100 : 0;
    const verifiedPct = total > 0 ? (verified / total) * 100 : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300"
            style={{ width: `${completedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-300"
            style={{ width: `${verifiedPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-12 text-right">{completed}/{total}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <DxLoadIndicator />
      </div>
    );
  }

  // Determine which sections are locked based on workflow prerequisites
  const isSectionLocked = (sectionId: string): { locked: boolean; reason: string } => {
    const s = currentSummary;
    const woStatus = s.workOrderStatus || 'planned';

    // Pre-production: cleaning & environmental are always accessible
    // Material weighing: requires requisition approved
    if (sectionId === 'material-weighing') {
      if (s.materialRequisition.status !== 'approved') {
        return { locked: true, reason: 'ต้องอนุมัติใบเบิกวัตถุดิบก่อน' };
      }
    }

    // Cards that need WO to be in_progress before they're recordable.
    // Per-phase SOP/IPC card IDs are dynamic (e.g. sop-execution-pre_production)
    // so we match by prefix as well as the legacy static IDs.
    const requiresInProgress =
      sectionId.startsWith('sop-execution-') ||
      sectionId.startsWith('ipc-') ||
      ['production-cleaning', 'production-environmental',
       'post-production-cleaning',
       'packaging-cleaning', 'packaging-environmental',
       'finished-inspection',
      ].includes(sectionId);
    if (requiresInProgress) {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
    }

    // Production Output / Yield — FINAL step (records FG quantity into the
    // warehouse). Practical gate: enforce the four checkpoints that prove the
    // batch is complete and QC-cleared, with a specific list of what's still
    // missing so the operator knows what to do next.
    //   1. WO Status = in_progress (status flipped from planned/released)
    //   2. Bulk Output recorded   (we know how many units left production)
    //   3. Packaging IPC complete (all phase=packaging tests approved)
    //   4. Finished Inspection passed (final 15-point checklist)
    if (sectionId === 'production-output') {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }

      const missing: string[] = [];

      if (!s.bulkOutput?.recorded) {
        missing.push('Bulk Product Yield');
      }

      // IPC has no operator-vs-supervisor verify step in this workflow —
      // a recorded test result IS the completion signal (matches what the
      // IPC card displays as "Completed"). Gating on `approved` would
      // require a supervisor approve flow that the IPC UI doesn't surface,
      // so the gate would never lift in practice.
      const pkgIpc = s.ipcByPhase?.packaging;
      if (pkgIpc && pkgIpc.total > 0) {
        const completed = pkgIpc.completed ?? 0;
        if (completed < pkgIpc.total) {
          missing.push(`Packaging IPC (${completed}/${pkgIpc.total} completed)`);
        }
      }
      // If BOM has no Packaging IPC configured (pkgIpc undefined or total=0),
      // we don't gate on it — there's simply nothing to require.

      if (s.finishedInspection.status !== 'passed') {
        missing.push('Finished Product Inspection');
      }

      if (missing.length > 0) {
        return { locked: true, reason: `ยังไม่ผ่าน: ${missing.join(', ')}` };
      }
    }

    return { locked: false, reason: '' };
  };

  // Hide BOM-derived cards with total=0 so the dashboard only surfaces work
  // that's actually configured. Process-step cards (always-on whitelist)
  // remain visible regardless of count.
  const visibleSections = executionSections.filter((section) => {
    if (alwaysShowCardIds.has(section.id)) return true;
    const status = section.getStatus(currentSummary);
    return status.total > 0;
  });

  const sectionsByPhase = visibleSections.reduce((acc, section) => {
    if (!acc[section.phase]) acc[section.phase] = [];
    acc[section.phase].push(section);
    return acc;
  }, {} as Record<string, ExecutionSection[]>);

  const phases = ['pre_production', 'production', 'post_production', 'packaging', 'inspection'] as const;

  return (
    <div className="space-y-4">
      {/* BOM Configuration Summary */}
      <BOMConfigReferencePanel workOrderId={workOrderId} defaultExpanded={false} />

      {/* Execution Sections by Phase */}
      {phases.map((phase) => {
        const sections = sectionsByPhase[phase];
        if (!sections || sections.length === 0) return null;

        return (
          <div key={phase} className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${phaseColors[phase]}`}>
              {phaseLabels[phase]}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => {
                const sectionStatus = section.getStatus(currentSummary);

                if (section.id === 'material-requisition') {
                  const reqStatus = currentSummary.materialRequisition;
                  return (
                    <Card key={section.id} className="h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${phaseColors[section.phase].split(' ')[0]}`}>
                              {section.icon}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{section.title}</h3>
                              <p className="text-sm text-gray-500">{section.description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {renderProgressBar(sectionStatus.completed, sectionStatus.verified, sectionStatus.total)}
                          <div className="flex justify-end">
                            {renderStatusBadge(sectionStatus.status)}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          {reqStatus.status === 'none' && (
                            <DxButton
                              text="ส่งใบเบิกวัตถุดิบ"
                              type="success"
                              stylingMode="contained"
                              disabled={requisitionMutation.isPending}
                              onClick={() => requisitionMutation.mutate()}
                            />
                          )}
                          {reqStatus.status === 'requested' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <Clock className="h-3 w-3" />
                                รอคลังอนุมัติ
                              </span>
                              <span className="text-xs text-gray-500">
                                {reqStatus.requestedByName && `โดย ${reqStatus.requestedByName}`}
                                {reqStatus.requestedAt && ` เมื่อ ${new Date(reqStatus.requestedAt).toLocaleString('th-TH')}`}
                              </span>
                            </div>
                          )}
                          {reqStatus.status === 'approved' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                คลังอนุมัติแล้ว
                              </span>
                              <span className="text-xs text-gray-500">
                                {reqStatus.approvedByName && `โดย ${reqStatus.approvedByName}`}
                                {reqStatus.approvedAt && ` เมื่อ ${new Date(reqStatus.approvedAt).toLocaleString('th-TH')}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                const lockInfo = isSectionLocked(section.id);
                const cardContent = (
                  <Card className={`h-full transition-shadow ${lockInfo.locked ? 'opacity-50' : 'hover:shadow-md cursor-pointer'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${phaseColors[section.phase].split(' ')[0]}`}>
                            {section.icon}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{section.title}</h3>
                            <p className="text-sm text-gray-500">{section.description}</p>
                          </div>
                        </div>
                        {lockInfo.locked
                          ? <Lock className="h-5 w-5 text-gray-400" />
                          : <ArrowRight className="h-5 w-5 text-gray-400" />}
                      </div>
                      {lockInfo.locked ? (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          {lockInfo.reason}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {renderProgressBar(sectionStatus.completed, sectionStatus.verified, sectionStatus.total)}
                          <div className="flex justify-end">
                            {renderStatusBadge(sectionStatus.status)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );

                if (lockInfo.locked) {
                  return <div key={section.id}>{cardContent}</div>;
                }
                return (
                  <Link key={section.id} href={section.href}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Alert for unconfigured BOM */}
      {Object.values(currentSummary).every(v =>
        typeof v === 'object' && 'total' in v && (v as any).total === 0
      ) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">BOM Configuration Required</p>
              <p className="text-sm text-amber-700">
                This work order&apos;s BOM has not been configured. Please configure rooms, equipment,
                SOP steps, and other requirements before starting execution.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
