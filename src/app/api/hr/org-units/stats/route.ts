// HR Organization Units Stats API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getOrgUnits } from '@/lib/services/hr.service';

export interface OrgUnitStats {
  total: number;
  active: number;
  inactive: number;
  gmpCritical: number;
  maxDepth: number;
  byType: {
    company: number;
    site: number;
    division: number;
    department: number;
    section: number;
    unit: number;
  };
}

// GET /api/hr/org-units/stats - Get organization unit statistics
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const orgUnits = await getOrgUnits();

        // Calculate stats
        const stats: OrgUnitStats = {
          total: orgUnits.length,
          active: orgUnits.filter((u) => u.isActive).length,
          inactive: orgUnits.filter((u) => !u.isActive).length,
          gmpCritical: orgUnits.filter((u) => u.isGmpCritical).length,
          maxDepth: 0,
          byType: {
            company: 0,
            site: 0,
            division: 0,
            department: 0,
            section: 0,
            unit: 0,
          },
        };

        // Count by type
        for (const unit of orgUnits) {
          const type = unit.type as keyof typeof stats.byType;
          if (type in stats.byType) {
            stats.byType[type]++;
          }
        }

        // Calculate max depth using parent relationships
        const unitMap = new Map(orgUnits.map((u) => [u.id, u]));

        const getDepth = (unitId: number, visited = new Set<number>()): number => {
          if (visited.has(unitId)) return 0; // Prevent cycles
          visited.add(unitId);

          const unit = unitMap.get(unitId);
          if (!unit || !unit.parentId) return 1;
          return 1 + getDepth(unit.parentId, visited);
        };

        for (const unit of orgUnits) {
          const depth = getDepth(unit.id);
          if (depth > stats.maxDepth) {
            stats.maxDepth = depth;
          }
        }

        return successResponse(stats);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
