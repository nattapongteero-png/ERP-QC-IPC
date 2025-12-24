/**
 * Inventory Lot Documents API
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US12 - T055)
 *
 * FR-057: COA/MSDS Document Attachments
 *
 * Endpoints for managing lot-specific documents (COA, MSDS, etc.)
 * Proxies to the reusable attachments API with moduleName='inventory_lot'
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAttachments,
  createAttachment,
} from '@/lib/services/attachment-service';
import {
  isValidFileExtension,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validation/attachments';
import { getLotDetails } from '@/lib/services/inventory.service';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for document upload - simplified version focusing on lot documents
const lotDocumentCreateSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE, 'File size must be less than 10MB'),
  mimeType: z.string().min(1).max(100),
  fileData: z.string().min(1, 'File data is required'), // Base64-encoded
  description: z.string().max(500).optional(),
  category: z.enum(['coa', 'msds', 'certificate', 'lab_result', 'specification', 'photo', 'other']).optional(),
});

/**
 * GET /api/inventory/lots/[id]/documents
 * Get all documents/attachments for a lot
 *
 * Query params:
 * - category: Filter by document category (coa, msds, certificate, etc.)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const lotId = parseInt(id, 10);

        if (isNaN(lotId) || lotId <= 0) {
          return errorResponse('Invalid lot ID', 400);
        }

        // Verify lot exists
        const lot = await getLotDetails(lotId);
        if (!lot) {
          return notFoundResponse('Lot not found');
        }

        // Get attachments for this lot
        const attachments = await getAttachments('inventory_lot', lotId);

        // Filter by category if provided
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');

        const filtered = category
          ? attachments.filter((a) => a.category === category)
          : attachments;

        return successResponse({
          lotId,
          lotNumber: lot.lotNumber,
          documents: filtered,
        });
      } catch (error) {
        console.error('[Lot Documents] Error fetching documents:', error);
        return serverErrorResponse(error);
      }
    },
    ['inventory:read']
  );
}

/**
 * POST /api/inventory/lots/[id]/documents
 * Upload a document for a lot (COA, MSDS, etc.)
 *
 * Body:
 * - fileName: string (required)
 * - fileSize: number (required)
 * - mimeType: string (required)
 * - fileData: string (base64-encoded, required)
 * - description: string (optional)
 * - category: 'coa' | 'msds' | 'certificate' | 'lab_result' | 'specification' | 'photo' | 'other' (optional)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const lotId = parseInt(id, 10);

        if (isNaN(lotId) || lotId <= 0) {
          return errorResponse('Invalid lot ID', 400);
        }

        // Verify lot exists
        const lot = await getLotDetails(lotId);
        if (!lot) {
          return notFoundResponse('Lot not found');
        }

        const body = await request.json();

        // Validate input
        const parseResult = lotDocumentCreateSchema.safeParse(body);
        if (!parseResult.success) {
          return errorResponse('Validation failed', 400, {
            errors: parseResult.error.issues,
          });
        }

        const data = parseResult.data;

        // Validate file extension
        if (!isValidFileExtension(data.fileName)) {
          return errorResponse(
            'Invalid file type. Supported: PDF, Word, Excel, Images, Text/CSV',
            400
          );
        }

        // Validate MIME type (allow unknown for browser inconsistencies)
        if (data.mimeType && !ALLOWED_MIME_TYPES.includes(data.mimeType)) {
          console.warn(`[Lot Documents] Unexpected MIME type: ${data.mimeType}`);
        }

        // Validate file size
        if (data.fileSize > MAX_FILE_SIZE) {
          return errorResponse('File size must be less than 10MB', 400);
        }

        // Decode base64 to buffer
        const fileBuffer = Buffer.from(data.fileData, 'base64');

        const attachment = await createAttachment(
          {
            moduleName: 'inventory_lot',
            entityId: lotId,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            fileData: fileBuffer,
            description: data.description,
            category: data.category,
          },
          session.userId
        );

        console.log(
          `[Lot Documents] Document uploaded: ${data.fileName} for lot ${lot.lotNumber} by user ${session.userId}`
        );

        return successResponse(
          {
            ...attachment,
            lotId,
            lotNumber: lot.lotNumber,
          },
          'Document uploaded successfully'
        );
      } catch (error) {
        console.error('[Lot Documents] Upload error:', error);
        return serverErrorResponse(error);
      }
    },
    ['inventory:write']
  );
}
