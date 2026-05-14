/**
 * SSO Calculation API Route
 * Feature: 010-accounting-module-integration
 * User Story 10: Integrate with HR for Payroll Accounting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { calculateThaiSSO } from '@/lib/services/accounting.service';

/**
 * POST /api/accounting/payroll/calculate-sso
 * Calculate Thai Social Security contribution for a salary
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const { salary, salaries } = body as {
        salary?: number;
        salaries?: number[];
      };

      // Single salary calculation
      if (salary !== undefined) {
        if (typeof salary !== 'number' || salary < 0) {
          return NextResponse.json(
            { error: 'Salary must be a non-negative number' },
            { status: 400 }
          );
        }

        const result = calculateThaiSSO(salary);

        return NextResponse.json({
          success: true,
          data: {
            salary,
            ...result,
          },
        });
      }

      // Batch salary calculation
      if (salaries !== undefined) {
        if (!Array.isArray(salaries)) {
          return NextResponse.json(
            { error: 'Salaries must be an array of numbers' },
            { status: 400 }
          );
        }

        const results = salaries.map((s) => {
          if (typeof s !== 'number' || s < 0) {
            return {
              salary: s,
              error: 'Invalid salary value',
              employeeContribution: 0,
              employerContribution: 0,
              total: 0,
            };
          }
          const calc = calculateThaiSSO(s);
          return {
            salary: s,
            ...calc,
          };
        });

        // Calculate totals
        const totals = results.reduce(
          (acc, r) => ({
            totalEmployeeContribution: acc.totalEmployeeContribution + r.employeeContribution,
            totalEmployerContribution: acc.totalEmployerContribution + r.employerContribution,
            grandTotal: acc.grandTotal + r.total,
          }),
          { totalEmployeeContribution: 0, totalEmployerContribution: 0, grandTotal: 0 }
        );

        return NextResponse.json({
          success: true,
          data: {
            calculations: results,
            ...totals,
          },
        });
      }

      return NextResponse.json(
        { error: 'Either salary or salaries is required' },
        { status: 400 }
      );
    } catch (error) {
      console.error('Error calculating SSO:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to calculate SSO' },
        { status: 500 }
      );
    }

  });
}
