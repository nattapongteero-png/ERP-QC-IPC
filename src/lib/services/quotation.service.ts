/**
 * Quotation (ใบเสนอราคา) service — list items 1a–1d.
 *
 * CRUD + document-number generation + convert-to-sales-order. Follows the
 * Template Module pattern (executeDbOperation / getTableRef / getInsertId) and
 * the dual-DB date helpers.
 */
import { like, eq, desc, and, type SQL } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, toDateSafe } from '../db/date-utils';
import { createSalesOrder } from './sales.service';
import type {
  QuotationCreate,
  QuotationUpdate,
  QuotationWithLines,
  Quotation,
  QuotationLine,
} from '@/types/quotation';

function getTables() {
  return {
    quotations: getTableRef('quotations'),
    lines: getTableRef('quotationLines'),
  };
}

const lineTotal = (qty: number, price: number) => (qty || 0) * (price || 0);

/**
 * Next quotation number: QT{YYYY}-000N, sequential within the year. Mirrors
 * generatePRNumber so the whole app numbers documents the same way.
 */
export async function generateQuotationNumber(): Promise<string> {
  return executeDbOperation(async (db) => {
    const { quotations } = getTables();
    const year = new Date().getFullYear();
    const prefix = `QT${year}-`;

    const result = await db
      .select({ quotationNumber: quotations.quotationNumber })
      .from(quotations)
      .where(like(quotations.quotationNumber, `${prefix}%`))
      .orderBy(desc(quotations.id))
      .limit(1);

    if (result.length === 0) return `${prefix}0001`;
    const sequence = parseInt(result[0].quotationNumber.replace(prefix, ''), 10) || 0;
    return `${prefix}${(sequence + 1).toString().padStart(4, '0')}`;
  });
}

export async function createQuotation(
  data: QuotationCreate,
  createdBy: number,
): Promise<{ id: number; quotationNumber: string }> {
  return executeDbOperation(async (db) => {
    const { quotations, lines } = getTables();
    const now = getNow();

    const total = data.lines.reduce(
      (sum, l) => sum + lineTotal(l.quantity, l.unitPrice),
      0,
    );

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const year = new Date().getFullYear();
        const prefix = `QT${year}-`;
        const existing = await db
          .select({ quotationNumber: quotations.quotationNumber })
          .from(quotations)
          .where(like(quotations.quotationNumber, `${prefix}%`))
          .orderBy(desc(quotations.id))
          .limit(1);
        const seq =
          existing.length === 0
            ? 1
            : (parseInt(existing[0].quotationNumber.replace(prefix, ''), 10) || 0) + 1;
        const quotationNumber = `${prefix}${seq.toString().padStart(4, '0')}`;

        const result = await db.insert(quotations).values({
          quotationNumber,
          customerId: data.customerId ?? null,
          customerName: data.customerName,
          customerContact: data.customerContact ?? null,
          customerAddress: data.customerAddress ?? null,
          status: 'draft',
          quotationDate: data.quotationDate ? toDbDate(data.quotationDate) : now,
          validUntil: data.validUntil ? toDbDate(data.validUntil) : null,
          totalAmount: total,
          vatInclusive: data.vatInclusive === true,
          currency: 'THB',
          paymentTerms: data.paymentTerms ?? null,
          notes: data.notes ?? null,
          createdBy,
          createdAt: now,
          updatedAt: now,
        });
        const quotationId = getInsertId(result);

        for (const line of data.lines) {
          await db.insert(lines).values({
            quotationId,
            itemId: line.itemId ?? null,
            itemCode: line.itemCode ?? null,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            totalPrice: lineTotal(line.quantity, line.unitPrice),
            notes: line.notes ?? null,
            createdAt: now,
          });
        }

        return { id: quotationId, quotationNumber };
      } catch (error: any) {
        const dup =
          error?.code === 'ER_DUP_ENTRY' ||
          error?.message?.includes('UNIQUE constraint failed');
        if (attempt < MAX_RETRIES - 1 && dup) continue;
        throw error;
      }
    }
    throw new Error('Failed to generate a unique quotation number');
  });
}

function mapQuotation(row: any): Quotation {
  return {
    ...row,
    quotationDate: row.quotationDate ? formatDate(row.quotationDate) : null,
    validUntil: row.validUntil ? formatDate(row.validUntil) : null,
    totalAmount: Number(row.totalAmount) || 0,
  };
}

function formatDate(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = toDateSafe(v);
  return d ? d.toISOString() : null;
}

export async function getQuotation(id: number): Promise<QuotationWithLines | null> {
  return executeDbOperation(async (db) => {
    const { quotations, lines } = getTables();
    const rows = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
    if (rows.length === 0) return null;

    const lineRows = await db
      .select()
      .from(lines)
      .where(eq(lines.quotationId, id))
      .orderBy(lines.id);

    return {
      ...mapQuotation(rows[0]),
      lines: lineRows.map(
        (l: any): QuotationLine => ({
          ...l,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          totalPrice: Number(l.totalPrice) || 0,
        }),
      ),
    };
  });
}

export async function listQuotations(filters?: {
  status?: string;
  search?: string;
}): Promise<Quotation[]> {
  return executeDbOperation(async (db) => {
    const { quotations } = getTables();
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(quotations.status, filters.status));
    if (filters?.search) {
      conditions.push(like(quotations.customerName, `%${filters.search}%`));
    }

    const query = db.select().from(quotations);
    const rows = await (conditions.length > 0
      ? query.where(and(...conditions))
      : query
    ).orderBy(desc(quotations.id));

    return rows.map(mapQuotation);
  });
}

