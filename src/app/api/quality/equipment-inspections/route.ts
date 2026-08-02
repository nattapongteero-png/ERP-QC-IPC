/**
 * Equipment Inspections — GET (registry feed of all equipment + due status, or
 * ?equipmentId=<id> for that equipment's history), POST (record an inspection).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listEquipmentForInspection,
  getInspectionHistory,
  createEquipmentInspection,
  type EquipmentInspectionInput,
} from '@/lib/services/equipment-inspection.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const equipmentId = searchParams.get('equipmentId');
  const lineCategory = searchParams.get('lineCategory') || undefined;

  if (equipmentId) {
    const history = await getInspectionHistory(Number(equipmentId));
    return NextResponse.json({ success: true, data: history });
  }
  const items = await listEquipmentForInspection(lineCategory);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<EquipmentInspectionInput>;
  if (!body.equipmentId || (body.result !== 'pass' && body.result !== 'fail')) {
    return NextResponse.json({ success: false, error: 'Missing equipmentId or result (pass|fail)' }, { status: 400 });
  }

  try {
    const created = await createEquipmentInspection(
      {
        equipmentId: Number(body.equipmentId),
        inspectionType: body.inspectionType,
        result: body.result,
        checklistResults: body.checklistResults,
        notes: body.notes,
      },
      session.userId,
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
