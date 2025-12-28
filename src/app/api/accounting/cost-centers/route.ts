// Cost Centers API for Accounting Module
// Feature: 010-accounting-module-integration
// Returns organization units as cost centers without requiring HR permissions

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

interface CostCenter {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  type: string;
}

// GET /api/accounting/cost-centers - List cost centers (org units of type department, section, unit)
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const usingSqlite = isSqlite();
        const db = usingSqlite ? getSqliteDb() : await getMysqlDb();
        const orgUnitsTable = usingSqlite ? schema.sqliteHROrgUnits : schema.mysqlHROrgUnits;

        // Fetch active org units that can be used as cost centers
        // Types: department, section, unit (matching the journal entry form needs)
        const costCenterTypes = ['department', 'section', 'unit'];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const costCenters = await (db as any)
          .select({
            id: orgUnitsTable.id,
            code: orgUnitsTable.code,
            name: orgUnitsTable.name,
            nameEn: orgUnitsTable.nameEn,
            type: orgUnitsTable.type,
          })
          .from(orgUnitsTable)
          .where(
            and(
              eq(orgUnitsTable.isActive, true),
              inArray(orgUnitsTable.type, costCenterTypes)
            )
          )
          .orderBy(orgUnitsTable.code);

        return successResponse(costCenters as CostCenter[]);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    // Only require basic authentication, no specific permission needed
    // Any authenticated user can view cost centers for accounting purposes
    []
  );
}
