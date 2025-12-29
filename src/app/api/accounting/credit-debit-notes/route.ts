/**
 * Credit/Debit Notes API (T086)
 * GET /api/accounting/credit-debit-notes - List notes
 * POST /api/accounting/credit-debit-notes - Create note
 */

import { NextRequest, NextResponse } from 'next/server';
import { listNotes, createNote } from '@/lib/services/credit-debit-notes.service';
import { noteListFilterSchema, noteCreateSchema } from '@/lib/validation/credit-debit-note';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = noteListFilterSchema.parse({
      noteType: searchParams.get('noteType'),
      referenceType: searchParams.get('referenceType'),
      status: searchParams.get('status'),
      customerId: searchParams.get('customerId'),
      vendorId: searchParams.get('vendorId'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const result = await listNotes(filter);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing credit/debit notes:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = noteCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const createdBy = 1;

    const id = await createNote(data, createdBy);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating credit/debit note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
