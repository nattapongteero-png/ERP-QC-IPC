/**
 * Bank Statement Detail API (T061)
 * GET /api/accounting/bank-reconciliation/statements/[id] - Get statement with lines
 * PUT /api/accounting/bank-reconciliation/statements/[id] - Update statement
 * DELETE /api/accounting/bank-reconciliation/statements/[id] - Delete statement
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getBankStatementById,
  updateBankStatement,
  deleteBankStatement,
} from '@/lib/services/bank-reconciliation.service';
import { bankStatementUpdateSchema } from '@/lib/validation/bank-reconciliation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const statementId = parseInt(id, 10);

      if (isNaN(statementId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid statement ID' },
          { status: 400 }
        );
      }

      const statement = await getBankStatementById(statementId);
      if (!statement) {
        return NextResponse.json(
          { success: false, error: 'Statement not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: statement });
    } catch (error) {
      console.error('Error getting bank statement:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const statementId = parseInt(id, 10);

      if (isNaN(statementId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid statement ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = bankStatementUpdateSchema.parse(body);

      const result = await updateBankStatement(statementId, data);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating bank statement:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const statementId = parseInt(id, 10);

      if (isNaN(statementId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid statement ID' },
          { status: 400 }
        );
      }

      const result = await deleteBankStatement(statementId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting bank statement:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
