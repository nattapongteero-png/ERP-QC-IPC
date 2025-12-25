import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withVendorAuth, vendorApiSuccess, vendorApiError } from '@/lib/middleware/vendor-api-auth';
import { vendorErpDataService } from '@/lib/services/vendor-erp-data.service';

const querySchema = z.object({
  hospitalCode: z.string().optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
  warehouseCode: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

export const GET = withVendorAuth(async (request, { vendor, productCodes }) => {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return vendorApiError(
      'VALIDATION_ERROR',
      'Invalid query parameters',
      400
    );
  }

  const result = await vendorErpDataService.getConsumption({
    productCodes,
    ...parsed.data,
  });

  return vendorApiSuccess(
    {
      items: result.items,
      summary: result.summary,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    'Consumption data retrieved successfully'
  );
});