export async function updateQuotation(id: number, data: QuotationUpdate): Promise<void> {
  return executeDbOperation(async (db) => {
    const { quotations } = getTables();
    await db
      .update(quotations)
      .set({
        ...(data.customerId !== undefined && { customerId: data.customerId }),
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.customerContact !== undefined && { customerContact: data.customerContact }),
        ...(data.customerAddress !== undefined && { customerAddress: data.customerAddress }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.quotationDate !== undefined && {
          quotationDate: data.quotationDate ? toDbDate(data.quotationDate) : null,
        }),
        ...(data.validUntil !== undefined && {
          validUntil: data.validUntil ? toDbDate(data.validUntil) : null,
        }),
        ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: getNow(),
      })
      .where(eq(quotations.id, id));
  });
}

export async function deleteQuotation(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const { quotations, lines } = getTables();
    await db.delete(lines).where(eq(lines.quotationId, id));
    await db.delete(quotations).where(eq(quotations.id, id));
  });
}

/**
 * Full edit of a DRAFT quotation: rewrite the header and REPLACE all lines
 * (delete + re-insert) so quantities/prices/items can change, mirroring the
 * sales-order draft edit. The route guards that the quotation is still a draft
 * before calling this. `quotationDate` is only touched when the caller sends
 * one, so the original issue date is preserved on edit.
 */
export async function replaceQuotation(id: number, data: QuotationCreate): Promise<void> {
  return executeDbOperation(async (db) => {
    const { quotations, lines } = getTables();
    const now = getNow();
    const total = data.lines.reduce(
      (sum, l) => sum + lineTotal(l.quantity, l.unitPrice),
      0,
    );

    await db
      .update(quotations)
      .set({
        customerId: data.customerId ?? null,
        customerName: data.customerName,
        customerContact: data.customerContact ?? null,
        customerAddress: data.customerAddress ?? null,
        ...(data.quotationDate
          ? { quotationDate: toDbDate(data.quotationDate) }
          : {}),
        validUntil: data.validUntil ? toDbDate(data.validUntil) : null,
        totalAmount: total,
        vatInclusive: data.vatInclusive === true,
        paymentTerms: data.paymentTerms ?? null,
        notes: data.notes ?? null,
        updatedAt: now,
      })
      .where(eq(quotations.id, id));

    // Replace the whole line set — simplest correct way to let a line be added,
    // removed, or edited in one save.
    await db.delete(lines).where(eq(lines.quotationId, id));
    for (const line of data.lines) {
      await db.insert(lines).values({
        quotationId: id,
        itemId: line.itemId ?? null,
        itemCode: line.itemCode ?? null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        totalPrice: lineTotal(line.quantity, line.unitPrice),
        notes: line.notes ?? null,
        createdAt: now,
      });
    }
  });
}

/**
 * Convert an accepted quotation into a sales order (list item 1d). Only lines
 * that reference a real inventory item become SO lines — free-text lines have no
 * itemId to allocate stock against. Marks the quotation converted and links the
 * new SO back via soId so the two documents stay traceable.
 */
export async function convertQuotationToSalesOrder(
  id: number,
  userId: number,
): Promise<{ soId: number }> {
  const quotation = await getQuotation(id);
  if (!quotation) throw new Error('Quotation not found');

  // Only an ACCEPTED quotation may become a sales order (list item 20.1). A draft
  // or merely-sent offer has not been agreed by the customer, so converting it
  // would create an order nobody approved. Already-converted is handled below.
  if (quotation.status !== 'accepted' && quotation.status !== 'converted') {
    throw new Error(
      'ใบเสนอราคายังไม่ได้รับการตอบรับ กรุณากด "ตอบรับ" ก่อนแปลงเป็นใบสั่งขาย',
    );
  }

  if (quotation.status === 'converted' && quotation.soId) {
    return { soId: quotation.soId };
  }

  const soLines = quotation.lines
    .filter((l) => l.itemId)
    .map((l) => ({
      itemId: l.itemId!,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      requiredDate: quotation.validUntil || new Date().toISOString(),
    }));

  if (soLines.length === 0) {
    throw new Error('ใบเสนอราคาไม่มีรายการที่อ้างอิงสินค้าในคลัง จึงแปลงเป็นใบสั่งขายไม่ได้');
  }

  const { orderId } = await createSalesOrder(
    {
      name: quotation.customerName,
      contact: quotation.customerContact ?? undefined,
      address: quotation.customerAddress ?? undefined,
    } as any,
    soLines,
    userId,
  );

  await executeDbOperation(async (db) => {
    const { quotations } = getTables();

    // Carry the quotation's header terms onto the new sales order (list item 20:
    // the converted SO was losing วันที่/กำหนดส่ง/เงื่อนไขการชำระ). createSalesOrder
    // only writes the customer + lines, so stamp the rest here.
    const salesOrders = getTableRef('salesOrders');
    await db
      .update(salesOrders)
      .set({
        paymentTerms: quotation.paymentTerms ?? null,
        requiredDate: quotation.validUntil ? toDbDate(quotation.validUntil) : null,
        notes: quotation.notes ?? null,
        updatedAt: getNow(),
      })
      .where(eq(salesOrders.id, orderId));

    await db
      .update(quotations)
      .set({ status: 'converted', soId: orderId, updatedAt: getNow() })
      .where(eq(quotations.id, id));
  });

  return { soId: orderId };
}
