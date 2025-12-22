// HR Employee Photo Upload API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteHREmployees,
  mysqlHREmployees,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'employees');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const THUMBNAIL_SIZE = 150;
const PHOTO_SIZE = 400;

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getEmployeesTable() {
  return isSqlite() ? sqliteHREmployees : mysqlHREmployees;
}

// POST /api/hr/employees/[id]/photo - Upload employee photo
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const employeeId = parseInt(id);
        if (isNaN(employeeId)) {
          return errorResponse('Invalid employee ID');
        }

        // Get database connection
        const db = await getDb();

        // Verify employee exists
        const hrEmployees = getEmployeesTable();
        const [employee] = await (db as any)
          .select({ id: hrEmployees.id })
          .from(hrEmployees)
          .where(eq(hrEmployees.id, employeeId))
          .limit(1);

        if (!employee) {
          return notFoundResponse('Employee not found');
        }

        const formData = await request.formData();
        const file = formData.get('photo') as File;

        if (!file) {
          return errorResponse('No photo file provided');
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
          return errorResponse('Invalid file type. Allowed: JPEG, PNG, WebP');
        }

        if (file.size > MAX_FILE_SIZE) {
          return errorResponse('File too large. Maximum size: 5MB');
        }

        // Create directory for employee
        const employeeDir = path.join(UPLOAD_DIR, String(employeeId));
        await mkdir(employeeDir, { recursive: true });

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Process and save main photo
        const timestamp = Date.now();
        const photoFileName = `photo-${timestamp}.webp`;
        const thumbnailFileName = `thumb-${timestamp}.webp`;

        const photoPath = path.join(employeeDir, photoFileName);
        const thumbnailPath = path.join(employeeDir, thumbnailFileName);

        // Resize and convert to WebP
        await sharp(buffer)
          .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover' })
          .webp({ quality: 85 })
          .toFile(photoPath);

        await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(thumbnailPath);

        // Generate URLs
        const photoUrl = `/uploads/employees/${employeeId}/${photoFileName}`;
        const photoThumbnailUrl = `/uploads/employees/${employeeId}/${thumbnailFileName}`;

        // Update employee record
        await (db as any)
          .update(hrEmployees)
          .set({
            photoUrl,
            photoThumbnailUrl,
            updatedAt: isSqlite() ? new Date().toISOString() : new Date(),
          })
          .where(eq(hrEmployees.id, employeeId));

        return successResponse({
          photoUrl,
          photoThumbnailUrl,
        });
      } catch (error) {
        console.error('Photo upload error:', error);
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}

// DELETE /api/hr/employees/[id]/photo - Delete employee photo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const employeeId = parseInt(id);
        if (isNaN(employeeId)) {
          return errorResponse('Invalid employee ID');
        }

        // Get database connection
        const db = await getDb();

        const hrEmployees = getEmployeesTable();
        const [employee] = await (db as any)
          .select({
            id: hrEmployees.id,
            photoUrl: hrEmployees.photoUrl,
            photoThumbnailUrl: hrEmployees.photoThumbnailUrl,
          })
          .from(hrEmployees)
          .where(eq(hrEmployees.id, employeeId))
          .limit(1);

        if (!employee) {
          return notFoundResponse('Employee not found');
        }

        // Delete photo files
        if (employee.photoUrl) {
          const photoPath = path.join(process.cwd(), 'public', employee.photoUrl);
          try {
            await unlink(photoPath);
          } catch {
            // Ignore if file doesn't exist
          }
        }

        if (employee.photoThumbnailUrl) {
          const thumbPath = path.join(process.cwd(), 'public', employee.photoThumbnailUrl);
          try {
            await unlink(thumbPath);
          } catch {
            // Ignore if file doesn't exist
          }
        }

        // Clear URLs in database
        await (db as any)
          .update(hrEmployees)
          .set({
            photoUrl: null,
            photoThumbnailUrl: null,
            updatedAt: isSqlite() ? new Date().toISOString() : new Date(),
          })
          .where(eq(hrEmployees.id, employeeId));

        return successResponse({ message: 'Photo deleted' });
      } catch (error) {
        console.error('Photo delete error:', error);
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
