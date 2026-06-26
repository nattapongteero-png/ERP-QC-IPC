import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>;
}

// GET /api/items/[id]/images/[imageId] - Get image data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, imageId } = await params;
    const itemId = parseInt(id);
    const imgId = parseInt(imageId);
    const { searchParams } = new URL(request.url);
    const isThumbnail = searchParams.get('thumbnail') === 'true';

    if (isNaN(itemId) || isNaN(imgId)) {
      return new NextResponse('Invalid ID', { status: 400 });
    }

    const itemImagesTable = getTableRef('itemImages');

    const image = await executeDbOperation(async (db) => {
      const result = await db
        .select({
          id: itemImagesTable.id,
          mimeType: itemImagesTable.mimeType,
          imageData: itemImagesTable.imageData,
          thumbnailData: itemImagesTable.thumbnailData,
          fileName: itemImagesTable.fileName,
        })
        .from(itemImagesTable)
        .where(and(eq(itemImagesTable.id, imgId), eq(itemImagesTable.itemId, itemId)))
        .limit(1);
      return result[0] || null;
    });

    if (!image) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Get the appropriate image data
    const data = isThumbnail && image.thumbnailData ? image.thumbnailData : image.imageData;

    if (!data) {
      return new NextResponse('Image data not found', { status: 404 });
    }

    // Build a Content-Disposition that is safe for non-Latin-1 filenames.
    // HTTP header values must be ISO-8859-1 (ByteString); Thai/Unicode file
    // names (code points > 255) throw when constructing Headers. Provide an
    // ASCII fallback plus an RFC 5987 UTF-8 encoded filename* parameter.
    const asciiFallback = image.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    const encodedFileName = encodeURIComponent(image.fileName);
    const contentDisposition =
      `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`;

    // Return the image with appropriate headers
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': data.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
