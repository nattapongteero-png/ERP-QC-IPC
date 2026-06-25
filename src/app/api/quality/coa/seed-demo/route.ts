/**
 * Demo seeder — POST /api/quality/coa/seed-demo
 *
 * Produces ONE fully-complete, ISSUED Certificate of Analysis on the running
 * system so it can be demoed end-to-end (detail page + PDF preview). The seeded
 * COA has:
 *   - Product info (name, code, lot)
 *   - Manufacture / Expiry / Retest dates (all non-null)
 *   - 2 passing test results with spec + result + conclusion
 *   - Overall conclusion = complies
 *   - Three signatures: analyst (Tested by), approver (Reviewed/approved),
 *     qa_release (Approved/released)
 *
 * Idempotent: if an ISSUED demo COA already exists (lot = DEMO-COA-0001), it is
 * returned instead of creating a duplicate.
 *
 * Auth: same wrapper as neighbouring COA routes (logged-in user; no special
 * permission required beyond a valid session).
 */

import { NextRequest } from 'next/server';
import { eq, and, like, asc, desc } from 'drizzle-orm';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { getNow, toDbDate } from '@/lib/db/date-utils';
import { isSqlite } from '@/lib/db';
import {
  generateCoaFromSample,
  transitionCoaStatus,
} from '@/lib/services/coa.service';
import {
  sqliteQcSamples,
  sqliteQcSampleTests,
  sqliteIPCCriteria,
  sqliteCoaTemplates,
  sqliteCoaDocuments,
  sqliteItems,
  sqliteUsers,
  mysqlQcSamples,
  mysqlQcSampleTests,
  mysqlIPCCriteria,
  mysqlCoaTemplates,
  mysqlCoaDocuments,
  mysqlItems,
  mysqlUsers,
} from '@/lib/db/schema';

const DEMO_LOT = 'DEMO-COA-0001';

