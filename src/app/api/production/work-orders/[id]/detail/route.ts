import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq, asc, and } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';
import {
  getWOSOPExecution,
  getWOCleaningLogs,
  getWOEnvironmentalLogs,
  getWOMaterials,
  getWOIPCTests,
} from '@/lib/services/wo-execution.service';
import { getGowningForWorkOrder } from '@/lib/services/wo-gowning.service';
import { getAttachments } from '@/lib/services/attachment-service';
import { inArray } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;

      const workOrders = getTableRef('workOrders');
      const workOrderMaterials = getTableRef('workOrderMaterials');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');
      const qualityTests = getTableRef('qualityTests');

      // Get work order details
      const woResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrders.id,
            woNumber: workOrders.woNumber,
            bomId: workOrders.bomId,
            productId: workOrders.productId,
            productCode: items.code,
            productName: items.nameTh,
            productNameEn: items.nameEn,
            productUnit: items.primaryUnit,
            productSecondaryUnit: items.secondaryUnit,
            productConversionRate: items.conversionRate,
            ttmtCode: items.ttmtCode,
            drugCode24: items.drugCode24,
            gRegNumber: items.gRegNumber,
            batchNumber: workOrders.batchNumber,
            plannedQuantity: workOrders.plannedQuantity,
            actualQuantity: workOrders.actualQuantity,
            rejectQuantity: workOrders.rejectQuantity,
            unit: workOrders.unit,
            status: workOrders.status,
            priority: workOrders.priority,
            plannedStartDate: workOrders.plannedStartDate,
            plannedEndDate: workOrders.plannedEndDate,
            actualStartDate: workOrders.actualStartDate,
            actualEndDate: workOrders.actualEndDate,
            deliveryDate: workOrders.deliveryDate,
            yieldPercentage: workOrders.yieldPercentage,
            notes: workOrders.notes,
            completedBy: workOrders.completedBy,
            completedAt: workOrders.completedAt,
            bulkOutputQty: workOrders.bulkOutputQty,
            bulkOutputRecordedAt: workOrders.bulkOutputRecordedAt,
            bulkOutputRecordedBy: workOrders.bulkOutputRecordedBy,
            finishedOutputQty: workOrders.finishedOutputQty,
            finishedOutputRecordedAt: workOrders.finishedOutputRecordedAt,
            finishedOutputRecordedBy: workOrders.finishedOutputRecordedBy,
            // eBMR audit gap #6 — explicit QA approval signature
            qaApprovedBy: workOrders.qaApprovedBy,
            qaApprovedAt: workOrders.qaApprovedAt,
            qaApprovalNotes: workOrders.qaApprovalNotes,
            createdAt: workOrders.createdAt,
            updatedAt: workOrders.updatedAt,
          })
          .from(workOrders)
          .leftJoin(items, eq(workOrders.productId, items.id))
          .where(eq(workOrders.id, parseInt(id)));
      });

      if (woResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }

      const workOrder = woResult[0] as Record<string, unknown>;

      // The detail page expects `plannedQty`/`actualQty` (the schema columns are
      // `plannedQuantity`/`actualQuantity`). Expose both so the summary cards
      // (จำนวนที่วางแผน / จำนวนจริง) read the real values instead of 0.
      workOrder.plannedQty = workOrder.plannedQuantity;
      workOrder.actualQty = workOrder.actualQuantity;

      // Get BOM info (code, name, version) + yield/loss settings if BOM is linked
      if (workOrder.bomId) {
        const bom = getTableRef('bOM');
        const bomResult = await executeDbOperation(async (db) => {
          return db
            .select({
              code: bom.code,
              name: bom.name,
              version: bom.version,
              yieldTarget: bom.yieldTarget,
              lossAllowance: bom.lossAllowance,
              fillWeightMg: bom.fillWeightMg,
            })
            .from(bom)
            .where(eq(bom.id, workOrder.bomId));
        });
        if (bomResult.length > 0) {
          workOrder.bomCode = bomResult[0].code;
          workOrder.bomName = bomResult[0].name;
          workOrder.bomVersion = bomResult[0].version;
          workOrder.bomYieldTarget = bomResult[0].yieldTarget;
          workOrder.bomLossAllowance = bomResult[0].lossAllowance;
          workOrder.bomFillWeightMg = bomResult[0].fillWeightMg;
        }

        // Empty-capsule weight for the filled-weight calc. The capsule shell is
        // a BOM line whose item is packaging/Capsule and carries a per-unit net
        // weight (unitWeightMg). Use the first such line; the yield step adds
        // capsuleCount × this to the powder weight.
        const bomLines = getTableRef('bOMLines');
        const itemsT = getTableRef('items');
        const capLine = await executeDbOperation(async (db) => {
          return db
            .select({
              unitWeightMg: itemsT.unitWeightMg,
              itemNameTh: itemsT.nameTh,
              itemType: itemsT.type,
              itemCategory: itemsT.category,
            })
            .from(bomLines)
            .leftJoin(itemsT, eq(bomLines.itemId, itemsT.id))
            .where(
              and(
                eq(bomLines.bomId, workOrder.bomId as number),
                eq(itemsT.type, 'packaging'),
              ),
            )
            .orderBy(asc(bomLines.sequence));
        });
        // Prefer a packaging line that actually has a recorded per-unit weight.
        const withWeight = (capLine as Array<{ unitWeightMg: number | string | null; itemNameTh: string | null }>).find(
          (l) => l.unitWeightMg != null && Number(l.unitWeightMg) > 0,
        );
        if (withWeight) {
          workOrder.emptyCapsuleWeightMg = Number(withWeight.unitWeightMg);
          workOrder.emptyCapsuleItemName = withWeight.itemNameTh;
        }
      }

      // Get work order materials.
      //
      // Unit handling (see bug: Materials tab showed BOM unit instead of weighed unit):
      // - `unit`          = weighing/BOM unit (e.g. "g") — source of truth for display
      // - `itemUnit`      = item master primary unit (e.g. "kg") — fallback only
      // - `plannedQuantity` is stored in weighing unit
      // - `actualQuantity` is stored in PRIMARY unit (for cost calculations)
      // - `weighedQty`    is stored in weighing unit (what the operator typed)
      //
      // For the Materials tab we want Planned and Actual to share a unit so the
      // variance is meaningful. We therefore expose `weighedQty` and compute
      // `actualQty`/`variance` from weighedQty (weighing unit) in the response.
      const materialsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrderMaterials.id,
            itemId: workOrderMaterials.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemUnit: items.primaryUnit,
            plannedQuantity: workOrderMaterials.plannedQuantity,
            actualQuantity: workOrderMaterials.actualQuantity,
            weighedQty: workOrderMaterials.weighedQty,
            // eBMR audit gap #2 — Material Consumption Issued/Returned/Net Used
            issuedQty: workOrderMaterials.issuedQty,
            unit: workOrderMaterials.unit,
            status: workOrderMaterials.status,
            lotId: workOrderMaterials.lotId,
          })
          .from(workOrderMaterials)
          .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
          .where(eq(workOrderMaterials.workOrderId, parseInt(id)));
      });

      // eBMR audit gap #2 — pull returned quantities for this WO so we can
      // show "Returned" + "Actual Used" (= issued - returned) per item.
      const returnedByItem = new Map<number, number>();
      try {
        const materialReturns = getTableRef('materialReturns');
        const materialReturnLines = getTableRef('materialReturnLines');
        const { inArray } = await import('drizzle-orm');
        const woReturns = await executeDbOperation(async (db) => {
          return db
            .select({ id: materialReturns.id, status: materialReturns.status })
            .from(materialReturns)
            .where(eq(materialReturns.workOrderId, parseInt(id)));
        });
        const acceptedReturnIds = woReturns
          .filter((r: { status?: string }) =>
            ['received', 'submitted', 'approved'].includes(r.status || ''))
          .map((r: { id: number }) => r.id);
        if (acceptedReturnIds.length > 0) {
          const lines = await executeDbOperation(async (db) => {
            return db
              .select({
                itemId: materialReturnLines.itemId,
                returnQty: materialReturnLines.returnQty,
                returnUnit: materialReturnLines.returnUnit,
              })
              .from(materialReturnLines)
              .where(inArray(materialReturnLines.returnId, acceptedReturnIds));
          });
          for (const l of lines) {
            const qty = Number(l.returnQty) || 0;
            returnedByItem.set(
              l.itemId as number,
              (returnedByItem.get(l.itemId as number) || 0) + qty,
            );
          }
        }
      } catch (err) {
        console.warn('Could not fetch material returns for eBMR:', err);
      }

      // Get lot information for each material
      const materialsWithLots = await Promise.all(
        materialsResult.map(async (material: Record<string, unknown>) => {
          if (material.lotId) {
            const lotResult = await executeDbOperation(async (db) => {
              return db
                .select({
                  lotNumber: inventoryLots.lotNumber,
                  expiryDate: inventoryLots.expiryDate,
                })
                .from(inventoryLots)
                .where(eq(inventoryLots.id, material.lotId as number));
            });
            return {
              ...material,
              lotNumber: lotResult[0]?.lotNumber || null,
              lotExpiryDate: lotResult[0]?.expiryDate || null,
            };
          }
          return { ...material, lotNumber: null, lotExpiryDate: null };
        })
      );

      // Collect all lot IDs related to this work order
      const relatedLotIds = new Set<number>();
      // 1. Material lots
      materialsWithLots.forEach((m: Record<string, unknown>) => {
        if (m.lotId) relatedLotIds.add(m.lotId as number);
      });
      // 2. Lots matching batch number (produced lot + in-process lot)
      if (workOrder.batchNumber) {
        const batchLots = await executeDbOperation(async (db) => {
          return db.select({ id: inventoryLots.id }).from(inventoryLots)
            .where(eq(inventoryLots.batchNumber, workOrder.batchNumber as string));
        });
        batchLots.forEach((l: { id: number }) => relatedLotIds.add(l.id));
      }

      // Get QC tests for all related lots — include tester/approver IDs +
      // ipc_phase so the production-vs-QC traceability column on the WO
      // detail page can show source + drill-in target.
      let relatedQcTests: Record<string, unknown>[] = [];
      if (relatedLotIds.size > 0) {
        const lotIdArray = Array.from(relatedLotIds);
        const { inArray } = await import('drizzle-orm');
        relatedQcTests = await executeDbOperation(async (db) => {
          return db
            .select({
              id: qualityTests.id,
              lotId: qualityTests.lotId,
              testType: qualityTests.testType,
              // eBMR audit gap #7 — testName was referenced here but neither
              // sqliteQualityTests nor mysqlQualityTests defines a testName
              // column, so the access resolved to `undefined`, fed into
              // Drizzle's select map, and crashed with
              //   TypeError: Cannot convert undefined or null to object
              // (Object.entries deep inside Drizzle's prepare). The frontend
              // already falls back to "Test #${id}" or the sample number,
              // so we just omit the field. Re-introduce when the column is
              // actually added to the schema.
              ipcCriteriaId: qualityTests.ipcCriteriaId,
              numericResult: qualityTests.numericResult,
              specMinValue: qualityTests.specMinValue,
              specMaxValue: qualityTests.specMaxValue,
              sampleNumber: qualityTests.sampleNumber,
              status: qualityTests.status,
              result: qualityTests.result,
              testDate: qualityTests.testDate,
              specSpecification: qualityTests.specSpecification,
              specUnit: qualityTests.specUnit,
              criteriaType: qualityTests.criteriaType,
              notes: qualityTests.notes,
              testedBy: qualityTests.testedBy,
              approvedBy: qualityTests.approvedBy,
              ipcPhase: qualityTests.ipcPhase,
              retestRound: qualityTests.retestRound,
              retestReason: qualityTests.retestReason,
            })
            .from(qualityTests)
            .where(inArray(qualityTests.lotId, lotIdArray));
        });

        // Resolve tester / approver names in one round-trip.
        const userIds = new Set<number>();
        for (const t of relatedQcTests) {
          if (t.testedBy) userIds.add(t.testedBy as number);
          if (t.approvedBy) userIds.add(t.approvedBy as number);
        }
        const userNameMap = new Map<number, string>();
        if (userIds.size > 0) {
          const usersTable = getTableRef('users');
          const userRows = await executeDbOperation(async (db) =>
            db.select({ id: usersTable.id, name: usersTable.name })
              .from(usersTable)
              .where(inArray(usersTable.id, [...userIds]))
          );
          for (const u of userRows) userNameMap.set(u.id as number, u.name as string);
        }

        // Classify each test by sample_number convention so the UI can
        // route the operator back to the page that captured it:
        //   SOP-{execId}-IPC-{criteriaId} → SOP Step  (recorded inline)
        //   IPC-N                          → BOM IPC  (recorded on /ipc page)
        //   testType=incoming              → Incoming QC
        //   testType=final                 → Final QC
        relatedQcTests = relatedQcTests.map((t: Record<string, unknown>) => {
          const sample = String(t.sampleNumber ?? '');
          const sopMatch = sample.match(/^SOP-(\d+)-IPC-(\d+)$/);
          let source: 'sop' | 'bom-ipc' | 'incoming' | 'final' | 'other' = 'other';
          let sopExecutionId: number | null = null;
          let criteriaId: number | null = null;
          if (sopMatch) {
            source = 'sop';
            sopExecutionId = Number(sopMatch[1]);
            criteriaId = Number(sopMatch[2]);
          } else if (sample.startsWith('IPC-')) {
            source = 'bom-ipc';
          } else if (t.testType === 'incoming') {
            source = 'incoming';
          } else if (t.testType === 'final') {
            source = 'final';
          }
          return {
            ...t,
            testCode: `QC-${t.id}`,
            testedAt: t.testDate,
            testedByName: t.testedBy ? (userNameMap.get(t.testedBy as number) ?? null) : null,
            approvedByName: t.approvedBy ? (userNameMap.get(t.approvedBy as number) ?? null) : null,
            source,
            sopExecutionId,
            criteriaId,
          };
        });
      }

      // Calculate yield
      const yieldPercent = workOrder.plannedQuantity && workOrder.actualQuantity
        ? Math.round(((workOrder.actualQuantity as number) / (workOrder.plannedQuantity as number)) * 100 * 100) / 100
        : workOrder.yieldPercentage || null;

      // Calculate material consumption.
      //
      // Display priority for "Actual Qty":
      //   1. weighedQty — the value the operator typed in the Weighing form,
      //      stored in the weighing unit (same unit as plannedQuantity)
      //   2. actualQuantity — stored in PRIMARY unit after verify (cost-accounting
      //      field). Only used as a last resort when weighedQty is missing
      //      (e.g. legacy records, materials issued without going through
      //      the weighing flow).
      //
      // Variance and consumption % are always computed between values of the
      // SAME unit so the number on screen is always meaningful.
      const materialConsumption = materialsWithLots.map((material: Record<string, unknown>) => {
        const planned = material.plannedQuantity as number | null;
        const weighed = material.weighedQty as number | null;
        const actualFallback = material.actualQuantity as number | null;
        const issued = material.issuedQty as number | null;

        // Prefer weighedQty (weighing unit). Only fall back to actualQuantity
        // if no weighing record exists.
        const displayActual = weighed !== null && weighed !== undefined
          ? weighed
          : actualFallback;

        const variance = planned !== null && planned !== undefined && displayActual !== null && displayActual !== undefined
          ? Number(displayActual) - Number(planned)
          : null;

        const consumptionPercent = planned && displayActual
          ? Math.round((Number(displayActual) / Number(planned)) * 100 * 100) / 100
          : null;

        // eBMR audit gap #2 — Issued / Returned / Net Used
        const returnedQty = returnedByItem.get(material.itemId as number) || 0;
        const issuedAmount = issued != null ? Number(issued) : (displayActual != null ? Number(displayActual) : null);
        const netUsed = issuedAmount != null
          ? Math.max(0, issuedAmount - returnedQty)
          : null;

        return {
          ...material,
          plannedQty: planned,
          actualQty: displayActual,
          consumptionPercent,
          variance,
          issuedQty: issuedAmount,
          returnedQty,
          netUsedQty: netUsed,
        };
      });

      // Calculate production time
      let productionTimeHours = null;
      if (workOrder.actualStartDate && workOrder.actualEndDate) {
        const start = new Date(workOrder.actualStartDate as string);
        const end = new Date(workOrder.actualEndDate as string);
        productionTimeHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
      }

      // Fetch BOM operations (production steps)
      const operations = getTableRef('operations');
      const bomId = workOrder.bomId;

      let bomOperations: Record<string, unknown>[] = [];
      if (bomId) {
        bomOperations = await executeDbOperation(async (db) => {
          return db
            .select({
              id: operations.id,
              sequence: operations.sequence,
              name: operations.name,
              description: operations.description,
              standardTime: operations.standardTime,
              setupTime: operations.setupTime,
              cleaningTime: operations.cleaningTime,
              instructions: operations.instructions,
            })
            .from(operations)
            .where(eq(operations.bomId, bomId as number))
            .orderBy(asc(operations.sequence));
        });
      }

      // Fetch batch records for this work order
      const batchRecords = getTableRef('batchRecords');
      const users = getTableRef('users');
      let batchRecordsList: Record<string, unknown>[] = [];
      try {
        batchRecordsList = await executeDbOperation(async (db) => {
          return db
            .select({
              id: batchRecords.id,
              operationId: batchRecords.operationId,
              sequence: batchRecords.sequence,
              stepName: batchRecords.stepName,
              instructions: batchRecords.instructions,
              parameters: batchRecords.parameters,
              actualValues: batchRecords.actualValues,
              status: batchRecords.status,
              startTime: batchRecords.startTime,
              endTime: batchRecords.endTime,
              performedBy: batchRecords.performedBy,
              verifiedBy: batchRecords.verifiedBy,
              verifiedAt: batchRecords.verifiedAt,
              notes: batchRecords.notes,
            })
            .from(batchRecords)
            .where(eq(batchRecords.workOrderId, parseInt(id)))
            .orderBy(asc(batchRecords.sequence));
        });

        // Resolve performer/verifier names
        batchRecordsList = await Promise.all(
          batchRecordsList.map(async (br) => {
            let performerName = null;
            let verifierName = null;
            if (br.performedBy) {
              const u = await executeDbOperation(async (db) =>
                db.select({ name: users.name }).from(users).where(eq(users.id, br.performedBy as number))
              );
              performerName = u[0]?.name ?? null;
            }
            if (br.verifiedBy) {
              const u = await executeDbOperation(async (db) =>
                db.select({ name: users.name }).from(users).where(eq(users.id, br.verifiedBy as number))
              );
              verifierName = u[0]?.name ?? null;
            }
            // Parse JSON fields
            let parameters = null;
            let actualValues = null;
            try {
              if (br.parameters) parameters = JSON.parse(br.parameters as string);
              if (br.actualValues) actualValues = JSON.parse(br.actualValues as string);
            } catch { /* keep as-is */ }
            return { ...br, performerName, verifierName, parameters, actualValues };
          })
        );
      } catch {
        // batch_records table may not exist in older setups
      }

      // Fetch execution workflow data in parallel
      const woId = parseInt(id);
      const [
        sopExecutionData,
        cleaningLogsAll,
        envLogsAll,
        materialWeighingData,
        ipcTestsData,
      ] = await Promise.all([
        getWOSOPExecution(woId).catch(() => []),
        getWOCleaningLogs(woId).catch(() => []),
        getWOEnvironmentalLogs(woId).catch(() => []),
        getWOMaterials(woId).catch(() => []),
        getWOIPCTests(woId).catch(() => []),
      ]);

      // ─── eBMR GMP sections: BOM formula, personnel roster, health, gowning ──

      // (2) Formula / BOM lines — the recipe materials. Reuses bom_lines + items.
      let bomLines: Array<Record<string, unknown>> = [];
      if (workOrder.bomId) {
        try {
          const bomLinesT = getTableRef('bOMLines');
          const itemsT2 = getTableRef('items');
          bomLines = await executeDbOperation(async (db) => {
            return db
              .select({
                sequence: bomLinesT.sequence,
                itemCode: itemsT2.code,
                itemName: itemsT2.nameTh,
                quantity: bomLinesT.quantity,
                unit: bomLinesT.unit,
                percentageInFormula: bomLinesT.percentageInFormula,
                isOptional: bomLinesT.isOptional,
              })
              .from(bomLinesT)
              .leftJoin(itemsT2, eq(bomLinesT.itemId, itemsT2.id))
              .where(eq(bomLinesT.bomId, workOrder.bomId as number))
              .orderBy(asc(bomLinesT.sequence));
          });
        } catch { bomLines = []; }
      }

      // (4) Personnel & verifiers roster — copy of the assignees route select.
      let assignees: Array<Record<string, unknown>> = [];
      try {
        const assigneesTable = getTableRef('workOrderAssignees');
        const employeesTable = getTableRef('HREmployees');
        const positionsTable = getTableRef('HRPositions');
        assignees = await executeDbOperation(async (db) => {
          return db
            .select({
              id: assigneesTable.id,
              employeeId: assigneesTable.employeeId,
              employeeCode: employeesTable.employeeCode,
              firstName: employeesTable.firstName,
              lastName: employeesTable.lastName,
              positionTitle: positionsTable.title,
              role: assigneesTable.role,
            })
            .from(assigneesTable)
            .leftJoin(employeesTable, eq(assigneesTable.employeeId, employeesTable.id))
            .leftJoin(positionsTable, eq(assigneesTable.positionId, positionsTable.id))
            .where(eq(assigneesTable.workOrderId, woId));
        });
      } catch { assignees = []; }

      // (5) Staff health/readiness — latest fitness per assignee BEFORE WO start.
      //     ONE query (inArray) ordered by date desc, reduced to latest-per-employee
      //     in JS (no N+1). Sensitive columns (medicalDetails/examinerNotes) excluded.
      let healthChecks: Array<Record<string, unknown>> = [];
      const employeeIds = [...new Set(assignees.map((a) => Number(a.employeeId)).filter(Boolean))];
      if (employeeIds.length > 0) {
        try {
          const healthT = getTableRef('HRHealthRecords');
          const cutoff = String(workOrder.actualStartDate ?? new Date().toISOString());
          const rows = await executeDbOperation(async (db) => {
            return db
              .select({
                employeeId: healthT.employeeId,
                examinationDate: healthT.examinationDate,
                fitnessStatus: healthT.fitnessStatus,
                restrictions: healthT.restrictions,
                nextExamDue: healthT.nextExamDue,
              })
              .from(healthT)
              .where(inArray(healthT.employeeId, employeeIds))
              .orderBy(asc(healthT.examinationDate));
          });
          // Keep the latest record at or before WO start, per employee.
          const latest = new Map<number, Record<string, unknown>>();
          for (const r of rows as Array<Record<string, unknown>>) {
            if (String(r.examinationDate) > cutoff) continue;
            latest.set(Number(r.employeeId), r); // asc order → last write wins = latest
          }
          healthChecks = [...latest.values()];
        } catch { healthChecks = []; }
      }

      // (6) Gowning record (per-batch).
      const gowningRecord = await getGowningForWorkOrder(woId).catch(() => null);
      const gowning = gowningRecord ? [gowningRecord] : [];

      // (7) Finished-product photos (box / blister / bottle / label) — captured
      //     at the finished-inspection step, keyed by work-order id. Metadata
      //     only (no file bytes) so the eBMR renders thumbnails via /api/attachments/:id.
      let finishedPhotos: Array<{ id: number; fileName: string; mimeType: string }> = [];
      try {
        const rows = await getAttachments('wo_finished_product', woId);
        finishedPhotos = (rows || [])
          .filter((r) => String(r.mimeType || '').startsWith('image/'))
          .map((r) => ({ id: r.id, fileName: r.fileName, mimeType: r.mimeType }));
      } catch { finishedPhotos = []; }

      // ─── eBMR Approval Signatures ────────────────────────────────────
      // 3 signatures pulled from different workflow events:
      //   1. Produced By  ← work_orders.completed_by + completed_at
      //   2. Verified By (QC) ← wo_finished_inspection (status='passed')
      //                         OR quality_tests.approvedBy (testType='finished')
      //   3. Approved By (QA) ← quality_tests.dispositionApprovedBy (final release)
      const signatures: {
        producedBy: { userId: number; name: string; signedAt: string; source: string } | null;
        verifiedByQc: { userId: number; name: string; signedAt: string; source: string } | null;
        approvedByQa: { userId: number; name: string; signedAt: string; source: string } | null;
      } = { producedBy: null, verifiedByQc: null, approvedByQa: null };

      try {
        const users = getTableRef('users');
        const woFinishedInspection = getTableRef('wOFinishedInspection');

        // Collect user IDs to resolve in one query
        const userIds = new Set<number>();
        if (workOrder.completedBy) userIds.add(workOrder.completedBy as number);

        // 2. Finished Inspection — QC
        const finishedInsp = await executeDbOperation(async (db) => {
          return db
            .select({
              inspectorId: woFinishedInspection.inspectorId,
              inspectedAt: woFinishedInspection.inspectedAt,
              reInspectorId: woFinishedInspection.reInspectorId,
              reInspectedAt: woFinishedInspection.reInspectedAt,
              status: woFinishedInspection.status,
            })
            .from(woFinishedInspection)
            .where(eq(woFinishedInspection.workOrderId, woId));
        }).catch(() => []);

        const passedInsp = finishedInsp.find(
          (x: { status?: string }) => x.status === 'passed'
        );
        let qcSource = '';
        let qcUserId: number | null = null;
        let qcSignedAt: string | null = null;

        if (passedInsp) {
          qcUserId = passedInsp.reInspectorId ?? passedInsp.inspectorId ?? null;
          qcSignedAt = passedInsp.reInspectedAt ?? passedInsp.inspectedAt ?? null;
          qcSource = 'wo_finished_inspection';
        } else {
          // Fallback: latest finished-product quality_tests.approvedBy
          const finishedTests = relatedQcTests.filter(
            (t: Record<string, unknown>) =>
              t.testType === 'finished' && t.approvedBy && t.approvedAt
          );
          if (finishedTests.length > 0) {
            const latest = finishedTests.sort(
              (a: Record<string, unknown>, b: Record<string, unknown>) =>
                String(b.approvedAt).localeCompare(String(a.approvedAt))
            )[0];
            qcUserId = latest.approvedBy as number;
            qcSignedAt = latest.approvedAt as string;
            qcSource = 'quality_tests.approvedBy';
          }
        }
        if (qcUserId) userIds.add(qcUserId);

        // 3. QA Approval — eBMR audit gap #6 — prefer explicit
        //    work_orders.qa_approved_by (set when QA signs the eBMR via the
        //    /qa-approve endpoint). Fall back to quality_tests.dispositionApprovedBy
        //    for legacy records.
        let qaUserId: number | null = null;
        let qaSignedAt: string | null = null;
        let qaSource = 'work_orders.qa_approved_by';
        if (workOrder.qaApprovedBy && workOrder.qaApprovedAt) {
          qaUserId = workOrder.qaApprovedBy as number;
          qaSignedAt = String(workOrder.qaApprovedAt);
        } else {
          const disposed = relatedQcTests.filter(
            (t: Record<string, unknown>) =>
              t.dispositionApprovedBy && t.dispositionApprovedAt
          );
          if (disposed.length > 0) {
            const latest = disposed.sort(
              (a: Record<string, unknown>, b: Record<string, unknown>) =>
                String(b.dispositionApprovedAt).localeCompare(String(a.dispositionApprovedAt))
            )[0];
            qaUserId = latest.dispositionApprovedBy as number;
            qaSignedAt = latest.dispositionApprovedAt as string;
            qaSource = 'quality_tests.dispositionApprovedBy';
          }
        }
        if (qaUserId) userIds.add(qaUserId);

        // Resolve user names
        const userMap = new Map<number, string>();
        if (userIds.size > 0) {
          const userRows = await executeDbOperation(async (db) => {
            return db
              .select({ id: users.id, name: users.name })
              .from(users);
          });
          for (const u of userRows) {
            if (userIds.has(u.id as number)) userMap.set(u.id as number, u.name as string);
          }
        }

        if (workOrder.completedBy && workOrder.completedAt) {
          signatures.producedBy = {
            userId: workOrder.completedBy as number,
            name: userMap.get(workOrder.completedBy as number) || '',
            signedAt: String(workOrder.completedAt),
            source: 'work_orders.completed_by',
          };
        }
        if (qcUserId && qcSignedAt) {
          signatures.verifiedByQc = {
            userId: qcUserId,
            name: userMap.get(qcUserId) || '',
            signedAt: String(qcSignedAt),
            source: qcSource,
          };
        }
        if (qaUserId && qaSignedAt) {
          signatures.approvedByQa = {
            userId: qaUserId,
            name: userMap.get(qaUserId) || '',
            signedAt: String(qaSignedAt),
            source: qaSource,
          };
        }
      } catch (err) {
        console.error('Error building eBMR signatures:', err);
      }

      // eBMR audit gap #1 — Production Summary: Bulk Yield + Loss breakdown
      const planned = Number(workOrder.plannedQuantity) || 0;
      const bulkQty = workOrder.bulkOutputQty != null ? Number(workOrder.bulkOutputQty) : null;
      const finishedQty =
        workOrder.finishedOutputQty != null
          ? Number(workOrder.finishedOutputQty)
          : workOrder.actualQuantity != null
            ? Number(workOrder.actualQuantity)
            : null;
      const bulkYieldPercent =
        bulkQty != null && planned > 0
          ? Math.round((bulkQty / planned) * 10000) / 100
          : null;
      const packagingLossQty =
        bulkQty != null && finishedQty != null
          ? Math.max(0, bulkQty - finishedQty)
          : null;
      const packagingLossPercent =
        packagingLossQty != null && bulkQty != null && bulkQty > 0
          ? Math.round((packagingLossQty / bulkQty) * 10000) / 100
          : null;
      const totalLossQty =
        finishedQty != null && planned > 0 ? Math.max(0, planned - finishedQty) : null;
      const totalLossPercent =
        totalLossQty != null && planned > 0
          ? Math.round((totalLossQty / planned) * 10000) / 100
          : null;

      // eBMR (Electronic Batch Manufacturing Record) summary
      const ebmr = {
        batchNumber: workOrder.batchNumber,
        productCode: workOrder.productCode,
        productName: workOrder.productName,
        ttmtCode: workOrder.ttmtCode,
        drugCode24: workOrder.drugCode24,
        gRegNumber: workOrder.gRegNumber,
        plannedQty: workOrder.plannedQuantity,
        actualQty: workOrder.actualQuantity,
        yieldPercent,
        productionTimeHours,
        status: workOrder.status,
        // eBMR audit gap #1 — Production Summary extras
        bulkOutputQty: bulkQty,
        finishedOutputQty: finishedQty,
        bulkYieldPercent,
        packagingLossQty,
        packagingLossPercent,
        totalLossQty,
        totalLossPercent,
        productUnit: workOrder.unit,
        materials: materialConsumption,
        qcTests: relatedQcTests,
        operations: bomOperations,
        batchRecords: batchRecordsList,
        timeline: {
          plannedStart: workOrder.plannedStartDate,
          plannedEnd: workOrder.plannedEndDate,
          actualStart: workOrder.actualStartDate,
          actualEnd: workOrder.actualEndDate,
        },
        // Execution workflow data
        sopExecution: sopExecutionData,
        cleaningLogs: cleaningLogsAll,
        environmentalLogs: envLogsAll,
        materialWeighing: materialWeighingData,
        ipcTests: Array.isArray(ipcTestsData) ? ipcTestsData : [],
        // eBMR GMP structure (sections 2,4,5,6) — empty arrays for old WOs
        bomCode: workOrder.bomCode ?? null,
        bomName: workOrder.bomName ?? null,
        bomVersion: workOrder.bomVersion ?? null,
        bomLines,
        assignees,
        healthChecks,
        gowning,
        // Finished-product photos (section 7 inspection phase)
        finishedPhotos,
        // eBMR Approval Signatures (Produced By / Verified By QC / Approved By QA)
        signatures,
      };

      return NextResponse.json({
        success: true,
        data: {
          workOrder,
          materials: materialConsumption,
          qcTests: relatedQcTests,
          ebmr,
          summary: {
            yieldPercent,
            productionTimeHours,
            materialCount: materialsWithLots.length,
            qcTestCount: relatedQcTests.length,
            qcPassCount: relatedQcTests.filter((t: Record<string, unknown>) => t.status === 'pass').length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching work order details:', error);
      return serverErrorResponse(error);
    }
  });
}
