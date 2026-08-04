/**
 * Equipment Log — the per-equipment history 21 CFR 211.182 requires.
 *
 * "A written record of major equipment cleaning, maintenance (except routine
 *  maintenance such as lubrication and adjustments), and use shall be included
 *  in individual equipment logs that show the date, time, product, and lot
 *  number of each batch processed."
 *
 * Nothing new is captured here — every event already exists somewhere. What was
 * missing is the per-equipment VIEW: the events live in five different tables,
 * each keyed by work order or by date, so no one could produce the log for a
 * single machine. This assembles them into one chronological list.
 */
import { eq, desc } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { formatDateFromDb } from '../db/date-utils';

function getTables() {
  return {
    equipment: getTableRef('productionEquipment'),
    inspections: getTableRef('equipmentInspections'),
    woInspections: getTableRef('wOEquipmentInspection'),
    cleaningLogs: getTableRef('wOCleaningLogs'),
    maintRecords: getTableRef('productionMaintenanceRecords'),
    workOrders: getTableRef('workOrders'),
    items: getTableRef('items'),
    users: getTableRef('users'),
  };
}

export type EquipmentLogEventType =
  | 'use'
  | 'cleaning'
  | 'inspection'
  | 'maintenance'
  | 'calibration';

export interface EquipmentLogEvent {
  type: EquipmentLogEventType;
  /** YYYY-MM-DD — what the log is sorted and filed by. */
  date: string | null;
  /** Full timestamp when known; 211.182 asks for the time, not only the date. */
  timestamp: string | null;
  title: string;
  detail: string | null;
  result: string | null;
  /** Batch context — the product and lot this equipment ran, when applicable. */
  workOrderId: number | null;
  workOrderNumber: string | null;
  productName: string | null;
  lotNumber: string | null;
  performedByName: string | null;
  verifiedByName: string | null;
  sourceTable: string;
  sourceId: number;
}

const ymd = (v: unknown): string | null => {
  if (!v) return null;
  try {
    return formatDateFromDb(v as never);
  } catch {
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : null;
  }
};

/**
 * Every recorded event for one piece of equipment, newest first.
 *
 * Each source is queried independently and merged in JS: they have different
 * shapes and different join paths, and the volumes per machine are small. A
 * single SQL union would need five compatible column lists across two dialects
 * for no gain.
 */
