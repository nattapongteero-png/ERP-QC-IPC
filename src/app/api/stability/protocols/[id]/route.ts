/**
 * Stability Protocol Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/protocols/[id] - Get protocol details
 * PATCH /api/stability/protocols/[id] - Update protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProtocolById, updateProtocol } from '@/lib/services/stability-service';
import { protocolUpdateSchema } from '@/lib/validation/stability';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const protocolId = parseInt(id, 10);
    if (isNaN(protocolId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid protocol ID' },
        { status: 400 }
      );
    }

    const protocol = await getProtocolById(protocolId);
    if (!protocol) {
      return NextResponse.json(
        { success: false, error: 'Protocol not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: protocol,
    });
  } catch (error) {
    console.error('Error fetching protocol:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch protocol' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const protocolId = parseInt(id, 10);
    if (isNaN(protocolId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid protocol ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = protocolUpdateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const protocol = await updateProtocol(protocolId, validated.data, session.userId);
    if (!protocol) {
      return NextResponse.json(
        { success: false, error: 'Protocol not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: protocol,
    });
  } catch (error) {
    console.error('Error updating protocol:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update protocol',
      },
      { status: 500 }
    );
  }
}
