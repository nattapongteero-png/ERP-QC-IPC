import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// GET /api/items/[id]/images - Get all images for an item
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const itemImagesTable = getTableRef('itemImages');

      const images = await executeDbOperation(async (db) => {
        return db
          .select({
            id: itemImagesTable.id,
            itemId: itemImagesTable.itemId,
            fileName: itemImagesTable.fileName,
            fileSize: itemImagesTable.fileSize,
            mimeType: itemImagesTable.mimeType,
            isPrimary: itemImagesTable.isPrimary,
            sortOrder: itemImagesTable.sortOrder,
            description: itemImagesTable.description,
            createdAt: itemImagesTable.createdAt,
          })
          .from(itemImagesTable)
          .where(eq(itemImagesTable.itemId, itemId))
          .orderBy(desc(itemImagesTable.isPrimary), itemImagesTable.sortOrder);
      });

      // Add URL for each image
      const imagesWithUrls = images.map((img: { id: number; [key: string]: unknown }) => ({
        ...img,
        imageUrl: `/api/items/${itemId}/images/${img.id}`,
        thumbnailUrl: `/api/items/${itemId}/images/${img.id}?thumbnail=true`,
      }));

      return successResponse(imagesWithUrls);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}

// POST /api/items/[id]/images - Upload a new image
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      // Check if item exists
      const itemsTable = getTableRef('items');
      const item = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: itemsTable.id })
          .from(itemsTable)
          .where(eq(itemsTable.id, itemId))
          .limit(1);
        return result[0] || null;
      });

      if (!item) {
        return errorResponse('Item not found', 404);
      }

      // Parse form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const description = formData.get('description') as string | null;
      const isPrimary = formData.get('isPrimary') === 'true';

      if (!file) {
        return errorResponse('No file provided');
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return errorResponse(`Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      // Read file as buffer
      const arrayBuffer = await file.arrayBuffer();
      const imageData = Buffer.from(arrayBuffer);

      // Create thumbnail (simple resize for now - could use sharp in production)
      // For simplicity, we'll store the same image as thumbnail
      // In production, you'd want to use a library like sharp to create actual thumbnails
      const thumbnailData = imageData;

      const itemImagesTable = getTableRef('itemImages');

      // If setting as primary, unset other primary images
      if (isPrimary) {
        await executeDbOperation(async (db) => {
          return db
            .update(itemImagesTable)
            .set({ isPrimary: false })
            .where(eq(itemImagesTable.itemId, itemId));
        });
      }

      // Get next sort order
      const maxSort = await executeDbOperation(async (db) => {
        const result = await db
          .select({ maxSort: itemImagesTable.sortOrder })
          .from(itemImagesTable)
          .where(eq(itemImagesTable.itemId, itemId))
          .orderBy(desc(itemImagesTable.sortOrder))
          .limit(1);
        return result[0]?.maxSort ?? -1;
      });

      // Insert new image
      const result = await executeDbOperation(async (db) => {
        return db.insert(itemImagesTable).values({
          itemId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          imageData,
          thumbnailData,
          isPrimary,
          sortOrder: (maxSort as number) + 1,
          description: description || null,
          uploadedBy: session.userId,
          createdAt: dbDate(),
        });
      });

      const imageId = getInsertId(result);

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'item_images',
        recordId: Number(imageId),
        newValue: { itemId, fileName: file.name, fileSize: file.size, isPrimary },
        ipAddress: getClientIP(request),
      });

      return successResponse({
        id: Number(imageId),
        imageUrl: `/api/items/${itemId}/images/${imageId}`,
        thumbnailUrl: `/api/items/${itemId}/images/${imageId}?thumbnail=true`,
      }, 'Image uploaded successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

// DELETE /api/items/[id]/images - Delete an image (imageId in query param)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);
      const { searchParams } = new URL(request.url);
      const imageId = parseInt(searchParams.get('imageId') || '');

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      if (isNaN(imageId)) {
        return errorResponse('Invalid image ID');
      }

      const itemImagesTable = getTableRef('itemImages');

      // Check if image exists and belongs to this item
      const image = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: itemImagesTable.id, fileName: itemImagesTable.fileName })
          .from(itemImagesTable)
          .where(and(eq(itemImagesTable.id, imageId), eq(itemImagesTable.itemId, itemId)))
          .limit(1);
        return result[0] || null;
      });

      if (!image) {
        return errorResponse('Image not found', 404);
      }

      // Delete the image
      await executeDbOperation(async (db) => {
        return db
          .delete(itemImagesTable)
          .where(eq(itemImagesTable.id, imageId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'item_images',
        recordId: imageId,
        oldValue: { itemId, fileName: image.fileName },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: imageId }, 'Image deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

// PATCH /api/items/[id]/images - Update image (set as primary, update description)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);
      const body = await request.json();
      const { imageId, isPrimary, description, sortOrder } = body;

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      if (!imageId) {
        return errorResponse('Image ID is required');
      }

      const itemImagesTable = getTableRef('itemImages');

      // Check if image exists and belongs to this item
      const image = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: itemImagesTable.id })
          .from(itemImagesTable)
          .where(and(eq(itemImagesTable.id, imageId), eq(itemImagesTable.itemId, itemId)))
          .limit(1);
        return result[0] || null;
      });

      if (!image) {
        return errorResponse('Image not found', 404);
      }

      // If setting as primary, unset other primary images
      if (isPrimary === true) {
        await executeDbOperation(async (db) => {
          return db
            .update(itemImagesTable)
            .set({ isPrimary: false })
            .where(eq(itemImagesTable.itemId, itemId));
        });
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
      if (description !== undefined) updateData.description = description;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      if (Object.keys(updateData).length > 0) {
        await executeDbOperation(async (db) => {
          return db
            .update(itemImagesTable)
            .set(updateData)
            .where(eq(itemImagesTable.id, imageId));
        });
      }

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'item_images',
        recordId: imageId,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: imageId }, 'Image updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}
