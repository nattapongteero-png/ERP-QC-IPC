import { z } from 'zod';
import { withVendorAuth, vendorApiSuccess, vendorApiError } from '@/lib/middleware/vendor-api-auth';
import { vendorErpDataService } from '@/lib/services/vendor-erp-data.service';

const querySchema = z.object({
  hospitalCode: z.string().optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
  periodDays: z.coerce.number().min(7).max(365).default(30),
  forecastDays: z.coerce.number().min(1).max(180).default(30),
});

export const GET = withVendorAuth(async (request, { productCodes }) => {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return vendorApiError(
      'VALIDATION_ERROR',
      'Invalid query parameters',
      400
    );
  }

  const items = await vendorErpDataService.getConsumptionRate({
    productCodes,
    ...parsed.data,
  });

  const today = new Date().toISOString().split('T')[0];

  return vendorApiSuccess(
    {
      items,
      analysisDate: today,
      periodDays: parsed.data.periodDays,
      forecastDays: parsed.data.forecastDays,
    },
    'Consumption rate analytics retrieved successfully'
  );
});
