/**
 * CAPA Attachments API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1) - Phase 1 Critical
 *
 * Endpoints for managing CAPA document attachments.
 * Supports GMP document control requirements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import {
  getCapaAttachments,
  addCapaAttachment,
  getCapaById,
} from '@/lib/services/capa-service';
import { capaAttachmentCreateSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/capa/[id]/attachments
 * Get all attachments for a CAPA
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const capaId = parseInt(id, 10);

    if (isNaN(capaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CAPA ID' },
        { status: 400 }
      );
    }

    // Verify CAPA exists
    const capa = await getCapaById(capaId);
    if (!capa) {
      return NextResponse.json(
        { success: false, error: 'CAPA not found' },
        { status: 404 }
      );
    }

    const attachments = await getCapaAttachments(capaId);

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error('Error fetching CAPA attachments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/capa/[id]/attachments
 * Add an attachment to a CAPA
 *
 * Note: This endpoint handles attachment metadata.
 * Actual file upload should be handled by a separate file storage service
 * (e.g., S3, Azure Blob, or local file system) and the file path/URL
 * should be passed as the fileName parameter.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const capaId = parseInt(id, 10);

    if (isNaN(capaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CAPA ID' },
        { status: 400 }
      );
    }

    // Verify CAPA exists and is not closed
    const capa = await getCapaById(capaId);
    if (!capa) {
      return NextResponse.json(
        { success: false, error: 'CAPA not found' },
        { status: 404 }
      );
    }

    if (capa.status === 'closed' || capa.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Cannot add attachments to closed or cancelled CAPA' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = capaAttachmentCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const userId = session.userId;
    const attachment = await addCapaAttachment(capaId, validation.data, userId);

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    console.error('Error adding CAPA attachment:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to add attachment' },
      { status: 500 }
    );
  }
}