function tables() {
  if (isSqlite()) {
    return {
      samples: sqliteQcSamples,
      sampleTests: sqliteQcSampleTests,
      criteria: sqliteIPCCriteria,
      templates: sqliteCoaTemplates,
      coa: sqliteCoaDocuments,
      items: sqliteItems,
      users: sqliteUsers,
    };
  }
  return {
    samples: mysqlQcSamples,
    sampleTests: mysqlQcSampleTests,
    criteria: mysqlIPCCriteria,
    templates: mysqlCoaTemplates,
    coa: mysqlCoaDocuments,
    items: mysqlItems,
    users: mysqlUsers,
  };
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    let step = 'init';
    try {
      const result = await executeDbOperation(async (db) => {
        const t = tables();
        const now = getNow();

        // 0. IDEMPOTENCY — if an issued demo COA already exists, return it.
        step = 'idempotency-check';
        const [existing] = await db
          .select({
            id: t.coa.id,
            coaNumber: t.coa.coaNumber,
            status: t.coa.status,
          })
          .from(t.coa)
          .where(
            and(
              like(t.coa.lotNumber, `${DEMO_LOT}%`),
              eq(t.coa.status, 'issued'),
            ),
          )
          .orderBy(desc(t.coa.id))
          .limit(1);
        if (existing) {
          return {
            reused: true,
            coaId: Number(existing.id),
            coaNumber: String(existing.coaNumber),
          };
        }

        // 1. Resolve a product to certify.
        step = 'resolve-product';
        const [product] = await db
          .select({
            id: t.items.id,
            code: t.items.code,
            category: t.items.category,
          })
          .from(t.items)
          .orderBy(asc(t.items.id))
          .limit(1);
        if (!product) {
          throw new Error(
            'No items found in the database — cannot pick a product for the demo COA.',
          );
        }
        const productId = Number(product.id);
        const productCategory: string | null = product.category ?? null;

        // 2. Ensure a default COA template is resolvable for this category.
        //    resolveTemplate() (inside generateCoaFromSample) accepts either a
        //    category-specific default OR a global (productCategory IS NULL)
        //    default. Make sure at least one active default exists.
        step = 'resolve-template';
        const [catDefault] = productCategory
          ? await db
              .select({ id: t.templates.id })
              .from(t.templates)
              .where(
                and(
                  eq(t.templates.isActive, true),
                  eq(t.templates.isDefault, true),
                  eq(t.templates.productCategory, productCategory),
                ),
              )
              .limit(1)
          : [undefined];
        const [globalDefault] = await db
          .select({ id: t.templates.id })
          .from(t.templates)
          .where(
            and(
              eq(t.templates.isActive, true),
              eq(t.templates.isDefault, true),
            ),
          )
          .limit(1);

        if (!catDefault && !globalDefault) {
          // No default template at all. Try to promote any active template to
          // global default; if none exist, create a fresh global default.
          const [anyActive] = await db
            .select({ id: t.templates.id })
            .from(t.templates)
            .where(eq(t.templates.isActive, true))
            .orderBy(asc(t.templates.id))
            .limit(1);
          if (anyActive) {
            await db
              .update(t.templates)
              .set({ isDefault: true, updatedAt: now })
              .where(eq(t.templates.id, anyActive.id));
          } else {
            await db.insert(t.templates).values({
              name: 'Demo Default COA Template',
              productCategory: null,
              isDefault: true,
              isActive: true,
              signatoryRoles: JSON.stringify([
                'analyst',
                'approver',
                'qa_release',
              ]),
              showStorageConditions: true,
              showExpiryDate: true,
              showRetestDate: true,
              showQrVerify: true,
              language: 'bilingual',
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // 3. Ensure at least 2 QC criteria exist (reuse if present).
        step = 'ensure-criteria';
        const existingCriteria = await db
          .select({ id: t.criteria.id })
          .from(t.criteria)
          .orderBy(asc(t.criteria.id))
          .limit(2);
        const criteriaIds: number[] = (existingCriteria as Array<{ id: number }>).map(
          (c) => Number(c.id),
        );

        async function ensureCriterion(
          code: string,
          name: string,
          nameTh: string,
          testMethod: string,
          unit: string,
        ): Promise<number> {
          const [found] = await db
            .select({ id: t.criteria.id })
            .from(t.criteria)
            .where(eq(t.criteria.code, code))
            .limit(1);
          if (found) return Number(found.id);
          const ins = await db.insert(t.criteria).values({
            code,
            name,
            nameTh,
            testMethod,
            unit,
            criteriaType: 'numeric',
            isActive: true,
            createdAt: now,
          });
          return Number(getInsertId(ins));
        }

        if (criteriaIds.length < 2) {
          criteriaIds.length = 0;
          criteriaIds.push(
            await ensureCriterion(
              'DEMO-CURCUMIN',
              'Curcuminoids',
              'เคอร์คูมินอยด์',
              'HPLC',
              '%',
            ),
          );
          criteriaIds.push(
            await ensureCriterion(
              'DEMO-MOISTURE',
              'Moisture',
              'ความชื้น',
              'Moisture Analyzer',
              '%',
            ),
          );
        }
        const [criteria1Id, criteria2Id] = criteriaIds;

        // 4. Pick up to three distinct users (analyst / approver / qa_release).
        step = 'pick-users';
        const userRows = await db
          .select({ id: t.users.id })
          .from(t.users)
          .where(eq(t.users.isActive, true))
          .orderBy(asc(t.users.id))
          .limit(3);
        if (userRows.length === 0) {
          // Fall back to the session user (always exists at this point).
          userRows.push({ id: session.userId } as { id: number });
        }
        const ids = (userRows as Array<{ id: number }>).map((u) => Number(u.id));
        const analystUserId = ids[0];
        const approverUserId = ids[1] ?? ids[0];
        const qaReleaseUserId = ids[2] ?? ids[0];

        // 5. Insert a released QC sample.
        step = 'insert-sample';
        const sampleNumber = `QC-DEMO-${Date.now()}`;
        const sampleInsert = await db.insert(t.samples).values({
          sampleNumber,
          sourceType: 'raw_material_lot',
          sourceRefText: 'Demo seed sample',
          productId,
          lotNumber: DEMO_LOT,
          manufactureDate: toDbDate('2026-01-15'),
          expiryDate: toDbDate('2028-01-14'),
          retestDate: toDbDate('2027-07-15'),
          quantityReceived: 100,
          unit: 'kg',
          storageConditions: 'Store below 30°C, protect from light',
          receivedDate: toDbDate('2026-01-16'),
          receivedBy: analystUserId,
          status: 'released',
          createdAt: now,
          updatedAt: now,
        });
        const sampleId = Number(getInsertId(sampleInsert));

        // 6. Insert 2 passing sample tests.
        step = 'insert-sample-tests';
        await db.insert(t.sampleTests).values({
          sampleId,
          criteriaId: criteria1Id,
          sequence: 1,
          specMin: 3.0,
          specMax: 5.0,
          unit: '%',
          testMethod: 'HPLC',
          numericResult: 4.2,
          resultStatus: 'pass',
          testedBy: analystUserId,
          testedAt: now as any,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(t.sampleTests).values({
          sampleId,
          criteriaId: criteria2Id,
          sequence: 2,
          specMax: 8.0,
          unit: '%',
          testMethod: 'Moisture Analyzer',
          numericResult: 5.1,
          resultStatus: 'pass',
          testedBy: analystUserId,
          testedAt: now as any,
          createdAt: now,
          updatedAt: now,
        });

        return {
          reused: false,
          sampleId,
          analystUserId,
          approverUserId,
          qaReleaseUserId,
        };
      });

      // Already-issued demo COA — short-circuit (idempotent).
      if (result.reused) {
        return successResponse(
          {
            coaId: result.coaId,
            coaNumber: result.coaNumber,
            url: `/quality/coa/${result.coaId}`,
            reused: true,
          },
          `Demo COA ${result.coaNumber} already issued`,
        );
      }

      const { sampleId, analystUserId, approverUserId, qaReleaseUserId } =
        result;

      // 7. Generate the COA from the released sample (writes analyst signature).
      step = 'generate-coa';
      const gen = await generateCoaFromSample({
        sampleId: sampleId!,
        generatedBy: analystUserId!,
      });
      const coaId = gen.coaId;

      // 8. draft → review
      step = 'submit-for-review';
      await transitionCoaStatus(
        coaId,
        { action: 'submit_for_review' },
        approverUserId!,
      );

      // 9. review → approved (writes approver signature)
      step = 'approve';
      await transitionCoaStatus(
        coaId,
        { action: 'approve', signatureMeaning: 'Reviewed & approved' },
        approverUserId!,
      );

      // 10. approved → issued (writes qa_release signature)
      step = 'issue';
      await transitionCoaStatus(
        coaId,
        { action: 'issue', signatureMeaning: 'QA released' },
        qaReleaseUserId!,
      );

      // 11. Done.
      return successResponse(
        {
          coaId,
          coaNumber: gen.coaNumber,
          url: `/quality/coa/${coaId}`,
          reused: false,
        },
        `Demo COA ${gen.coaNumber} issued`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`[coa/seed-demo] failed at step "${step}":`, error);
      return errorResponse(
        `Demo COA seeding failed at step "${step}": ${message}`,
        400,
      );
    }
  });
}
