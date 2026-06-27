/**
 * Shared types + pure helpers for the material-requisitions list and detail
 * pages. Kept React-free so both pages import the SAME row key contract,
 * issuance-plan math, and sufficiency check (DRY — avoids the list and detail
 * drifting apart).
 */
import { calculateIssuance, type UnitConfig } from '@/lib/utils/unit-conversion';

export interface MaterialRow {
  materialId: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  itemUnit: string | null;
  secondaryUnit: string | null;
  conversionRate: number | string | null;
  weightUnit: string | null;
  secondaryToWeightRate: number | string | null;
  weightTrackingEnabled: boolean | number | null;
  status: string | null;
  onHand: number | string | null;
  releasedAvailable: number;
  stockAtApproval: number | string | null;
}

export interface RequisitionRow {
  source: 'bom' | 'out_of_bom';
  /** Out-of-BOM withdrawal request id (present only when source = 'out_of_bom'). */
  requestId?: number;
  reasonType?: string;
  /** Real out-of-BOM state: 'approved' = awaiting release, 'released' = issued. */
  workflowStatus?: 'approved' | 'released';
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productName: string | null;
  productCode: string | null;
  plannedQuantity?: number;
  unit?: string;
  requisitionStatus: 'requested' | 'approved';
  requestedBy: string | null;
  requestedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  releasedBy?: string | null;
  releasedAt?: string | null;
  materials: MaterialRow[];
}

/**
 * Stable list/route key — out-of-BOM rows share a workOrderId, so key by
 * requestId. This is the routing contract: the list navigates to
 * /inventory/requisitions/{rowKey}, and the detail page finds the row by
 * recomputing rowKey.
 */
export function rowKey(r: RequisitionRow): string {
  return r.source === 'out_of_bom' ? `wd-${r.requestId}` : `wo-${r.workOrderId}`;
}

export function formatDateTh(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Reduce a material row into a {needed, issuance, status} summary.
 * Returns null when the item is not weight-tracked or required fields are
 * missing — the caller should fall back to plain "plannedQty unit" display.
 */
export function planIssuance(mat: MaterialRow): {
  puToIssue: number;
  actualIssuedSU: number;
  remainderSU: number;
  pu: string;
  su: string;
} | null {
  const tracked = !!mat.weightTrackingEnabled;
  const ratio1 = Number(mat.conversionRate);
  if (!tracked || !Number.isFinite(ratio1) || ratio1 <= 0) return null;
  if (!mat.secondaryUnit || !mat.itemUnit) return null;

  // plannedQuantity is in `unit` (BOM line unit). Coerce it to SU before issuance:
  // - if BOM unit == secondaryUnit → already SU
  // - if BOM unit == primaryUnit → multiply by ratio1
  // - otherwise: bail (we'd be guessing)
  let plannedSU: number;
  if (mat.unit === mat.secondaryUnit) {
    plannedSU = Number(mat.plannedQuantity);
  } else if (mat.unit === mat.itemUnit) {
    plannedSU = Number(mat.plannedQuantity) * ratio1;
  } else {
    return null;
  }
  if (!Number.isFinite(plannedSU) || plannedSU <= 0) return null;

  const config: UnitConfig = {
    primaryUnit: mat.itemUnit,
    secondaryUnit: mat.secondaryUnit,
    weightUnit: mat.weightUnit,
    conversionRate: ratio1,
    secondaryToWeightRate: Number(mat.secondaryToWeightRate) || null,
    weightTrackingEnabled: true,
  };

  try {
    const r = calculateIssuance(plannedSU, config);
    return {
      puToIssue: r.puToIssue,
      actualIssuedSU: r.actualIssuedSU,
      remainderSU: r.remainderSU,
      pu: mat.itemUnit,
      su: mat.secondaryUnit,
    };
  } catch {
    return null;
  }
}

/**
 * Coerce a material's planned quantity into PRIMARY unit so it can be compared
 * against releasedAvailable (which the API returns in primary).
 */
export function plannedInPrimary(mat: MaterialRow): number {
  const planned = Number(mat.plannedQuantity);
  if (!Number.isFinite(planned)) return 0;

  const ratio1 = Number(mat.conversionRate);
  const ratio2 = Number(mat.secondaryToWeightRate);

  if (mat.unit === mat.itemUnit) return planned;
  if (mat.unit === mat.secondaryUnit && ratio1 > 0) return planned / ratio1;
  if (mat.unit === mat.weightUnit && ratio1 > 0 && ratio2 > 0) {
    return planned / ratio2 / ratio1;
  }
  // Unknown unit pairing — fall back to raw value rather than guess.
  return planned;
}

export function isInsufficient(mat: MaterialRow): boolean {
  return Number(mat.releasedAvailable) < plannedInPrimary(mat);
}
