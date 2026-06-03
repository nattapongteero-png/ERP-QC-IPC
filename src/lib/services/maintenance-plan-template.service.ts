/**
 * Maintenance Plan Templates — admin CRUD + apply to equipment
 * Feature: 022-equipment-notifications
 */
import { eq } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  EquipmentNotificationError,
  NOTIFICATION_ERROR_CODES,
  type MaintenancePlanTemplate,
} from '@/types/equipment-notifications';

function getTables() {
  return {
    templates: getTableRef('maintenancePlanTemplates'),
    schedules: getTableRef('acctMaintenanceSchedules'),
    acctEquipment: getTableRef('accountingEquipment'),
  };
}

export async function listTemplates(includeInactive = false): Promise<MaintenancePlanTemplate[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = includeInactive
      ? await db.select().from(t.templates)
      : await db.select().from(t.templates).where(eq(t.templates.isActive, true));
    return rows.map(normalize);
  });
}

export async function createTemplate(
  input: {
    name: string;
    description?: string | null;
    maintenanceType: string;
    intervalType: string;
    intervalValue: number;
    alertDaysBefore: number;
  },
  userId: number,
): Promise<MaintenancePlanTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Duplicate name guard
    const dup = await db
      .select({ id: t.templates.id })
      .from(t.templates)
      .where(eq(t.templates.name, input.name))
      .limit(1);
    if (dup.length > 0) {
      throw new EquipmentNotificationError(
        NOTIFICATION_ERROR_CODES.INVALID_TEMPLATE,
        `Template name "${input.name}" already exists`,
      );
    }

    const ins = await db.insert(t.templates).values({
      name: input.name,
      description: input.description ?? null,
      maintenanceType: input.maintenanceType,
      intervalType: input.intervalType,
      intervalValue: input.intervalValue,
      alertDaysBefore: input.alertDaysBefore,
      isActive: true,
      createdByUserId: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.templates).where(eq(t.templates.id, id)).limit(1);
    return normalize(fresh[0]);
  });
}

export async function updateTemplate(
  id: number,
  patch: Record<string, unknown>,
): Promise<MaintenancePlanTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    await db
      .update(t.templates)
      .set({ ...patch, updatedAt: getNow() })
      .where(eq(t.templates.id, id));
    const fresh = await db.select().from(t.templates).where(eq(t.templates.id, id)).limit(1);
    if (fresh.length === 0)
      throw new EquipmentNotificationError(NOTIFICATION_ERROR_CODES.NOT_FOUND, 'Not found');
    return normalize(fresh[0]);
  });
}

// ============================================
// Apply a template to N equipment in one transaction
// ============================================

export interface ApplyTemplateResult {
  templateId: number;
  scheduleIdsCreated: number[];
  equipmentSkipped: number[];
}

export async function applyTemplateToEquipment(
  templateId: number,
  equipmentIds: number[],
): Promise<ApplyTemplateResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const tplRows = await db.select().from(t.templates).where(eq(t.templates.id, templateId)).limit(1);
    if (tplRows.length === 0)
      throw new EquipmentNotificationError(
        NOTIFICATION_ERROR_CODES.INVALID_TEMPLATE,
        'Template not found',
      );
    const tpl = tplRows[0];

    const scheduleIdsCreated: number[] = [];
    const equipmentSkipped: number[] = [];

    for (const eqId of equipmentIds) {
      // Verify equipment exists
      const eqRows = await db
        .select({ id: t.acctEquipment.id })
        .from(t.acctEquipment)
        .where(eq(t.acctEquipment.id, eqId))
        .limit(1);
      if (eqRows.length === 0) {
        equipmentSkipped.push(eqId);
        continue;
      }

      // Compute next due based on intervalType/Value relative to today
      const nextDue = computeNextDue(
        String(tpl.intervalType),
        Number(tpl.intervalValue),
      );

      const ins = await db.insert(t.schedules).values({
        equipmentId: eqId,
        maintenanceType: tpl.maintenanceType,
        intervalType: tpl.intervalType,
        intervalValue: tpl.intervalValue,
        alertDaysBefore: tpl.alertDaysBefore,
        nextDue,
        isActive: true,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      scheduleIdsCreated.push(getInsertId(ins));
    }

    return {
      templateId,
      scheduleIdsCreated,
      equipmentSkipped,
    };
  });
}

function computeNextDue(intervalType: string, intervalValue: number): string {
  const now = new Date();
  switch (intervalType.toLowerCase()) {
    case 'days':
      now.setDate(now.getDate() + intervalValue);
      break;
    case 'weeks':
      now.setDate(now.getDate() + intervalValue * 7);
      break;
    case 'months':
      now.setMonth(now.getMonth() + intervalValue);
      break;
    default:
      now.setDate(now.getDate() + intervalValue);
  }
  return now.toISOString();
}

function normalize(row: any): MaintenancePlanTemplate {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description ?? null,
    maintenanceType: String(row.maintenanceType),
    intervalType: row.intervalType as MaintenancePlanTemplate['intervalType'],
    intervalValue: Number(row.intervalValue),
    alertDaysBefore: Number(row.alertDaysBefore),
    isActive: Boolean(row.isActive),
    createdByUserId: Number(row.createdByUserId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}
