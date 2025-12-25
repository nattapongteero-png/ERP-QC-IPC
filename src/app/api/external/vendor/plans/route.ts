import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withVendorAuth, vendorApiSuccess, vendorApiError } from '@/lib/middleware/vendor-api-auth';
import { vendorErpDataService } from '@/lib/services/vendor-erp-data.service';

const querySchema = z.object({
  hospitalCode: z.string().optional(),
  fiscalYear: z.coerce.number().min(2500).max(2600).optional(),
  quarter: z.coerce.number().min(1).max(4).optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
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

  const result = await vendorErpDataService.getPlans({
    productCodes,
    ...parsed.data,
  });

  return vendorApiSuccess(
    {
      plans: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    'Purchase plans retrieved successfully'
  );
});
