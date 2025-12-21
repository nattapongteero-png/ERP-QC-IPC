// HR Audit Log API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getHRAuditLogs } from '@/lib/services/hr.service';
import { z } from 'zod';
import type { HRAuditAction } from '@/types/hr';

const auditQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  tableName: z.string().optional(),
  recordId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/hr/audit - List HR audit logs
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = auditQuerySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters: {
          userId?: number;
          action?: HRAuditAction;
          tableName?: string;
          recordId?: number;
          fromDate?: string;
          toDate?: string;
          skip?: number;
          take?: number;
        } = {};

        if (queryResult.success) {
          if (queryResult.data.userId) {
            filters.userId = queryResult.data.userId;
          }
          if (queryResult.data.action) {
            filters.action = queryResult.data.action as HRAuditAction;
          }
          if (queryResult.data.tableName) {
            filters.tableName = queryResult.data.tableName;
          }
          if (queryResult.data.recordId) {
            filters.recordId = queryResult.data.recordId;
          }
          if (queryResult.data.fromDate) {
            filters.fromDate = queryResult.data.fromDate;
          }
          if (queryResult.data.toDate) {
            filters.toDate = queryResult.data.toDate;
          }
          filters.skip = queryResult.data.skip;
          filters.take = queryResult.data.take;
        }

        const result = await getHRAuditLogs(filters);
        return successResponse({
          data: result.data,
          total: result.total,
          skip: filters.skip || 0,
          take: filters.take || 50,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
