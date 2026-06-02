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
import { Plus } from 'lucide-react';
import { MaterialWithdrawalRequestDialog, type BomMaterialOption, type RoomOption } from './material-withdrawal-request-dialog';
import { MaterialWithdrawalDetailDialog } from './material-withdrawal-detail-dialog';
import { PhaseBlockBanner } from './phase-block-banner';

interface WoMaterialApiRow {
  id: number;
  itemId: number;
  itemName?: string;
  plannedQuantity: number;
  additionalQtyViaWithdrawalRequest?: number;
  unit: string;
}

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

  // Load BOM materials from WO endpoint (existing API)
  const { data: woMaterials } = useQuery<WoMaterialApiRow[]>({
    queryKey: ['wo-materials', workOrderId],
    queryFn: async () => {
      // The WO detail endpoint may differ per project — try the common path
      const res = await fetch(`/api/production/work-orders/${workOrderId}`);
      if (!res.ok) return [];
      const body = await res.json();
      const items = body?.materials ?? body?.workOrderMaterials ?? [];
      return Array.isArray(items) ? items : [];
    },
    staleTime: 30000,
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
      className="space-y-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
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

      <MaterialWithdrawalRequestDialog
        visible={showDialog}
        onClose={() => setShowDialog(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
        factoryCode={factoryCode ?? null}
        bomMaterials={bomOptions}
        rooms={rooms ?? []}
      />

      <MaterialWithdrawalDetailDialog
        visible={openDetailId !== null}
        requestId={openDetailId}
        onClose={() => setOpenDetailId(null)}
      />
    </div>
  );
}
