/**
 * Maintenance Plan Templates — admin CRUD + apply
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import {
  createMaintenancePlanTemplateSchema,
  applyTemplateSchema,
} from '@/lib/validation/equipment-notifications';
import {
  listTemplates,
  createTemplate,
  applyTemplateToEquipment,
} from '@/lib/services/maintenance-plan-template.service';
import { EquipmentNotificationError } from '@/types/equipment-notifications';

const CONFIG_PERMISSION = 'equipment:notifications:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
  const items = await listTemplates(includeInactive);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));

  // Apply branch: if body has templateId + equipmentIds, treat as apply call
  if (body?.templateId && Array.isArray(body?.equipmentIds)) {
    const applyParsed = applyTemplateSchema.safeParse(body);
    if (!applyParsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', issues: applyParsed.error.issues },
        { status: 400 },
      );
    }
    try {
      const result = await applyTemplateToEquipment(
        applyParsed.data.templateId,
        applyParsed.data.equipmentIds,
      );
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof EquipmentNotificationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.code === 'NOT_FOUND' ? 404 : 409 },
        );
      }
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }

  // Create branch
  const parsed = createMaintenancePlanTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const created = await createTemplate(parsed.data, session.userId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof EquipmentNotificationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'INVALID_TEMPLATE' ? 409 : 500 },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
