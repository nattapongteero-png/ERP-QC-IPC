import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import { 
  sqliteQualityTests, sqliteQualitySpecs, sqliteItems, sqliteInventoryLots, sqliteUsers,
  mysqlQualityTests, mysqlQualitySpecs, mysqlItems, mysqlInventoryLots, mysqlUsers
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const qualityTests = isSqlite() ? sqliteQualityTests : mysqlQualityTests;
      const qualitySpecs = isSqlite() ? sqliteQualitySpecs : mysqlQualitySpecs;
      const items = isSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const users = isSqlite() ? sqliteUsers : mysqlUsers;

      // Get test details
      const testResult = await (db as any)
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

      if (testResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Quality test not found' }, { status: 404 });
      }

      const test = testResult[0];

      // Get lot details with item info
      let lotInfo = null;
      let itemInfo = null;
      if (test.lotId) {
        const lotResult = await (db as any)
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
        lotInfo = lotResult[0] || null;

        // Get item info from lot
        if (lotInfo?.itemId) {
          const itemResult = await (db as any)
            .select({
              id: items.id,
              code: items.code,
              nameTh: items.nameTh,
              nameEn: items.nameEn,
              type: items.type,
              primaryUnit: items.primaryUnit,
            })
            .from(items)
            .where(eq(items.id, lotInfo.itemId));
          itemInfo = itemResult[0] || null;
        }
      }

      // Get specification details
      let specInfo = null;
      if (test.specId) {
        const specResult = await (db as any)
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
        specInfo = specResult[0] || null;
      }

      // Get tester info
      let testerInfo = null;
      if (test.testedBy) {
        const testerResult = await (db as any)
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, test.testedBy));
        testerInfo = testerResult[0] || null;
      }

      // Get approver info
      let approverInfo = null;
      if (test.approvedBy) {
        const approverResult = await (db as any)
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, test.approvedBy));
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
