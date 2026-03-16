/**
 * Workflow History API (T125)
 * GET /api/settings/approval-flows/[id]/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getWorkflowHistory } from '@/lib/services/approval-workflow.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const flowId = parseInt(id, 10);

      if (isNaN(flowId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid workflow ID' },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      const history = await getWorkflowHistory(flowId, { page, limit });
      return NextResponse.json({ success: true, data: history });
    } catch (error) {
      console.error('Error fetching workflow history:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
