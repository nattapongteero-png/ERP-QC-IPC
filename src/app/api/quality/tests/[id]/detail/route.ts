import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import { 
  sqliteQualityTests, sqliteQualitySpecs, sqliteItems, sqliteInventoryLots, sqliteWorkOrders, sqliteUsers,
  mysqlQualityTests, mysqlQualitySpecs, mysqlItems, mysqlInventoryLots, mysqlWorkOrders, mysqlUsers
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
      const qualityTests = useSqlite() ? sqliteQualityTests : mysqlQualityTests;
      const qualitySpecs = useSqlite() ? sqliteQualitySpecs : mysqlQualitySpecs;
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const workOrders = useSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
      const users = useSqlite() ? sqliteUsers : mysqlUsers;

      // Get test details
      const testResult = await db
        .select({
          id: qualityTests.id,
          testCode: qualityTests.testCode,
          testType: qualityTests.testType,
          itemId: qualityTests.itemId,
          lotId: qualityTests.lotId,
          woId: qualityTests.woId,
          specId: qualityTests.specId,
          status: qualityTests.status,
          result: qualityTests.result,
          actualValue: qualityTests.actualValue,
          testedBy: qualityTests.testedBy,
          testedAt: qualityTests.testedAt,
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

      // Get item details
      let itemInfo = null;
      if (test.itemId) {
        const itemResult = await db
          .select({
            id: items.id,
            code: items.code,
            nameTh: items.nameTh,
            nameEn: items.nameEn,
            type: items.type,
            unit: items.unit,
          })
          .from(items)
          .where(eq(items.id, test.itemId));
        itemInfo = itemResult[0] || null;
      }

      // Get lot details
      let lotInfo = null;
      if (test.lotId) {
        const lotResult = await db
          .select({
            id: inventoryLots.id,
            lotNumber: inventoryLots.lotNumber,
            quantity: inventoryLots.quantity,
            status: inventoryLots.status,
            expiryDate: inventoryLots.expiryDate,
          })
          .from(inventoryLots)
          .where(eq(inventoryLots.id, test.lotId));
        lotInfo = lotResult[0] || null;
      }

      // Get work order details
      let woInfo = null;
      if (test.woId) {
        const woResult = await db
          .select({
            id: workOrders.id,
            woNumber: workOrders.woNumber,
            batchNumber: workOrders.batchNumber,
            status: workOrders.status,
          })
          .from(workOrders)
          .where(eq(workOrders.id, test.woId));
        woInfo = woResult[0] || null;
      }

      // Get specification details
      let specInfo = null;
      if (test.specId) {
        const specResult = await db
          .select({
            id: qualitySpecs.id,
            specCode: qualitySpecs.specCode,
            parameter: qualitySpecs.parameter,
            method: qualitySpecs.method,
            minValue: qualitySpecs.minValue,
            maxValue: qualitySpecs.maxValue,
            targetValue: qualitySpecs.targetValue,
            unit: qualitySpecs.unit,
          })
          .from(qualitySpecs)
          .where(eq(qualitySpecs.id, test.specId));
        specInfo = specResult[0] || null;
      }

      // Get tester info
      let testerInfo = null;
      if (test.testedBy) {
        const testerResult = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, test.testedBy));
        testerInfo = testerResult[0] || null;
      }

      // Calculate pass/fail based on spec
      let specCompliance = null;
      if (specInfo && test.actualValue !== null) {
        const actual = parseFloat(test.actualValue);
        const min = specInfo.minValue ? parseFloat(specInfo.minValue) : null;
        const max = specInfo.maxValue ? parseFloat(specInfo.maxValue) : null;
        
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
          workOrder: woInfo,
          specification: specInfo,
          tester: testerInfo,
          analysis: {
            specCompliance,
            isWithinSpec: specCompliance === 'pass',
          },
        },
      });
    } catch (error) {
      console.error('Error fetching quality test details:', error);
      return serverErrorResponse(error);
    }
  });
}