export async function getEquipmentLog(
  equipmentId: number,
  opts?: { limitPerSource?: number },
): Promise<{ equipment: Record<string, unknown> | null; events: EquipmentLogEvent[] }> {
  const limit = opts?.limitPerSource ?? 200;

  return executeDbOperation(async (db) => {
    const t = getTables();

    const eqRows = await db.select().from(t.equipment).where(eq(t.equipment.id, equipmentId)).limit(1);
    const equipment = (eqRows[0] as Record<string, unknown>) ?? null;
    if (!equipment) return { equipment: null, events: [] };

    const events: EquipmentLogEvent[] = [];

    // -- Routine / pre-use inspections from the premises registry ------------
    try {
      const rows = await db
        .select({ i: t.inspections, u: t.users })
        .from(t.inspections)
        .leftJoin(t.users, eq(t.inspections.performedByUserId, t.users.id))
        .where(eq(t.inspections.equipmentId, equipmentId))
        .orderBy(desc(t.inspections.performedAt))
        .limit(limit);
      for (const { i, u } of rows as Array<{ i: any; u: any }>) {
        events.push({
          type: 'inspection',
          date: ymd(i.performedAt),
          timestamp: i.performedAt ? String(i.performedAt) : null,
          title: String(i.inspectionType ?? 'routine'),
          detail: i.notes ?? null,
          result: i.result ?? null,
          workOrderId: null,
          workOrderNumber: null,
          productName: null,
          lotNumber: null,
          performedByName: u?.name ?? null,
          verifiedByName: null,
          sourceTable: 'equipment_inspections',
          sourceId: Number(i.id),
        });
      }
    } catch { /* table may be absent on an old database */ }

    // -- Pre-production inspection tied to a work order (this is also USE) ---
    try {
      const rows = await db
        .select({ w: t.woInspections, wo: t.workOrders, it: t.items })
        .from(t.woInspections)
        .leftJoin(t.workOrders, eq(t.woInspections.workOrderId, t.workOrders.id))
        .leftJoin(t.items, eq(t.workOrders.productId, t.items.id))
        .where(eq(t.woInspections.equipmentId, equipmentId))
        .orderBy(desc(t.woInspections.performedAt))
        .limit(limit);
      for (const { w, wo, it } of rows as Array<{ w: any; wo: any; it: any }>) {
        // One row yields two log lines: the equipment was inspected, and the
        // equipment was USED by that batch — 211.182 wants both, with the lot.
        const base = {
          date: ymd(w.performedAt),
          timestamp: w.performedAt ? String(w.performedAt) : null,
          workOrderId: wo?.id != null ? Number(wo.id) : null,
          workOrderNumber: wo?.woNumber ?? null,
          productName: it?.nameTh ?? it?.name ?? null,
          lotNumber: wo?.lotNumber ?? wo?.batchNumber ?? null,
        };
        events.push({
          ...base,
          type: 'inspection',
          title: `pre_production (${w.phase ?? 'pre_production'})`,
          detail: w.notes ?? null,
          result: w.result ?? null,
          performedByName: null,
          verifiedByName: null,
          sourceTable: 'wo_equipment_inspection',
          sourceId: Number(w.id),
        });
        if (base.workOrderNumber) {
          events.push({
            ...base,
            type: 'use',
            title: String(base.workOrderNumber),
            detail: base.productName,
            result: null,
            performedByName: null,
            verifiedByName: null,
            sourceTable: 'work_orders',
            sourceId: Number(wo.id),
          });
        }
      }
    } catch { /* ignore */ }

    // -- Cleaning ------------------------------------------------------------
    try {
      const rows = await db
        .select({ c: t.cleaningLogs, wo: t.workOrders, it: t.items })
        .from(t.cleaningLogs)
        .leftJoin(t.workOrders, eq(t.cleaningLogs.workOrderId, t.workOrders.id))
        .leftJoin(t.items, eq(t.workOrders.productId, t.items.id))
        .where(eq(t.cleaningLogs.equipmentId, equipmentId))
        .orderBy(desc(t.cleaningLogs.performedAt))
        .limit(limit);
      for (const { c, wo, it } of rows as Array<{ c: any; wo: any; it: any }>) {
        events.push({
          type: 'cleaning',
          date: ymd(c.performedAt),
          timestamp: c.performedAt ? String(c.performedAt) : null,
          title: String(c.phase ?? ''),
          detail: c.notes ?? null,
          result: c.isClean ? 'clean' : 'not_clean',
          workOrderId: wo?.id != null ? Number(wo.id) : null,
          workOrderNumber: wo?.woNumber ?? null,
          productName: it?.nameTh ?? it?.name ?? null,
          lotNumber: wo?.lotNumber ?? wo?.batchNumber ?? null,
          performedByName: null,
          verifiedByName: null,
          sourceTable: 'wo_cleaning_logs',
          sourceId: Number(c.id),
        });
      }
    } catch { /* ignore */ }

    // -- Maintenance ---------------------------------------------------------
    try {
      const rows = await db
        .select()
        .from(t.maintRecords)
        .where(eq(t.maintRecords.equipmentId, equipmentId))
        .orderBy(desc(t.maintRecords.performedDate))
        .limit(limit);
      for (const m of rows as Array<Record<string, unknown>>) {
        events.push({
          type: 'maintenance',
          date: ymd(m.performedDate),
          timestamp: m.performedAt ? String(m.performedAt) : null,
          title: String(m.maintenanceType ?? 'preventive'),
          detail: [m.description, m.workDone].filter(Boolean).join(' — ') || null,
          result: (m.result as string) ?? null,
          workOrderId: null,
          workOrderNumber: null,
          productName: null,
          lotNumber: null,
          performedByName: null,
          verifiedByName: null,
          sourceTable: 'production_maintenance_records',
          sourceId: Number(m.id),
        });
      }
    } catch { /* table is new; absent until schema sync runs */ }

    // -- Calibration certificate (a single current state, not a history) -----
    if (equipment.calibrationDate) {
      events.push({
        type: 'calibration',
        date: ymd(equipment.calibrationDate),
        timestamp: null,
        title: String(equipment.calibrationCertNumber ?? ''),
        detail: equipment.calibrationExpiryDate
          ? `expires ${ymd(equipment.calibrationExpiryDate)}`
          : null,
        result: null,
        workOrderId: null,
        workOrderNumber: null,
        productName: null,
        lotNumber: null,
        performedByName: null,
        verifiedByName: null,
        sourceTable: 'production_equipment',
        sourceId: Number(equipment.id),
      });
    }

    // Newest first; undated entries sink to the bottom rather than the top.
    events.sort((a, b) => {
      const av = a.timestamp ?? a.date ?? '';
      const bv = b.timestamp ?? b.date ?? '';
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return bv.localeCompare(av);
    });

    return { equipment, events };
  });
}
