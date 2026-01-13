import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOMaterials,
  getWOCleaningLogs,
  getWOSOPExecution,
  getWOEnvironmentalLogs,
  getWOPackagingWeightLogs,
  getWOPackagingIntegrityLogs,
  getWOFinishedInspection,
} from '@/lib/services/wo-execution.service';

// GET /api/production/work-orders/[id]/execution-summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      // Fetch all execution data in parallel
      const [
        materials,
        preProductionCleaning,
        productionCleaning,
        postProductionCleaning,
        prePackagingCleaning,
        sopExecutions,
        productionEnvLogs,
        packagingEnvLogs,
        packagingWeightLogs,
        packagingIntegrityLogs,
        finishedInspection,
      ] = await Promise.all([
        getWOMaterials(workOrderId),
        getWOCleaningLogs(workOrderId, 'pre_production'),
        getWOCleaningLogs(workOrderId, 'production'),
        getWOCleaningLogs(workOrderId, 'post_production'),
        getWOCleaningLogs(workOrderId, 'pre_packaging'),
        getWOSOPExecution(workOrderId),
        getWOEnvironmentalLogs(workOrderId, 'production'),
        getWOEnvironmentalLogs(workOrderId, 'packaging'),
        getWOPackagingWeightLogs(workOrderId),
        getWOPackagingIntegrityLogs(workOrderId),
        getWOFinishedInspection(workOrderId),
      ]);

      // Calculate material weighing status
      const materialWeighing = {
        total: materials.length,
        completed: materials.filter((m: any) => m.weighedAt).length,
        verified: materials.filter((m: any) => m.verifiedAt).length,
      };

      // Calculate pre-production cleaning status
      const preProductionCleaningStatus = {
        total: preProductionCleaning.length,
        completed: preProductionCleaning.filter((l: any) => l.isClean).length,
        verified: preProductionCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate production cleaning status
      const productionCleaningStatus = {
        total: productionCleaning.length,
        completed: productionCleaning.filter((l: any) => l.isClean).length,
        verified: productionCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate SOP execution status
      const sopExecution = {
        total: sopExecutions.length,
        completed: sopExecutions.filter((s: any) => s.isCompleted).length,
        verified: sopExecutions.filter((s: any) => s.verifiedAt).length,
      };

      // Calculate production environmental status
      const productionEnvironmental = {
        total: productionEnvLogs.length > 0 ? productionEnvLogs.length : 0,
        recorded: productionEnvLogs.length,
        normal: productionEnvLogs.filter((l: any) => l.isNormal).length,
      };

      // Calculate post-production cleaning status
      const postProductionCleaningStatus = {
        total: postProductionCleaning.length,
        completed: postProductionCleaning.filter((l: any) => l.isClean).length,
        verified: postProductionCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate pre-packaging cleaning status
      const prePackagingCleaningStatus = {
        total: prePackagingCleaning.length,
        completed: prePackagingCleaning.filter((l: any) => l.isClean).length,
        verified: prePackagingCleaning.filter((l: any) => l.verifiedAt).length,
      };

      // Calculate packaging weight status
      const packagingWeight = {
        total: packagingWeightLogs.length,
        passed: packagingWeightLogs.filter((l: any) => l.isPass).length,
      };

      // Calculate packaging integrity status
      const packagingIntegrity = {
        total: packagingIntegrityLogs.length,
        passed: packagingIntegrityLogs.filter(
          (l: any) => l.tubeCapComplete && l.lotNumberCorrect && l.packingCorrect
        ).length,
      };

      // Calculate packaging environmental status
      const packagingEnvironmental = {
        total: packagingEnvLogs.length > 0 ? packagingEnvLogs.length : 0,
        recorded: packagingEnvLogs.length,
        normal: packagingEnvLogs.filter((l: any) => l.isNormal).length,
      };

      // Calculate finished inspection status
      const finishedInspectionStatus = {
        status: finishedInspection
          ? finishedInspection.status === 'passed'
            ? 'passed'
            : finishedInspection.status === 'failed'
            ? 'failed'
            : 'in_progress'
          : 'pending',
      };

      const summary = {
        materialWeighing,
        preProductionCleaning: preProductionCleaningStatus,
        productionCleaning: productionCleaningStatus,
        sopExecution,
        productionEnvironmental,
        postProductionCleaning: postProductionCleaningStatus,
        prePackagingCleaning: prePackagingCleaningStatus,
        packagingWeight,
        packagingIntegrity,
        packagingEnvironmental,
        finishedInspection: finishedInspectionStatus,
      };

      return successResponse(summary);
    } catch (error) {
      console.error('Error fetching execution summary:', error);
      return serverErrorResponse(error);
    }
  });
}
