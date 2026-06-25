/**
 * Full-flow demo seeder — POST /api/quality/demo/seed-full-flow
 *
 * Produces ONE complete, connected demo dataset so the whole flow can be shown
 * end-to-end:
 *   1. A QC sample WITH manufacture/expiry/retest dates, released, 2 passing tests
 *   2. An ISSUED COA generated from it (dates + tests + approver/releaser NAMES)
 *   3. A DELIVERED sales order shipping a demo lot to a demo customer
 *   4. A recall on that lot, STARTED (so distribution auto-derives from the SO)
 *
 * Idempotent: re-running returns the existing records (matched on demo markers)
 * instead of duplicating.
 *
 * Auth: same wrapper as neighbouring quality routes (logged-in user).
 */

import { NextRequest } from 'next/server';
import { eq, and, like, asc, desc } from 'drizzle-orm';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { getNow, toDbDate } from '@/lib/db/date-utils';
import { isSqlite } from '@/lib/db';
import { generateCoaFromSample } from '@/lib/services/coa.service';
import { createRecall, startRecall } from '@/lib/services/recall-service';
import {
  sqliteQcSamples, sqliteQcSampleTests, sqliteIPCCriteria, sqliteCoaTemplates,
  sqliteCoaDocuments, sqliteItems, sqliteUsers, sqliteCustomers,
  sqliteInventoryLots, sqliteWarehouses, sqliteSalesOrders, sqliteSalesOrderLines,
  sqliteRecalls,
  mysqlQcSamples, mysqlQcSampleTests, mysqlIPCCriteria, mysqlCoaTemplates,
  mysqlCoaDocuments, mysqlItems, mysqlUsers, mysqlCustomers,
  mysqlInventoryLots, mysqlWarehouses, mysqlSalesOrders, mysqlSalesOrderLines,
  mysqlRecalls,
} from '@/lib/db/schema';

// Demo markers (idempotency keys)
const DEMO = {
  LOT: 'DEMO-FLOW-LOT-0001',
  CUSTOMER_CODE: 'DEMO-FLOW-CUST-001',
  CUSTOMER_NAME: 'โรงพยาบาลสาธิต (Demo Hospital)',
  SO: 'DEMO-FLOW-SO-0001',
  RECALL_REASON: 'DEMO-FLOW: ทดสอบกระบวนการเรียกคืนตัวอย่าง',
};

