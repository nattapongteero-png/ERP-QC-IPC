/**
 * Environmental Inspection Records — history list
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listInspectionRecords } from '@/lib/services/environmental-inspection.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 200;
  const items = await listInspectionRecords({ limit });
  return NextResponse.json({ items });
}
