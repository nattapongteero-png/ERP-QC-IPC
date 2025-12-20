/**
 * Report Executions API - Audit logging for report actions
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  logReportExecution,
  getReportExecutions,
  type ReportAction,
  type ReportExecutionStatus,
  type ExportFormat,
} from '@/lib/services/reports.service';
import { z } from 'zod';

// Schema for logging a report execution
const logExecutionSchema = z.object({
  templateId: z.number().int().positive(),
  action: z.enum(['view', 'export', 'print']),
  parameters: z.record(z.string(), z.unknown()).optional(),
  exportFormat: z.enum(['pdf', 'xlsx', 'docx', 'csv', 'rtf', 'html']).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  status: z.enum(['success', 'error', 'cancelled']),
  errorMessage: z.string().optional(),
});

// GET - List report executions
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const result = await getReportExecutions({
      templateId: templateId ? parseInt(templateId, 10) : undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      action: action as ReportAction | undefined,
      status: status as ReportExecutionStatus | undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get report executions:', error);
    return NextResponse.json(
      { error: 'Failed to get report executions' },
      { status: 500 }
    );
  }
}

// POST - Log a report execution
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = logExecutionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { templateId, action, parameters, exportFormat, durationMs, status, errorMessage } = validation.data;

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    const id = await logReportExecution({
      templateId,
      userId: session.userId,
      action: action as ReportAction,
      parameters,
      exportFormat: exportFormat as ExportFormat | undefined,
      durationMs,
      status: status as ReportExecutionStatus,
      errorMessage,
      ipAddress,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Failed to log report execution:', error);
    return NextResponse.json(
      { error: 'Failed to log report execution' },
      { status: 500 }
    );
  }
}
