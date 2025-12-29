/**
 * Bank Statements API (T060)
 * GET /api/accounting/bank-reconciliation/statements - List statements
 * POST /api/accounting/bank-reconciliation/statements - Create statement
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listBankStatements,
  createBankStatement,
} from '@/lib/services/bank-reconciliation.service';
import {
  bankStatementListFilterSchema,
  bankStatementCreateSchema,
} from '@/lib/validation/bank-reconciliation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Convert null to undefined for optional params (Zod treats null as a value, not missing)
    const filter = bankStatementListFilterSchema.parse({
      bankAccountId: searchParams.get('bankAccountId') || undefined,
      status: searchParams.get('status') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const result = await listBankStatements(filter);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing bank statements:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = bankStatementCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const createdBy = 1;

    const id = await createBankStatement(data, createdBy);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating bank statement:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
