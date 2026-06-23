'use client';

/**
 * WithdrawalPanel
 *
 * Self-contained "Material Withdrawal" widget for the Work Order detail page.
 * Bundles together:
 *   - PhaseBlockBanner (auto-fetches blocked phases)
 *   - Request button (opens the operator dialog)
 *   - Detail dialog (opens on banner click or history entry click)
 *
 * Embeds with a single line:
 *   <WithdrawalPanel workOrderId={wo.id} factoryCode={wo.factoryCode} />
 *
 * Feature: 018-material-withdrawal-approval
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { Plus, Clock, CheckCircle, XCircle, Ban, PackageCheck } from 'lucide-react';
import { MaterialWithdrawalRequestDialog, type BomMaterialOption, type RoomOption } from './material-withdrawal-request-dialog';
import { MaterialWithdrawalDetailDialog } from './material-withdrawal-detail-dialog';
import { PhaseBlockBanner } from './phase-block-banner';
import type { MaterialWithdrawalRequestSummary, WithdrawalStatus } from '@/types/material-withdrawal';

interface WoMaterialApiRow {
  id: number;
  itemId: number;
  itemName?: string;
  plannedQuantity: number;
  additionalQtyViaWithdrawalRequest?: number;
  unit: string;
}

const HISTORY_STATUS: Record<
  WithdrawalStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'รออนุมัติ', className: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'อนุมัติ — รอคลังจ่าย', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  released: { label: 'จ่ายของแล้ว', className: 'bg-emerald-100 text-emerald-800', icon: PackageCheck },
  rejected: { label: 'ปฏิเสธ', className: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'ยกเลิก', className: 'bg-gray-200 text-gray-700', icon: Ban },
};

const REASON_LABEL: Record<string, string> = {
  machine_setup_loss: 'สูญเสียระหว่างตั้งค่าเครื่อง',
  equipment_trial_run: 'ทดสอบเครื่อง',
  parameter_adjustment: 'ปรับพารามิเตอร์',
  other: 'อื่น ๆ',
};

export interface WithdrawalPanelProps {
  workOrderId: number;
  workOrderNumber?: string;
  factoryCode?: string | null;
  /** Override the room dropdown; otherwise the dialog uses an empty list. */
  rooms?: RoomOption[];
}

export function WithdrawalPanel({
  workOrderId,
  workOrderNumber,
  factoryCode,
  rooms,
}: WithdrawalPanelProps) {
  const t = useTranslations('material-withdrawal');
  const [showDialog, setShowDialog] = useState(false);
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  // Load BOM materials for this WO. The WO materials live at the dedicated
  // /materials endpoint and the API wraps payloads as { success, data }.
  const { data: woMaterials } = useQuery<WoMaterialApiRow[]>({
    queryKey: ['wo-materials', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/materials`);
      if (!res.ok) return [];
      const body = await res.json();
      const items = body?.data ?? body?.materials ?? body?.workOrderMaterials ?? [];
      return Array.isArray(items) ? items : [];
    },
    staleTime: 30000,
  });

  // Load active production rooms for the room dropdown (self-contained widget).
  // Caller can still override via the `rooms` prop.
  const { data: roomData } = useQuery<RoomOption[]>({
    queryKey: ['production-rooms'],
    enabled: !rooms,
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms?isActive=true');
      if (!res.ok) return [];
      const body = await res.json();
      const rows = body?.data ?? [];
      return (Array.isArray(rows) ? rows : []).map(
        (r: { id: number; nameTh?: string; name?: string; code?: string }) => ({
          id: r.id,
          name: r.nameTh || r.name || r.code || `Room #${r.id}`,
        }),
      );
    },
    staleTime: 60000,
  });

  // History of extra-withdrawal requests for this WO, so the eBMR shows what
  // was requested, whether it was approved (supervisor) and released by the
  // warehouse — stock is deducted at the warehouse release step, not at approve.
  const { data: history } = useQuery<MaterialWithdrawalRequestSummary[]>({
    queryKey: ['wo-withdrawal-history', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/material-withdrawal/requests?workOrderId=${workOrderId}&pageSize=50`);
      if (!res.ok) return [];
      const body = await res.json();
      const items = body?.items ?? body?.data?.items ?? [];
      return Array.isArray(items) ? items : [];
    },
    staleTime: 15000,
  });

  const bomOptions: BomMaterialOption[] = useMemo(
    () =>
      (woMaterials ?? []).map((m) => ({
        itemId: m.itemId,
        itemName: m.itemName ?? `Item #${m.itemId}`,
        unit: m.unit,
        plannedQuantity: Number(m.plannedQuantity ?? 0),
        alreadyExtra: Number(m.additionalQtyViaWithdrawalRequest ?? 0),
      })),
    [woMaterials],
  );

  const materialNameLookup = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of bomOptions) map.set(m.itemId, m.itemName);
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [bomOptions]);

  return (
    <div
      data-testid="withdrawal-panel"
      className="space-y-3 rounded-lg border-2 border-emerald-200 bg-[#F4FBF7] p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('page.title')}
        </h3>
        <Button
          type="default"
          stylingMode="contained"
          onClick={() => setShowDialog(true)}
          text={t('buttons.request')}
        />
      </div>

      <PhaseBlockBanner
        workOrderId={workOrderId}
        onViewRequest={(id) => setOpenDetailId(id)}
        materialNameLookup={materialNameLookup}
      />

      {/* History — what was requested for this WO, whether it was approved
          (supervisor) and released by the warehouse (which issues the stock). */}
      {(history?.length ?? 0) > 0 && (
        <div className="space-y-1.5" data-testid="withdrawal-history">
          <div className="text-xs font-medium text-emerald-900/70">ประวัติการเบิกเพิ่ม</div>
          {history!.map((req) => {
            const cfg = HISTORY_STATUS[req.status];
            const Icon = cfg.icon;
            return (
              <button
                key={req.id}
                type="button"
                onClick={() => setOpenDetailId(req.id)}
                className="w-full text-left rounded-md border bg-white px-3 py-2 hover:border-emerald-300 transition flex items-center justify-between gap-3"
                data-testid={`withdrawal-history-${req.id}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    #{req.id} · {REASON_LABEL[req.reasonType] ?? req.reasonType}
                  </div>
                  <div className="text-xs text-gray-500">
                    {req.itemCount} รายการ · {req.requestedBy.name} ·{' '}
                    {new Date(req.requestedAt).toLocaleDateString('th-TH')}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <MaterialWithdrawalRequestDialog
        visible={showDialog}
        onClose={() => setShowDialog(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
        factoryCode={factoryCode ?? null}
        bomMaterials={bomOptions}
        rooms={rooms ?? roomData ?? []}
      />

      <MaterialWithdrawalDetailDialog
        visible={openDetailId !== null}
        requestId={openDetailId}
        onClose={() => setOpenDetailId(null)}
      />
    </div>
  );
}
