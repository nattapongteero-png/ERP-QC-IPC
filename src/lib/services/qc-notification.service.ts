/**
 * QC Notification Triggers (Audit QC1 + QC4)
 *
 * Thin wrapper on equipment-notification.service.ts createNotification()
 * that dispatches cross-department alerts to the QC team. Reuses the
 * existing equipment_notifications table because it already supports
 * generic entityType + ack workflow + dedupe.
 *
 * Three triggers:
 *  1. notifyLotReceived(lotId)     — on goods receipt / lot creation
 *  2. notifyWOCompleted(workOrderId) — on WO status → completed
 *  3. notifyDeviationOpened(deviationId) — on deviation creation
 */
import { createNotification } from './equipment-notification.service';

const QC_ROLE = 'qc';

export async function notifyLotReceived(params: {
  lotId: number;
  lotNumber: string;
  itemCode: string | null;
  itemName: string | null;
  quantity: number;
  unit: string;
  warehouseName?: string | null;
}) {
  return createNotification({
    entityType: 'inventory_lot',
    entityId: params.lotId,
    type: 'lot_received',
    severity: 'info',
    title: `Lot ใหม่: ${params.lotNumber} (${params.itemCode || 'item'})`,
    body:
      `รับเข้า ${params.quantity} ${params.unit} ของ ${params.itemName || params.itemCode || 'item'}` +
      (params.warehouseName ? ` ที่ ${params.warehouseName}` : '') +
      ' — กรุณาวางแผน QC sampling',
    recipientRole: QC_ROLE,
  });
}

export async function notifyWOCompleted(params: {
  workOrderId: number;
  woNumber: string;
  batchNumber: string | null;
  productName?: string | null;
  actualQuantity?: number | null;
  unit?: string | null;
}) {
  return createNotification({
    entityType: 'work_order',
    entityId: params.workOrderId,
    type: 'wo_completed',
    severity: 'info',
    title: `WO เสร็จสิ้น: ${params.woNumber}`,
    body:
      `Batch ${params.batchNumber || '-'}` +
      (params.productName ? ` (${params.productName})` : '') +
      ` ผลิตเสร็จ ${params.actualQuantity ?? '-'} ${params.unit ?? ''}` +
      ' — กรุณาดำเนินการ Finished Product QC',
    recipientRole: QC_ROLE,
  });
}

export async function notifyDeviationOpened(params: {
  deviationId: number;
  deviationNumber: string;
  title: string;
  severity?: string | null;
  workOrderId?: number | null;
  woNumber?: string | null;
}) {
  const isCritical = (params.severity || '').toLowerCase() === 'critical';
  return createNotification({
    entityType: 'deviation',
    entityId: params.deviationId,
    type: 'deviation_opened',
    // Map deviation severity → notification severity. Critical deviations
    // surface as overdue so they sort to the top of the inbox.
    severity: isCritical ? 'overdue' : 'info',
    title: `Deviation เปิดใหม่: ${params.deviationNumber}`,
    body:
      params.title +
      (params.workOrderId
        ? ` (${params.woNumber || `WO#${params.workOrderId}`})`
        : '') +
      ' — QA review required',
    recipientRole: QC_ROLE,
  });
}
