/**
 * Scale Verifications — history per scale + current valid verification
 * Feature: 021-scale-verification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listVerificationsForScale,
  getCurrentVerificationForScale,
} from '@/lib/services/scale-verification.service';

interface Params {
  params: Promise<{ scaleId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scaleId } = await params;
  const sid = Number.parseInt(scaleId, 10);
  if (Number.isNaN(sid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [history, current] = await Promise.all([
    listVerificationsForScale(sid),
    getCurrentVerificationForScale(sid),
  ]);

  return NextResponse.json({ current, history });
}
