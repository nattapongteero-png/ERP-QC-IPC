/**
 * CAPA Attachment Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1) - Phase 1 Critical
 *
 * Endpoint for deleting a specific CAPA attachment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import {
  deleteCapaAttachment,
  getCapaById,
  getCapaAttachments,
} from '@/lib/services/capa-service';

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

/**
 * DELETE /api/capa/[id]/attachments/[attachmentId]
 * Delete an attachment from a CAPA
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id, attachmentId } = await params;
    const capaId = parseInt(id, 10);
    const attachId = parseInt(attachmentId, 10);

    if (isNaN(capaId) || isNaN(attachId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
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
        { success: false, error: 'Cannot delete attachments from closed or cancelled CAPA' },
        { status: 400 }
      );
    }

    // Verify attachment belongs to this CAPA
    const attachments = await getCapaAttachments(capaId);
    const attachment = attachments.find((a) => a.id === attachId);
    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      );
    }

    const userId = session.userId;
    await deleteCapaAttachment(attachId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting CAPA attachment:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