function tables() {
  if (isSqlite()) {
    return {
      samples: sqliteQcSamples, sampleTests: sqliteQcSampleTests,
      criteria: sqliteIPCCriteria, templates: sqliteCoaTemplates,
      coa: sqliteCoaDocuments, items: sqliteItems, users: sqliteUsers,
      customers: sqliteCustomers, lots: sqliteInventoryLots,
      warehouses: sqliteWarehouses, salesOrders: sqliteSalesOrders,
      salesOrderLines: sqliteSalesOrderLines, recalls: sqliteRecalls,
    };
  }
  return {
    samples: mysqlQcSamples, sampleTests: mysqlQcSampleTests,
    criteria: mysqlIPCCriteria, templates: mysqlCoaTemplates,
    coa: mysqlCoaDocuments, items: mysqlItems, users: mysqlUsers,
    customers: mysqlCustomers, lots: mysqlInventoryLots,
    warehouses: mysqlWarehouses, salesOrders: mysqlSalesOrders,
    salesOrderLines: mysqlSalesOrderLines, recalls: mysqlRecalls,
  };
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    let step = 'init';
    try {
      // ---------------------------------------------------------------
      // Phase 1 — pure DB seed (product, customer, lot, sales order,
      //           qc sample + tests, criteria, template). Wrapped in one
      //           executeDbOperation. Returns ids for the service calls.
      // ---------------------------------------------------------------
      const prepared = await executeDbOperation(async (db) => {
        const t = tables();
        const now = getNow();

        // Idempotency: if a delivered demo SO already exists, the flow was
        // seeded before — short-circuit and report the existing recall/COA.
        step = 'idempotency-check';
        const [existingSo] = await db
          .select({ id: t.salesOrders.id })
          .from(t.salesOrders)
          .where(and(like(t.salesOrders.soNumber, `${DEMO.SO}%`), eq(t.salesOrders.status, 'delivered')))
          .limit(1);

        // 1. Product — reuse the first item.
        step = 'resolve-product';
        const [product] = await db
          .select({ id: t.items.id, category: t.items.category })
          .from(t.items)
          .orderBy(asc(t.items.id))
          .limit(1);
        if (!product) throw new Error('No items found — cannot seed.');
        const productId = Number(product.id);
        const productCategory: string | null = product.category ?? null;

        // 2. Users — up to 3 distinct active users.
        step = 'pick-users';
        const userRows = await db
          .select({ id: t.users.id })
          .from(t.users)
          .where(eq(t.users.isActive, true))
          .orderBy(asc(t.users.id))
          .limit(3);
        if (userRows.length === 0) userRows.push({ id: session.userId } as { id: number });
        const ids = userRows.map((u: { id: number }) => Number(u.id));
        const analyst = ids[0];
        const approver = ids[1] ?? ids[0];
        const qaRelease = ids[2] ?? ids[0];

        // 3. Customer (name MUST match the SO customer_name for the recall join).
        step = 'ensure-customer';
        let [customer] = await db
          .select({ id: t.customers.id })
          .from(t.customers)
          .where(eq(t.customers.code, DEMO.CUSTOMER_CODE))
          .limit(1);
        if (!customer) {
          const ins = await db.insert(t.customers).values({
            code: DEMO.CUSTOMER_CODE,
            name: DEMO.CUSTOMER_NAME,
            customerType: 'hospital',
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          customer = { id: Number(getInsertId(ins)) };
        }
        const customerId = Number(customer.id);

        // 4. Warehouse (for the lot) — reuse first, else create.
        step = 'ensure-warehouse';
        let [wh] = await db
          .select({ id: t.warehouses.id })
          .from(t.warehouses)
          .orderBy(asc(t.warehouses.id))
          .limit(1);
        if (!wh) {
          const ins = await db.insert(t.warehouses).values({
            code: 'DEMO-WH', name: 'Demo Warehouse', type: 'finished_goods',
            isActive: true, createdAt: now, updatedAt: now,
          });
          wh = { id: Number(getInsertId(ins)) };
        }
        const warehouseId = Number(wh.id);

        // 5. Inventory lot (the recalled lot).
        step = 'ensure-lot';
        let [lot] = await db
          .select({ id: t.lots.id })
          .from(t.lots)
          .where(eq(t.lots.lotNumber, DEMO.LOT))
          .limit(1);
        if (!lot) {
          const ins = await db.insert(t.lots).values({
            lotNumber: DEMO.LOT,
            itemId: productId,
            warehouseId,
            quantity: 1000,
            unit: 'box',
            status: 'released',
            manufacturingDate: toDbDate('2026-01-15'),
            expiryDate: toDbDate('2028-01-14'),
            createdAt: now,
            updatedAt: now,
          });
          lot = { id: Number(getInsertId(ins)) };
        }
        const lotId = Number(lot.id);

        // 6. Delivered sales order + line (drives recall distribution).
        step = 'ensure-sales-order';
        if (!existingSo) {
          const soIns = await db.insert(t.salesOrders).values({
            soNumber: DEMO.SO,
            customerName: DEMO.CUSTOMER_NAME,
            status: 'delivered',
            currency: 'THB',
            source: 'direct',
            orderDate: toDbDate('2026-01-10'),
            requiredDate: toDbDate('2026-01-20'),
            shippedDate: toDbDate('2026-01-25'),
            totalAmount: 60000,
            createdAt: now,
            updatedAt: now,
          });
          const soId = Number(getInsertId(soIns));
          await db.insert(t.salesOrderLines).values({
            soId,
            itemId: productId,
            lotId,
            quantity: 600,
            allocatedQuantity: 600,
            shippedQuantity: 600,
            unit: 'box',
            unitPrice: 100,
            totalPrice: 60000,
            createdAt: now,
            updatedAt: now,
          });
        }

        // 7. Ensure a default COA template resolves.
        step = 'ensure-template';
        const [catDefault] = productCategory
          ? await db.select({ id: t.templates.id }).from(t.templates)
              .where(and(eq(t.templates.isActive, true), eq(t.templates.isDefault, true), eq(t.templates.productCategory, productCategory)))
              .limit(1)
          : [undefined];
        const [globalDefault] = await db.select({ id: t.templates.id }).from(t.templates)
          .where(and(eq(t.templates.isActive, true), eq(t.templates.isDefault, true)))
          .limit(1);
        if (!catDefault && !globalDefault) {
          const [anyActive] = await db.select({ id: t.templates.id }).from(t.templates)
            .where(eq(t.templates.isActive, true)).orderBy(asc(t.templates.id)).limit(1);
          if (anyActive) {
            await db.update(t.templates).set({ isDefault: true, updatedAt: now }).where(eq(t.templates.id, anyActive.id));
          } else {
            await db.insert(t.templates).values({
              name: 'Demo Default COA Template', productCategory: null,
              isDefault: true, isActive: true,
              signatoryRoles: JSON.stringify(['analyst', 'approver', 'qa_release']),
              showStorageConditions: true, showExpiryDate: true, showRetestDate: true,
              showQrVerify: true, language: 'bilingual', createdAt: now, updatedAt: now,
            });
          }
        }

        // 8. Ensure 2 criteria.
        step = 'ensure-criteria';
        async function ensureCriterion(code: string, name: string, nameTh: string, method: string, unit: string): Promise<number> {
          const [found] = await db.select({ id: t.criteria.id }).from(t.criteria).where(eq(t.criteria.code, code)).limit(1);
          if (found) return Number(found.id);
          const ins = await db.insert(t.criteria).values({
            code, name, nameTh, testMethod: method, unit,
            criteriaType: 'numeric', isActive: true, createdAt: now,
          });
          return Number(getInsertId(ins));
        }
        const crit1 = await ensureCriterion('DEMO-CURCUMIN', 'Curcuminoids', 'เคอร์คูมินอยด์', 'HPLC', '%');
        const crit2 = await ensureCriterion('DEMO-MOISTURE', 'Moisture', 'ความชื้น', 'Moisture Analyzer', '%');

        // 9. QC sample (released, with dates) + 2 passing tests.
        step = 'ensure-sample';
        let [sample] = await db
          .select({ id: t.samples.id })
          .from(t.samples)
          .where(eq(t.samples.lotNumber, DEMO.LOT))
          .orderBy(desc(t.samples.id))
          .limit(1);
        let sampleId: number;
        let needCoa = true;
        if (sample) {
          sampleId = Number(sample.id);
          // If a COA already exists for this sample, we won't regenerate.
          const [existingCoa] = await db.select({ id: t.coa.id }).from(t.coa)
            .where(eq(t.coa.sampleId, sampleId)).limit(1);
          needCoa = !existingCoa;
        } else {
          const sIns = await db.insert(t.samples).values({
            sampleNumber: `QC-DEMOFLOW-${Date.now()}`,
            sourceType: 'raw_material_lot',
            sourceRefText: 'Demo full-flow sample',
            productId,
            lotNumber: DEMO.LOT,
            manufactureDate: toDbDate('2026-01-15'),
            expiryDate: toDbDate('2028-01-14'),
            retestDate: toDbDate('2027-07-15'),
            quantityReceived: 100,
            unit: 'box',
            storageConditions: 'เก็บที่อุณหภูมิต่ำกว่า 30°C',
            receivedDate: toDbDate('2026-01-16'),
            receivedBy: analyst,
            status: 'released',
            createdAt: now,
            updatedAt: now,
          });
          sampleId = Number(getInsertId(sIns));
          await db.insert(t.sampleTests).values({
            sampleId, criteriaId: crit1, sequence: 1,
            specMin: 3.0, specMax: 5.0, unit: '%', testMethod: 'HPLC',
            numericResult: 4.2, resultStatus: 'pass',
            testedBy: analyst, testedAt: now as unknown as string,
            createdAt: now, updatedAt: now,
          });
          await db.insert(t.sampleTests).values({
            sampleId, criteriaId: crit2, sequence: 2,
            specMax: 8.0, unit: '%', testMethod: 'Moisture Analyzer',
            numericResult: 5.1, resultStatus: 'pass',
            testedBy: analyst, testedAt: now as unknown as string,
            createdAt: now, updatedAt: now,
          });
        }

        return { productId, lotId, customerId, sampleId, analyst, approver, qaRelease, needCoa, alreadySeeded: !!existingSo };
      });

      const { productId, lotId, sampleId, analyst, approver, qaRelease, needCoa } = prepared;

      // ---------------------------------------------------------------
      // Phase 2 — COA generation + issue (service calls run their own
      //           executeDbOperation, so they go AFTER phase 1 commits).
      // ---------------------------------------------------------------
      let coaId: number | null = null;
      let coaNumber: string | null = null;
      if (needCoa) {
        step = 'generate-coa';
        const gen = await generateCoaFromSample({ sampleId, generatedBy: analyst });
        coaId = gen.coaId;
        coaNumber = gen.coaNumber;

        step = 'issue-coa';
        await executeDbOperation(async (db) => {
          const t = tables();
          const now2 = getNow();
          await db.update(t.coa).set({
            status: 'issued',
            approvedBy: approver, approvedAt: now2,
            releasedBy: qaRelease, releasedAt: now2,
            updatedAt: now2,
          }).where(eq(t.coa.id, coaId!));
        });
      } else {
        // Reuse the existing COA for this sample.
        const found = await executeDbOperation(async (db) => {
          const t = tables();
          const [c] = await db.select({ id: t.coa.id, coaNumber: t.coa.coaNumber })
            .from(t.coa).where(eq(t.coa.sampleId, sampleId)).orderBy(desc(t.coa.id)).limit(1);
          return c;
        });
        if (found) { coaId = Number(found.id); coaNumber = String(found.coaNumber); }
      }

      // ---------------------------------------------------------------
      // Phase 3 — recall on the demo lot, then start (auto-derives
      //           distribution from the delivered sales order).
      // ---------------------------------------------------------------
      step = 'ensure-recall';
      // Look for an existing demo recall (by reason marker).
      const priorRecall = await executeDbOperation(async (db) => {
        const t = tables();
        const [r] = await db
          .select({ id: t.recalls.id })
          .from(t.recalls)
          .where(like(t.recalls.reason, `${DEMO.RECALL_REASON}%`))
          .orderBy(desc(t.recalls.id))
          .limit(1);
        return r ?? null;
      });

      let recallId: number;
      if (priorRecall) {
        recallId = Number(priorRecall.id);
      } else {
        step = 'create-recall';
        const created = await createRecall(
          {
            recallClass: 'class_ii',
            reason: DEMO.RECALL_REASON,
            productId,
            affectedLots: [lotId],
            coordinatorId: analyst,
          },
          analyst,
        );
        recallId = created.id;

        step = 'start-recall';
        await startRecall(recallId, analyst);
      }

      return successResponse(
        {
          coaId, coaNumber,
          recallId,
          sampleId,
          urls: {
            coa: coaId ? `/quality/coa/${coaId}` : null,
            recall: `/gmp/recalls/${recallId}`,
          },
        },
        'Full-flow demo seeded (QC sample + COA + delivered SO + started recall)',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[demo/seed-full-flow] failed at step "${step}":`, error);
      return errorResponse(`Full-flow seeding failed at step "${step}": ${message}`, 400);
    }
  });
}
