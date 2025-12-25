import { z } from 'zod';
import { withVendorAuth, vendorApiSuccess, vendorApiError } from '@/lib/middleware/vendor-api-auth';
import { vendorErpDataService } from '@/lib/services/vendor-erp-data.service';

const querySchema = z.object({
  hospitalCode: z.string().optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
  warehouseCode: z.string().optional(),
  includeExpiring: z.coerce.boolean().default(false),
  expiringWithinDays: z.coerce.number().min(1).max(365).default(90),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
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

  const result = await vendorErpDataService.getHospitalStock({
    productCodes,
    ...parsed.data,
  });

  return vendorApiSuccess(
    {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    'Hospital stock retrieved successfully'
  );
});
