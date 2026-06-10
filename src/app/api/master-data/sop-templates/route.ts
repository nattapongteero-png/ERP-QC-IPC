import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getSOPTemplates,
  createSOPTemplate,
  updateSOPTemplate,
  getSOPTemplateById,
} from '@/lib/services/master-data.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { desc, eq } from 'drizzle-orm';

// GET /api/master-data/sop-templates - List SOP step templates
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const category = searchParams.get('category') || undefined;
      const isActive = searchParams.get('isActive');

      // Fetch single item by ID
      if (id) {
        const template = await getSOPTemplateById(Number(id));
        if (!template) return successResponse(null);
        return successResponse(template);
      }

      const templates = await getSOPTemplates({
        category,
        isActive: isActive !== null ? isActive === 'true' : true,
      });

      return successResponse(templates);
    } catch (error) {
      console.error('Error fetching SOP templates:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/sop-templates - Create SOP template
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Auto-generate code if not provided
      if (!data.code) {
        const table = getTableRef('sOPStepTemplates');
        const latest = await executeDbOperation(async (db) => {
          const rows = await db.select({ code: table.code }).from(table).orderBy(desc(table.id)).limit(1);
          return rows[0]?.code as string | undefined;
        });
        const lastNum = latest ? parseInt(latest.replace(/\D/g, '') || '0') : 0;
        data.code = `SOP-${String(lastNum + 1).padStart(4, '0')}`;
      }

      if (!data.nameTh || !data.category) {
        return errorResponse('Missing required fields: nameTh, category');
      }

      // Validate category
      const validCategories = ['line_clearance', 'dispensing', 'preparation', 'milling', 'sieving', 'drying', 'blending', 'mixing', 'heating', 'cooling', 'filling', 'packaging', 'ipc', 'weighing', 'cleaning', 'inspection', 'other'];
      if (!validCategories.includes(data.category)) {
        return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }

      // Validate defaultParameters if provided
      if (data.defaultParameters) {
        try {
          if (typeof data.defaultParameters === 'string') {
            JSON.parse(data.defaultParameters);
          }
        } catch {
          return errorResponse('Invalid defaultParameters JSON format');
        }
      }

      const sopData = {
        name: data.name, nameTh: data.nameTh, category: data.category,
        instructions: data.instructions, instructionsTh: data.instructionsTh,
        defaultParameters: typeof data.defaultParameters === 'object' ? JSON.stringify(data.defaultParameters) : data.defaultParameters,
        // Template-level GMP document link (soft ref to documents.id). null clears it.
        gmpDocumentId: data.gmpDocumentId ?? null,
        isActive: data.isActive ?? true,
      };

      // Upsert
      const table = getTableRef('sOPStepTemplates');
      const existing = await executeDbOperation(async (db) => {
        const rows = await db.select({ id: table.id }).from(table).where(eq(table.code, data.code));
        return rows[0];
      });

      if (existing) {
        const updated = await updateSOPTemplate(existing.id as number, sopData);
        return successResponse(updated, 'SOP template updated (code existed)');
      }

      const template = await createSOPTemplate({ code: data.code, ...sopData });
      return successResponse(template, 'SOP template created successfully');
    } catch (error) {
      console.error('Error creating SOP template:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/sop-templates?id=X - Deactivate
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) return errorResponse('Missing ID');
      const existing = await getSOPTemplateById(Number(id));
      if (!existing) return errorResponse('SOP template not found');

      const bomSop = getTableRef('bOMSOPSteps');
      const refs = await executeDbOperation(async (db) => {
        return db.select({ id: bomSop.id }).from(bomSop).where(eq(bomSop.templateId, Number(id))).limit(1);
      });
      if (refs.length > 0) {
        return errorResponse('ไม่สามารถลบได้ เนื่องจาก SOP นี้ถูกใช้งานใน BOM Configuration กรุณาลบออกจาก BOM ก่อน');
      }

      const table = getTableRef('sOPStepTemplates');
      await executeDbOperation(async (db) => {
        await db.delete(table).where(eq(table.id, Number(id)));
      });
      return successResponse(null, 'SOP template deleted');
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/sop-templates - Update SOP template
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing template ID');
      }

      const existing = await getSOPTemplateById(data.id);
      if (!existing) {
        return errorResponse('SOP template not found');
      }

      // Validate category if provided
      if (data.category) {
        const validCategories = ['line_clearance', 'dispensing', 'preparation', 'milling', 'sieving', 'drying', 'blending', 'mixing', 'heating', 'cooling', 'filling', 'packaging', 'ipc', 'weighing', 'cleaning', 'inspection', 'other'];
        if (!validCategories.includes(data.category)) {
          return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
        }
      }

      // Validate defaultParameters if provided
      if (data.defaultParameters) {
        try {
          if (typeof data.defaultParameters === 'string') {
            JSON.parse(data.defaultParameters);
          }
        } catch {
          return errorResponse('Invalid defaultParameters JSON format');
        }
      }

      const template = await updateSOPTemplate(data.id, {
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        category: data.category,
        instructions: data.instructions,
        instructionsTh: data.instructionsTh,
        defaultParameters: typeof data.defaultParameters === 'object'
          ? JSON.stringify(data.defaultParameters)
          : data.defaultParameters,
        // Template-level GMP document link. Only overwrite when the key is
        // present in the payload so partial updates don't wipe it.
        ...(('gmpDocumentId' in data) ? { gmpDocumentId: data.gmpDocumentId ?? null } : {}),
        isActive: data.isActive,
      });

      return successResponse(template, 'SOP template updated successfully');
    } catch (error) {
      console.error('Error updating SOP template:', error);
      return serverErrorResponse(error);
    }
  });
}
