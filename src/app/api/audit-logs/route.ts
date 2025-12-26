/**
 * Audit Logs API
 *
 * GET /api/audit-logs - Fetch audit logs with filtering
 * Query params:
 *   - tableName: Filter by table/entity type
 *   - recordId: Filter by specific record ID
 *   - userId: Filter by user who made changes
 *   - action: Filter by action type (CREATE, UPDATE, DELETE, etc.)
 *   - fromDate: Filter from date (YYYY-MM-DD)
 *   - toDate: Filter to date (YYYY-MM-DD)
 *   - searchText: Search in old/new values
 *   - limit: Number of records to return (default: 50)
 *   - offset: Offset for pagination (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuditLogs,
  getEntityModifiers,
  getEntityActionTypes,
} from '@/lib/services/audit-log.service';
import type { AuditLogFilters, AuditLogResponse } from '@/types/audit-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const filters: AuditLogFilters = {};

    const tableName = searchParams.get('tableName');
    if (tableName) filters.tableName = tableName;

    const recordId = searchParams.get('recordId');
    if (recordId) filters.recordId = parseInt(recordId, 10);

    const userId = searchParams.get('userId');
    if (userId) filters.userId = parseInt(userId, 10);

    const action = searchParams.get('action');
    if (action) filters.action = action;

    const fromDate = searchParams.get('fromDate');
    if (fromDate) filters.fromDate = fromDate;

    const toDate = searchParams.get('toDate');
    if (toDate) filters.toDate = toDate;

    const searchText = searchParams.get('searchText');
    if (searchText) filters.searchText = searchText;

    const limit = searchParams.get('limit');
    filters.limit = limit ? parseInt(limit, 10) : 50;

    const offset = searchParams.get('offset');
    filters.offset = offset ? parseInt(offset, 10) : 0;

    // Check for special queries
    const getModifiers = searchParams.get('getModifiers') === 'true';
    const getActions = searchParams.get('getActions') === 'true';

    // Get modifiers for entity (distinct users who modified)
    if (getModifiers && filters.tableName && filters.recordId) {
      const modifiers = await getEntityModifiers(filters.tableName, filters.recordId);
      return NextResponse.json({
        success: true,
        data: modifiers,
      });
    }

    // Get action types for entity
    if (getActions && filters.tableName && filters.recordId) {
      const actions = await getEntityActionTypes(filters.tableName, filters.recordId);
      return NextResponse.json({
        success: true,
        data: actions,
      });
    }

    // Get audit logs
    const { logs, total } = await getAuditLogs(filters);

    const response: AuditLogResponse = {
      success: true,
      data: logs,
      total,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
      },
      { status: 500 }
    );
  }
}
