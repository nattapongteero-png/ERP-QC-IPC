/**
 * GET /api/hr/training/courses/[id]/documents
 * Returns GMP documents linked to a training course (Reverse Mapping)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const courseId = Number(id);

      const documents = getTableRef('documents');
      const documentTypes = getTableRef('documentTypes');
      const documentVersions = getTableRef('documentVersions');

      const results = await executeDbOperation(async (db) => {
        return db
          .select({
            id: documents.id,
            documentNumber: documents.documentNumber,
            title: documents.title,
            status: documents.status,
            typeName: documentTypes.name,
            currentVersionId: documents.currentVersionId,
            updatedAt: documents.updatedAt,
          })
          .from(documents)
          .leftJoin(documentTypes, eq(documents.typeId, documentTypes.id))
          .where(eq(documents.trainingCourseId, courseId))
          .orderBy(documents.documentNumber);
      });

      // Get version numbers for documents that have a current version
      const docs = await Promise.all(
        results.map(async (doc: Record<string, unknown>) => {
          let currentVersion: string | null = null;
          if (doc.currentVersionId) {
            const versions = await executeDbOperation(async (db) => {
              return db
                .select({ versionNumber: documentVersions.versionNumber })
                .from(documentVersions)
                .where(eq(documentVersions.id, doc.currentVersionId as number))
                .limit(1);
            });
            currentVersion = (versions[0]?.versionNumber as string) || null;
          }
          return {
            id: doc.id,
            documentNumber: doc.documentNumber,
            title: doc.title,
            typeName: doc.typeName || 'Unknown',
            status: doc.status,
            currentVersion,
            updatedAt: doc.updatedAt,
          };
        })
      );

      return successResponse(docs);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['hr:read']);
}
