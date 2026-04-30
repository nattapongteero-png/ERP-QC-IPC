/**
 * Unified audit-trail API — GET /api/quality/audit-trail
 *
 * Aggregates audit rows from audit_trail + qc_sample_signatures +
 * coa_signatures + coa_print_history + coa_verify_log + qc_oos_investigations
 * via the audit-viewer service. Supports filtering by entity, user, action,
 * date range and free-text search.
 *
 * Permission gate: only users whose legacy or HR role expands to one of
 * ['admin','qc','quality','manager'] can read. We additionally accept the
 * explicit role labels 'qc_manager','qa_manager','auditor' (set in the HR
 * role module) by checking the raw role string.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from '@/lib/api-utils';
import { getSession, isAdminRole } from '@/lib/auth';
import { expandRole } from '@/lib/auth/role-mapping';
import {
  getAuditTrail,
  getAuditKpis,
  type AuditTrailFilters,
  type AuditEntityType,
  type AuditActionType,
} from '@/lib/services/audit-viewer.service';

const ALLOWED_RAW_ROLES = new Set([
  'admin',
  'qc',
  'qa',
  'manager',
  'qc_manager',
  'qa_manager',
  'auditor',
]);

function canViewAudit(role: string | null | undefined): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  if (ALLOWED_RAW_ROLES.has(role.toLowerCase())) return true;
  // HR role expansion
  const expanded = expandRole(role);
  return expanded.some(
    (r) =>
      r === 'admin' ||
      r === 'qc' ||
      r === 'qa' ||
      r === 'manager' ||
      r === 'qc_manager' ||
      r === 'qa_manager' ||
      r === 'auditor',
  );
}

const ENTITY_TYPES: AuditEntityType[] = [
  'qc_sample',
  'coa_document',
  'material_return',
  'wo_sop_execution',
  'other',
];
const ACTION_TYPES: AuditActionType[] = [
  'create',
  'update',
  'delete',
  'sign',
  'approve',
  'release',
  'verify',
  'print',
  'investigate',
  'other',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse('Please login to continue');
    if (!canViewAudit(session.role)) {
      return forbiddenResponse(
        'Audit trail access requires QA Manager / Admin / Auditor role.',
      );
    }

    const url = new URL(request.url);
    const sp = url.searchParams;

    const entityTypeRaw = sp.get('entityType') ?? undefined;
    const actionTypeRaw = sp.get('actionType') ?? undefined;
    const entityTypeOk =
      entityTypeRaw && ENTITY_TYPES.includes(entityTypeRaw as AuditEntityType);
    const actionTypeOk =
      actionTypeRaw && ACTION_TYPES.includes(actionTypeRaw as AuditActionType);

    const filters: AuditTrailFilters = {
      entityType: entityTypeOk
        ? (entityTypeRaw as AuditEntityType)
        : undefined,
      entityId: sp.get('entityId') ? Number(sp.get('entityId')) : undefined,
      userId: sp.get('userId') ? Number(sp.get('userId')) : undefined,
      actionType: actionTypeOk
        ? (actionTypeRaw as AuditActionType)
        : undefined,
      dateFrom: sp.get('dateFrom') ?? undefined,
      dateTo: sp.get('dateTo') ?? undefined,
      search: sp.get('search') ?? undefined,
      page: sp.get('page') ? Number(sp.get('page')) : 1,
      limit: sp.get('limit') ? Number(sp.get('limit')) : 50,
    };

    const wantKpis = sp.get('kpis') === '1';

    const [items, kpis] = await Promise.all([
      getAuditTrail(filters),
      wantKpis ? getAuditKpis() : Promise.resolve(null),
    ]);

    return successResponse({
      ...items,
      kpis,
    });
  } catch (error) {
    console.error('[audit-trail] error:', error);
    if (error instanceof Error) {
      return errorResponse(error.message, 500);
    }
    return serverErrorResponse(error);
  }
}
