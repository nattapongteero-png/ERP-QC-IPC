import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getPackagingQCCriteria,
  createPackagingQCCriteria,
  updatePackagingQCCriteria,
  getPackagingQCCriteriaById,
} from '@/lib/services/master-data.service';

// GET /api/master-data/packaging-qc-criteria - List packaging QC criteria
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const isActive = searchParams.get('isActive');

      if (id) {
        const item = await getPackagingQCCriteriaById(Number(id));
        if (!item) return successResponse(null);
        return successResponse(item);
      }

      const criteria = await getPackagingQCCriteria({
        isActive: isActive ? isActive === 'true' : undefined,
      });

      return successResponse(criteria);
    } catch (error) {
      console.error('Error fetching packaging QC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/packaging-qc-criteria - Create packaging QC criteria
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Validate required fields
      if (!data.code || !data.name || data.weightMin === undefined || data.weightMax === undefined) {
        return errorResponse('Missing required fields: code, name, weightMin, weightMax');
      }

      // Validate weight range
      if (data.weightMax <= data.weightMin) {
        return errorResponse('Weight max must be greater than weight min');
      }

      // Validate sample size and max failures
      if (data.maxFailures !== undefined && data.sampleSize !== undefined) {
        if (data.maxFailures >= data.sampleSize) {
          return errorResponse('Max failures must be less than sample size');
        }
      }

      const criteria = await createPackagingQCCriteria({
        code: data.code,
        name: data.name,
        weightMin: data.weightMin,
        weightMax: data.weightMax,
        sampleSize: data.sampleSize ?? 20,
        maxFailures: data.maxFailures ?? 2,
        checkIntervalMinutes: data.checkIntervalMinutes ?? 30,
        unitsPerPack: data.unitsPerPack ?? 12,
        isActive: data.isActive ?? true,
      });

      return successResponse(criteria, 'Packaging QC criteria created successfully');
    } catch (error) {
      console.error('Error creating packaging QC criteria:', error);
      const errMsg = String((error as Error).message || '') + String((error as any).cause?.message || '');
      if (errMsg.includes('UNIQUE constraint') || errMsg.includes('Duplicate entry')) {
        return errorResponse('Criteria code already exists');
      }
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/packaging-qc-criteria - Update packaging QC criteria
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing criteria ID');
      }

      const existing = await getPackagingQCCriteriaById(data.id);
      if (!existing) {
        return errorResponse('Packaging QC criteria not found');
      }

      // Validate weight range if both are provided
      const weightMin = data.weightMin ?? existing.weightMin;
      const weightMax = data.weightMax ?? existing.weightMax;
      if (weightMax <= weightMin) {
        return errorResponse('Weight max must be greater than weight min');
      }

      // Validate sample size and max failures
      const sampleSize = data.sampleSize ?? existing.sampleSize;
      const maxFailures = data.maxFailures ?? existing.maxFailures;
      if (maxFailures >= sampleSize) {
        return errorResponse('Max failures must be less than sample size');
      }

      const criteria = await updatePackagingQCCriteria(data.id, {
        code: data.code,
        name: data.name,
        weightMin: data.weightMin,
        weightMax: data.weightMax,
        sampleSize: data.sampleSize,
        maxFailures: data.maxFailures,
        checkIntervalMinutes: data.checkIntervalMinutes,
        unitsPerPack: data.unitsPerPack,
        isActive: data.isActive,
      });

      return successResponse(criteria, 'Packaging QC criteria updated successfully');
    } catch (error) {
      console.error('Error updating packaging QC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}
