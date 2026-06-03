/**
 * Trend endpoint — inspection trends OR water trends
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTrend } from '@/lib/services/environmental-inspection.service';
import { getWaterTrend } from '@/lib/services/water-quality.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const kind = sp.get('kind'); // 'inspection' | 'water'
  const parameter = sp.get('parameter');
  const days = sp.get('days') ? Number(sp.get('days')) : 30;

  if (!parameter) return NextResponse.json({ error: 'parameter required' }, { status: 400 });

  if (kind === 'water') {
    const samplePointId = sp.get('samplePointId');
    if (!samplePointId) return NextResponse.json({ error: 'samplePointId required' }, { status: 400 });
    const series = await getWaterTrend(Number(samplePointId), parameter, days);
    return NextResponse.json({ series });
  }

  const targetType = sp.get('targetType') as any;
  const targetId = sp.get('targetId');
  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'targetType + targetId required' }, { status: 400 });
  }
  const series = await getTrend(targetType, Number(targetId), parameter, days);
  return NextResponse.json({ series });
}
