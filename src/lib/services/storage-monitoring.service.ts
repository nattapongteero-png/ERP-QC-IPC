/**
 * Storage Area Environmental Monitoring
 * Audit Q6 — บันทึกอุณหภูมิ/ความชื้นห้องเก็บนอก BOM + แจ้งเตือนเมื่อเกินเกณฑ์
 *
 * Periodic temp/humidity readings for warehouse storage rooms. Alert is
 * evaluated server-side at insert: a reading outside the warehouse's
 * temperatureMin/Max or humidityMin/Max sets an alertLevel and an
 * alertMessage.
 */
import { and, desc, eq, isNull, gte, lte, sql } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId, isSqlite } from '../db/db-helper';
import { getNow, toQueryDate } from '../db/date-utils';

export type AlertLevel =
  | 'in_spec'
  | 'temp_low'
  | 'temp_high'
  | 'humidity_low'
  | 'humidity_high'
  | 'multiple';

export interface StorageEnvLogInput {
  warehouseId: number;
  locationId?: number | null;
  readingAt?: string;
  temperature?: number | null;
  humidity?: number | null;
  recordedBy: number;
  notes?: string | null;
}

export interface AlertEvaluation {
  alertLevel: AlertLevel;
  alertMessage: string | null;
  reasons: string[];
}

/**
 * Pure function — evaluate a reading against spec. Exposed so tests and
 * callers can reuse the same logic without DB.
 */
export function evaluateAlert(
  reading: { temperature?: number | null; humidity?: number | null },
  spec: {
    temperatureMin?: number | null;
    temperatureMax?: number | null;
    humidityMin?: number | null;
    humidityMax?: number | null;
  },
): AlertEvaluation {
  const reasons: string[] = [];
  const tempOut: ('low' | 'high')[] = [];
  const humOut: ('low' | 'high')[] = [];

  if (reading.temperature != null) {
    const t = Number(reading.temperature);
    if (spec.temperatureMin != null && t < Number(spec.temperatureMin)) {
      tempOut.push('low');
      reasons.push(`อุณหภูมิ ${t}°C ต่ำกว่าเกณฑ์ (${spec.temperatureMin}°C)`);
    }
    if (spec.temperatureMax != null && t > Number(spec.temperatureMax)) {
      tempOut.push('high');
      reasons.push(`อุณหภูมิ ${t}°C สูงกว่าเกณฑ์ (${spec.temperatureMax}°C)`);
    }
  }
  if (reading.humidity != null) {
    const h = Number(reading.humidity);
    if (spec.humidityMin != null && h < Number(spec.humidityMin)) {
      humOut.push('low');
      reasons.push(`ความชื้น ${h}% ต่ำกว่าเกณฑ์ (${spec.humidityMin}%)`);
    }
    if (spec.humidityMax != null && h > Number(spec.humidityMax)) {
      humOut.push('high');
      reasons.push(`ความชื้น ${h}% สูงกว่าเกณฑ์ (${spec.humidityMax}%)`);
    }
  }

  if (reasons.length === 0) {
    return { alertLevel: 'in_spec', alertMessage: null, reasons: [] };
  }

  let level: AlertLevel;
  if (tempOut.length > 0 && humOut.length > 0) level = 'multiple';
  else if (tempOut[0] === 'low') level = 'temp_low';
  else if (tempOut[0] === 'high') level = 'temp_high';
  else if (humOut[0] === 'low') level = 'humidity_low';
  else level = 'humidity_high';

  return { alertLevel: level, alertMessage: reasons.join(' / '), reasons };
}

/**
 * Insert a reading and auto-evaluate alert against the warehouse spec.
 */
export async function createStorageEnvLog(data: StorageEnvLogInput) {
  if (data.temperature == null && data.humidity == null) {
    throw new Error('At least one of temperature or humidity must be provided');
  }

  return executeDbOperation(async (db: any) => {
    const warehouses = getTableRef('warehouses');
    const logs = getTableRef('storageEnvLogs');

    const [wh] = await db
      .select({
        id: warehouses.id,
        temperatureMin: warehouses.temperatureMin,
        temperatureMax: warehouses.temperatureMax,
        humidityMin: warehouses.humidityMin,
        humidityMax: warehouses.humidityMax,
      })
      .from(warehouses)
      .where(eq(warehouses.id, data.warehouseId));

    if (!wh) throw new Error('Warehouse not found');

    const evalResult = evaluateAlert(
      { temperature: data.temperature, humidity: data.humidity },
      wh,
    );

    const readingAt = data.readingAt ?? new Date().toISOString();

    const insertValues: Record<string, unknown> = {
      warehouseId: data.warehouseId,
      locationId: data.locationId ?? null,
      readingAt: isSqlite() ? readingAt : new Date(readingAt),
      temperature: data.temperature ?? null,
      humidity: data.humidity ?? null,
      alertLevel: evalResult.alertLevel,
      alertMessage: evalResult.alertMessage,
      recordedBy: data.recordedBy,
      notes: data.notes ?? null,
      createdAt: getNow(),
    };

    if (isSqlite()) {
      const [log] = await db.insert(logs).values(insertValues).returning();
      return { ...log, ...evalResult };
    } else {
      const result = await db.insert(logs).values(insertValues);
      const id = Number(getInsertId(result));
      const [log] = await db.select().from(logs).where(eq(logs.id, id));
      return { ...log, ...evalResult };
    }
  });
}

