import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const qualityTests = getTableRef('qualityTests');
      const qualitySpecs = getTableRef('qualitySpecs');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');
      const users = getTableRef('users');

      // Get test details
      const testResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: qualityTests.id,
            lotId: qualityTests.lotId,
            specId: qualityTests.specId,
            testType: qualityTests.testType,
            sampleNumber: qualityTests.sampleNumber,
            testDate: qualityTests.testDate,
            result: qualityTests.result,
            numericResult: qualityTests.numericResult,
            status: qualityTests.status,
            testedBy: qualityTests.testedBy,
            approvedBy: qualityTests.approvedBy,
            approvedAt: qualityTests.approvedAt,
            notes: qualityTests.notes,
            createdAt: qualityTests.createdAt,
            updatedAt: qualityTests.updatedAt,
          })
          .from(qualityTests)
          .where(eq(qualityTests.id, parseInt(id)));
      });

      if (testResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Quality test not found' }, { status: 404 });
      }

      const test = testResult[0];

      // Get lot details with item info
      let lotInfo: Record<string, unknown> | null = null;
      let itemInfo: Record<string, unknown> | null = null;
      if (test.lotId) {
        const lotResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: inventoryLots.id,
              lotNumber: inventoryLots.lotNumber,
              itemId: inventoryLots.itemId,
              quantity: inventoryLots.quantity,
              status: inventoryLots.status,
              expiryDate: inventoryLots.expiryDate,
              manufacturingDate: inventoryLots.manufacturingDate,
            })
            .from(inventoryLots)
            .where(eq(inventoryLots.id, test.lotId));
        });
        lotInfo = lotResult[0] || null;

        // Get item info from lot
        const lotItemId = lotInfo?.itemId as number | undefined;
        if (lotItemId) {
          const itemResult = await executeDbOperation(async (db) => {
            return db
              .select({
                id: items.id,
                code: items.code,
                nameTh: items.nameTh,
                nameEn: items.nameEn,
                type: items.type,
                primaryUnit: items.primaryUnit,
              })
              .from(items)
              .where(eq(items.id, lotItemId));
          });
          itemInfo = itemResult[0] || null;
        }
      }

      // Get specification details
      let specInfo = null;
      if (test.specId) {
        const specResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: qualitySpecs.id,
              itemId: qualitySpecs.itemId,
              testName: qualitySpecs.testName,
              testMethod: qualitySpecs.testMethod,
              specification: qualitySpecs.specification,
              minValue: qualitySpecs.minValue,
              maxValue: qualitySpecs.maxValue,
              unit: qualitySpecs.unit,
              isCritical: qualitySpecs.isCritical,
            })
            .from(qualitySpecs)
            .where(eq(qualitySpecs.id, test.specId));
        });
        specInfo = specResult[0] || null;
      }

      // Get tester info
      let testerInfo = null;
      if (test.testedBy) {
        const testerResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, test.testedBy));
        });
        testerInfo = testerResult[0] || null;
      }

      // Get approver info
      let approverInfo = null;
      if (test.approvedBy) {
        const approverResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, test.approvedBy));
        });
        approverInfo = approverResult[0] || null;
      }

      // Calculate pass/fail based on spec
      let specCompliance = null;
      if (specInfo && test.numericResult !== null) {
        const actual = test.numericResult;
        const min = specInfo.minValue;
        const max = specInfo.maxValue;
        
        if (min !== null && max !== null) {
          specCompliance = actual >= min && actual <= max ? 'pass' : 'fail';
        } else if (min !== null) {
          specCompliance = actual >= min ? 'pass' : 'fail';
        } else if (max !== null) {
          specCompliance = actual <= max ? 'pass' : 'fail';
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          test,
          item: itemInfo,
          lot: lotInfo,
          specification: specInfo,
          tester: testerInfo,
          approver: approverInfo,
          analysis: {
            specCompliance,
            isWithinSpec: specCompliance === 'pass',
            isCritical: specInfo?.isCritical || false,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching quality test details:', error);
      return serverErrorResponse(error);
    }
  });
}
