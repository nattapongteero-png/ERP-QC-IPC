/**
 * Payroll Accounting API Route
 * Feature: 010-accounting-module-integration
 * User Story 10: Integrate with HR for Payroll Accounting
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPayrollJournalEntry,
  allocatePayrollToCostCenters,
  recordStatutoryLiabilities,
  calculateThaiSSO,
  getPayrollSummary,
} from '@/lib/services/accounting.service';
import type {
  PayrollBatch,
  PayrollAccountConfig,
} from '@/types/accounting';

/**
 * POST /api/accounting/payroll
 * Create journal entry from payroll data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      payrollBatch,
      accountConfig,
      createdBy = 1, // TODO: Get from auth
    } = body as {
      payrollBatch: PayrollBatch;
      accountConfig: PayrollAccountConfig;
      createdBy?: number;
    };

    // Validate required fields
    if (!payrollBatch) {
      return NextResponse.json(
        { error: 'Payroll batch data is required' },
        { status: 400 }
      );
    }

    if (!payrollBatch.payrollPeriod || !payrollBatch.payrollDate) {
      return NextResponse.json(
        { error: 'Payroll period and date are required' },
        { status: 400 }
      );
    }

    if (!payrollBatch.entries || payrollBatch.entries.length === 0) {
      return NextResponse.json(
        { error: 'At least one payroll entry is required' },
        { status: 400 }
      );
    }

    if (!accountConfig) {
      return NextResponse.json(
        { error: 'Account configuration is required' },
        { status: 400 }
      );
    }

    // Validate account configuration
    const requiredAccounts = [
      'salaryExpenseAccountId',
      'ssoEmployerExpenseAccountId',
      'ssoPayableAccountId',
      'whtPayableAccountId',
      'cashAccountId',
    ];

    for (const account of requiredAccounts) {
      if (!accountConfig[account as keyof PayrollAccountConfig]) {
        return NextResponse.json(
          { error: `${account} is required in account configuration` },
          { status: 400 }
        );
      }
    }

    // Create payroll journal entry
    const result = await createPayrollJournalEntry(
      payrollBatch,
      accountConfig,
      createdBy
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Also get cost center allocations
    const allocations = await allocatePayrollToCostCenters(payrollBatch);

    // Record statutory liabilities summary
    const liabilities = await recordStatutoryLiabilities(
      payrollBatch.payrollPeriod,
      payrollBatch,
      accountConfig,
      createdBy
    );

    return NextResponse.json({
      success: true,
      data: {
        journalEntryId: result.journalEntryId,
        entryNumber: result.entryNumber,
        message: result.message,
        totals: result.totals,
        costCenterAllocations: allocations,
        statutoryLiabilities: {
          ssoPayable: liabilities.ssoPayable,
          whtPayable: liabilities.whtPayable,
          totalPayable: liabilities.totalPayable,
        },
      },
    });
  } catch (error) {
    console.error('Error creating payroll journal entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payroll journal entry' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounting/payroll?fiscalPeriodId=1
 * Get payroll summary for a fiscal period
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fiscalPeriodId = searchParams.get('fiscalPeriodId');

    if (!fiscalPeriodId) {
      return NextResponse.json(
        { error: 'fiscalPeriodId is required' },
        { status: 400 }
      );
    }

    const periodId = parseInt(fiscalPeriodId, 10);
    if (isNaN(periodId)) {
      return NextResponse.json(
        { error: 'Invalid fiscal period ID' },
        { status: 400 }
      );
    }

    const summary = await getPayrollSummary(periodId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error getting payroll summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get payroll summary' },
      { status: 500 }
    );
  }
}