export interface ListStorageEnvLogsFilter {
  warehouseId?: number;
  locationId?: number;
  dateFrom?: string;
  dateTo?: string;
  unacknowledgedOnly?: boolean;
  alertsOnly?: boolean;
  limit?: number;
}

export async function listStorageEnvLogs(filter: ListStorageEnvLogsFilter = {}) {
  return executeDbOperation(async (db: any) => {
    const logs = getTableRef('storageEnvLogs');
    const warehouses = getTableRef('warehouses');
    const users = getTableRef('users');

    const conditions: any[] = [];
    if (filter.warehouseId) conditions.push(eq(logs.warehouseId, filter.warehouseId));
    if (filter.locationId) conditions.push(eq(logs.locationId, filter.locationId));
    if (filter.dateFrom) conditions.push(gte(logs.readingAt, toQueryDate(filter.dateFrom)));
    if (filter.dateTo) conditions.push(lte(logs.readingAt, toQueryDate(filter.dateTo)));
    if (filter.unacknowledgedOnly) conditions.push(isNull(logs.acknowledgedBy));
    if (filter.alertsOnly) {
      conditions.push(sql`${logs.alertLevel} != 'in_spec'`);
    }

    let query = db
      .select({
        id: logs.id,
        warehouseId: logs.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        locationId: logs.locationId,
        readingAt: logs.readingAt,
        temperature: logs.temperature,
        humidity: logs.humidity,
        alertLevel: logs.alertLevel,
        alertMessage: logs.alertMessage,
        acknowledgedBy: logs.acknowledgedBy,
        acknowledgedAt: logs.acknowledgedAt,
        acknowledgedNotes: logs.acknowledgedNotes,
        acknowledgedByName: users.name,
        recordedBy: logs.recordedBy,
        notes: logs.notes,
        createdAt: logs.createdAt,
      })
      .from(logs)
      .leftJoin(warehouses, eq(logs.warehouseId, warehouses.id))
      .leftJoin(users, eq(logs.acknowledgedBy, users.id));

    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(desc(logs.readingAt));
    if (filter.limit) query = query.limit(filter.limit);

    return query;
  });
}

/**
 * Get a summary of open (unacknowledged) alerts grouped by warehouse.
 * Drives the inventory dashboard widget.
 */
export async function getOpenAlertsSummary() {
  return executeDbOperation(async (db: any) => {
    const logs = getTableRef('storageEnvLogs');
    const warehouses = getTableRef('warehouses');

    const rows = await db
      .select({
        warehouseId: logs.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        alertLevel: logs.alertLevel,
        readingAt: logs.readingAt,
      })
      .from(logs)
      .innerJoin(warehouses, eq(logs.warehouseId, warehouses.id))
      .where(and(
        sql`${logs.alertLevel} != 'in_spec'`,
        isNull(logs.acknowledgedBy),
      ))
      .orderBy(desc(logs.readingAt));

    type Row = (typeof rows)[number];
    const grouped = new Map<number, {
      warehouseId: number;
      warehouseCode: string;
      warehouseName: string;
      openCount: number;
      lastReadingAt: string | null;
      levels: Set<string>;
    }>();
    for (const r of rows as Row[]) {
      const existing = grouped.get(r.warehouseId);
      if (existing) {
        existing.openCount += 1;
        existing.levels.add(r.alertLevel);
      } else {
        grouped.set(r.warehouseId, {
          warehouseId: r.warehouseId,
          warehouseCode: r.warehouseCode,
          warehouseName: r.warehouseName,
          openCount: 1,
          lastReadingAt: r.readingAt,
          levels: new Set([r.alertLevel]),
        });
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      ...g,
      levels: Array.from(g.levels),
    }));
  });
}

export async function acknowledgeAlert(
  logId: number,
  userId: number,
  notes?: string,
) {
  return executeDbOperation(async (db: any) => {
    const logs = getTableRef('storageEnvLogs');
    const [existing] = await db.select({ id: logs.id, alertLevel: logs.alertLevel })
      .from(logs).where(eq(logs.id, logId));
    if (!existing) throw new Error('Log not found');
    if (existing.alertLevel === 'in_spec') {
      throw new Error('NO_ALERT: This reading is in spec and does not need acknowledgement');
    }

    const updateData = {
      acknowledgedBy: userId,
      acknowledgedAt: getNow(),
      acknowledgedNotes: notes ?? null,
    };

    if (isSqlite()) {
      const [log] = await db.update(logs).set(updateData).where(eq(logs.id, logId)).returning();
      return log;
    } else {
      await db.update(logs).set(updateData).where(eq(logs.id, logId));
      const [log] = await db.select().from(logs).where(eq(logs.id, logId));
      return log;
    }
  });
}
