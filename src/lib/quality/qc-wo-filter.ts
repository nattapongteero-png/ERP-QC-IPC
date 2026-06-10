/**
 * QC Inspection ↔ Work Order relevance helpers.
 *
 * A QC inspection's type dictates which Work Orders make sense to link, so the
 * "ใบตรวจใหม่" dialog doesn't offer an arbitrary WO that has nothing to do with
 * the inspection. Pure functions here so the rules are unit-testable without
 * rendering DevExtreme.
 */

export type InspectionType = 'incoming' | 'in_process' | 'finished' | 'ad_hoc';

export interface WorkOrderLite {
  id: number;
  woNumber: string;
  status: string;
  productName: string | null;
  productCode: string | null;
  batchNumber: string | null;
}

/**
 * WO statuses worth inspecting per inspection type.
 * - `[]`   → WO linking not applicable (Incoming = raw-material receipt)
 * - `null` → any status (Ad-hoc)
 *
 * WO lifecycle: planned → released → in_progress → completed → closed (+ cancelled)
 */
export const WO_STATUS_BY_TYPE: Record<InspectionType, string[] | null> = {
  incoming: [],
  in_process: ['released', 'in_progress'],
  finished: ['completed', 'closed'],
  ad_hoc: null,
};

/** Whether the WO dropdown should be shown at all for this inspection type. */
export function isWoLinkEnabled(type: InspectionType): boolean {
  const allowed = WO_STATUS_BY_TYPE[type];
  return allowed === null || allowed.length > 0;
}

/** WO options narrowed to the statuses relevant to the chosen inspection type. */
export function filterWorkOrders(
  workOrders: WorkOrderLite[],
  type: InspectionType,
): WorkOrderLite[] {
  const allowed = WO_STATUS_BY_TYPE[type];
  if (allowed === null) return workOrders;
  if (allowed.length === 0) return [];
  return workOrders.filter((w) => allowed.includes(w.status));
}

/**
 * Human-readable WO option so an operator can tell what they're picking:
 * "WO-2569-001 — พาราเซตามอล · batch B123" instead of a bare number.
 */
export function woOptionLabel(w: WorkOrderLite): string {
  const product = w.productName || w.productCode || '';
  const batch = w.batchNumber ? ` · batch ${w.batchNumber}` : '';
  return product ? `${w.woNumber} — ${product}${batch}` : `${w.woNumber}${batch}`;
}
