import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, useSqlite } from '@/lib/db';
import {
  sqliteQualitySpecs,
  sqliteQualityTests,
  sqliteItems,
  mysqlQualitySpecs,
  mysqlQualityTests,
  mysqlItems,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/quality/specs/[id] - Get quality specification details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const specId = parseInt(id);

      if (isNaN(specId)) {
        return errorResponse('Invalid specification ID');
      }

      const db = await getDb();
      const isSqlite = useSqlite();
      const specsTable = isSqlite ? sqliteQualitySpecs : mysqlQualitySpecs;
      const testsTable = isSqlite ? sqliteQualityTests : mysqlQualityTests;
      const itemsTable = isSqlite ? sqliteItems : mysqlItems;

      // Get spec with item info
      const specResult = await (db as any)
        .select({
          id: specsTable.id,
          itemId: specsTable.itemId,
          itemCode: itemsTable.code,
          itemName: itemsTable.nameTh,
          itemType: itemsTable.type,
          testName: specsTable.testName,
          testMethod: specsTable.testMethod,
          specification: specsTable.specification,
          minValue: specsTable.minValue,
          maxValue: specsTable.maxValue,
          unit: specsTable.unit,
          isCritical: specsTable.isCritical,
          isActive: specsTable.isActive,
          createdAt: specsTable.createdAt,
          updatedAt: specsTable.updatedAt,
        })
        .from(specsTable)
        .leftJoin(itemsTable, eq(specsTable.itemId, itemsTable.id))
        .where(eq(specsTable.id, specId));

      if (specResult.length === 0) {
        return notFoundResponse('Quality specification not found');
      }

      const spec = specResult[0];

      // Get recent tests using this spec
      const recentTests = await (db as any)
        .select({
          id: testsTable.id,
          testType: testsTable.testType,
          sampleNumber: testsTable.sampleNumber,
          testDate: testsTable.testDate,
          result: testsTable.result,
          numericResult: testsTable.numericResult,
          status: testsTable.status,
          createdAt: testsTable.createdAt,
        })
        .from(testsTable)
        .where(eq(testsTable.specId, specId))
        .orderBy(testsTable.createdAt)
        .limit(10);

      // Calculate test statistics
      const allTests = await (db as any)
        .select({
          status: testsTable.status,
        })
        .from(testsTable)
        .where(eq(testsTable.specId, specId));

      const stats = {
        totalTests: allTests.length,
        passCount: allTests.filter((t: any) => t.status === 'pass').length,
        failCount: allTests.filter((t: any) => t.status === 'fail').length,
        pendingCount: allTests.filter((t: any) => t.status === 'pending').length,
        retestCount: allTests.filter((t: any) => t.status === 'retest').length,
      };

      return successResponse({
        ...spec,
        recentTests,
        stats,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:read']);
}

// PUT /api/quality/specs/[id] - Update quality specification
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const specId = parseInt(id);

      if (isNaN(specId)) {
        return errorResponse('Invalid specification ID');
      }

      const body = await request.json();
      const {
        testName,
        testMethod,
        specification,
        minValue,
        maxValue,
        unit,
        isCritical,
        isActive,
      } = body;

      const db = await getDb();
      const isSqlite = useSqlite();
      const specsTable = isSqlite ? sqliteQualitySpecs : mysqlQualitySpecs;

      // Check if spec exists
      const existing = await (db as any)
        .select()
        .from(specsTable)
        .where(eq(specsTable.id, specId));

      if (existing.length === 0) {
        return notFoundResponse('Quality specification not found');
      }

      const oldSpec = existing[0];

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: isSqlite ? new Date().toISOString() : new Date(),
      };

      if (testName !== undefined) updateData.testName = testName;
      if (testMethod !== undefined) updateData.testMethod = testMethod;
      if (specification !== undefined) updateData.specification = specification;
      if (minValue !== undefined) updateData.minValue = minValue;
      if (maxValue !== undefined) updateData.maxValue = maxValue;
      if (unit !== undefined) updateData.unit = unit;
      if (isCritical !== undefined) updateData.isCritical = isCritical;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Update spec
      await (db as any)
        .update(specsTable)
        .set(updateData)
        .where(eq(specsTable.id, specId));

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'quality_specs',
        recordId: specId,
        oldValue: oldSpec,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: specId }, 'Quality specification updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}

// DELETE /api/quality/specs/[id] - Delete quality specification
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const specId = parseInt(id);

      if (isNaN(specId)) {
        return errorResponse('Invalid specification ID');
      }

      const db = await getDb();
      const isSqlite = useSqlite();
      const specsTable = isSqlite ? sqliteQualitySpecs : mysqlQualitySpecs;
      const testsTable = isSqlite ? sqliteQualityTests : mysqlQualityTests;

      // Check if spec exists
      const existing = await (db as any)
        .select()
        .from(specsTable)
        .where(eq(specsTable.id, specId));

      if (existing.length === 0) {
        return notFoundResponse('Quality specification not found');
      }

      // Check if there are any tests using this spec
      const testsCount = await (db as any)
        .select({ count: testsTable.id })
        .from(testsTable)
        .where(eq(testsTable.specId, specId));

      if (testsCount.length > 0 && testsCount[0].count > 0) {
        return errorResponse(
          'Cannot delete specification that has associated tests. Deactivate it instead.',
          400
        );
      }

      // Delete spec
      await (db as any).delete(specsTable).where(eq(specsTable.id, specId));

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'quality_specs',
        recordId: specId,
        oldValue: existing[0],
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: specId }, 'Quality specification deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
