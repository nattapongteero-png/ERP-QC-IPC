import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEnvironmentalConditions,
  createEnvironmentalCondition,
  updateEnvironmentalCondition,
  getEnvironmentalConditionById,
} from '@/lib/services/master-data.service';

// GET /api/master-data/environmental-conditions - List environmental conditions
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const isActive = searchParams.get('isActive');

      const conditions = await getEnvironmentalConditions({
        isActive: isActive ? isActive === 'true' : undefined,
      });

      return successResponse(conditions);
    } catch (error) {
      console.error('Error fetching environmental conditions:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/environmental-conditions - Create environmental condition
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Validate required fields
      if (!data.code || !data.name) {
        return errorResponse('Missing required fields: code, name');
      }

      // Validate temperature range
      if (data.temperatureMax !== undefined && data.temperatureMin !== undefined) {
        if (data.temperatureMax <= data.temperatureMin) {
          return errorResponse('Temperature max must be greater than temperature min');
        }
      }

      const condition = await createEnvironmentalCondition({
        code: data.code,
        name: data.name,
        temperatureMin: data.temperatureMin ?? 20,
        temperatureMax: data.temperatureMax ?? 30,
        humidityMax: data.humidityMax ?? 60,
        monitoringIntervalMinutes: data.monitoringIntervalMinutes ?? 60,
        notes: data.notes,
        isActive: data.isActive ?? true,
      });

      return successResponse(condition, 'Environmental condition created successfully');
    } catch (error) {
      console.error('Error creating environmental condition:', error);
      if ((error as Error).message?.includes('UNIQUE constraint')) {
        return errorResponse('Condition code already exists');
      }
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/environmental-conditions - Update environmental condition
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing condition ID');
      }

      const existing = await getEnvironmentalConditionById(data.id);
      if (!existing) {
        return errorResponse('Environmental condition not found');
      }

      // Validate temperature range
      const tempMin = data.temperatureMin ?? existing.temperatureMin;
      const tempMax = data.temperatureMax ?? existing.temperatureMax;
      if (tempMax <= tempMin) {
        return errorResponse('Temperature max must be greater than temperature min');
      }

      const condition = await updateEnvironmentalCondition(data.id, {
        code: data.code,
        name: data.name,
        temperatureMin: data.temperatureMin,
        temperatureMax: data.temperatureMax,
        humidityMax: data.humidityMax,
        monitoringIntervalMinutes: data.monitoringIntervalMinutes,
        notes: data.notes,
        isActive: data.isActive,
      });

      return successResponse(condition, 'Environmental condition updated successfully');
    } catch (error) {
      console.error('Error updating environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}
