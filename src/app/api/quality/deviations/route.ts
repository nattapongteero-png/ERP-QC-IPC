import { NextRequest } from 'next/server';
import { eq, like, sql, and, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// Generate deviation number
function generateDeviationNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DEV${year}${month}${random}`;
}

// GET /api/quality/deviations - List deviations
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const severity = searchParams.get('severity') || '';

      const deviationsTable = getTableRef('deviations');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          like(deviationsTable.deviationNumber, `%${search}%`)
        );
      }
      if (status) {
        conditions.push(eq(deviationsTable.status, status));
      }
      if (severity) {
        conditions.push(eq(deviationsTable.severity, severity));
      }

      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(deviationsTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      const offset = (pagination.page - 1) * pagination.limit;
      const deviations = await executeDbOperation(async (db) => {
        let query = db.select().from(deviationsTable);

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(deviations, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:read']);
}

// POST /api/quality/deviations - Create deviation
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        title,
        description,
        sourceType,
        sourceId,
        severity,
        assignedTo,
        dueDate,
      } = body;
      
      if (!title || !description) {
        return errorResponse('Title and description are required');
      }
      
      const validSeverities = ['minor', 'major', 'critical'];
      if (severity && !validSeverities.includes(severity)) {
        return errorResponse(`Severity must be one of: ${validSeverities.join(', ')}`);
      }

      const deviationsTable = getTableRef('deviations');

      const deviationNumber = generateDeviationNumber();

      const result = await executeDbOperation(async (db) => {
        return db.insert(deviationsTable).values({
          deviationNumber,
          title,
          description,
          sourceType,
          sourceId,
          severity: severity || 'minor',
          status: 'open',
          reportedBy: session.userId,
          assignedTo,
          dueDate: parseDbDate(dueDate),
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const deviationId = getInsertId(result);
      
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'deviations',
        recordId: Number(deviationId),
        newValue: { deviationNumber, title, severity, sourceType },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(deviationId), deviationNumber }, 'Deviation created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
