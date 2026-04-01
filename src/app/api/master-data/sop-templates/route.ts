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
        isActive: isActive ? isActive === 'true' : undefined,
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

      // Validate required fields
      if (!data.code || !data.name || !data.nameTh || !data.category) {
        return errorResponse('Missing required fields: code, name, nameTh, category');
      }

      // Validate category
      const validCategories = ['preparation', 'mixing', 'heating', 'cooling', 'packaging'];
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

      const template = await createSOPTemplate({
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        category: data.category,
        instructions: data.instructions,
        instructionsTh: data.instructionsTh,
        defaultParameters: typeof data.defaultParameters === 'object'
          ? JSON.stringify(data.defaultParameters)
          : data.defaultParameters,
        isActive: data.isActive ?? true,
      });

      return successResponse(template, 'SOP template created successfully');
    } catch (error) {
      console.error('Error creating SOP template:', error);
      const errMsg = String((error as Error).message || '') + String((error as any).cause?.message || '');
      if (errMsg.includes('UNIQUE constraint') || errMsg.includes('Duplicate entry')) {
        return errorResponse('Template code already exists');
      }
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
        const validCategories = ['preparation', 'mixing', 'heating', 'cooling', 'packaging'];
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
        isActive: data.isActive,
      });

      return successResponse(template, 'SOP template updated successfully');
    } catch (error) {
      console.error('Error updating SOP template:', error);
      return serverErrorResponse(error);
    }
  });
}
