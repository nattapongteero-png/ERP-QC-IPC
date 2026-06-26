/**
 * Supplier CoA OCR — POST: extract structured fields from an uploaded CoA.
 *
 * multipart/form-data:
 *   - file    (required) : the CoA PDF or image
 *   - backend (optional) : "typhoon" (default) | "chandra"
 *   - analyze (optional) : "true" to enable Gemma-4 visual analysis
 *
 * Returns CoaOcrResult. Auth + permission mirror the GRN receive flow.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { extractCoaFromFile } from '@/lib/services/coa-ocr.service';
import type { OcrBackend } from '@/lib/services/ai/types';

const RECEIVE_PERMISSION = 'inventory:goods_receipt:receive';
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_BACKENDS: OcrBackend[] = ['typhoon', 'chandra'];

async function requirePermission(session: { role?: string } | null, perm: string): Promise<boolean> {
  if (!session) return false;
  if (isAdminRole(session.role ?? '')) return true;
  const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
  return perms.has(perm);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await requirePermission(session, RECEIVE_PERMISSION))) {
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 });
  }

  const filename = (file as File).name || 'coa-upload';
  const backendParamRaw = form.get('backend');
  const backendParam = typeof backendParamRaw === 'string' ? backendParamRaw : '';
  const backend = ALLOWED_BACKENDS.includes(backendParam as OcrBackend)
    ? (backendParam as OcrBackend)
    : undefined;
  const analyzePages = form.get('analyze') === 'true';

  const result = await extractCoaFromFile(file, filename, { backend, analyzePages });

  // 200 even when aiUnavailable: the operator falls back to manual entry; the
  // body's aiUnavailable flag tells the UI what happened.
  return NextResponse.json(result);
}
