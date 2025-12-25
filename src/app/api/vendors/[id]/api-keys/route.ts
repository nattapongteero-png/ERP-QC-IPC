import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { vendorApiKeyService } from '@/lib/services/vendor-api-key.service';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.enum(['read', 'write', 'admin']).default('read'),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const deleteSchema = z.object({
  keyId: z.number(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vendorId = parseInt(id, 10);

  if (isNaN(vendorId)) {
    return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
  }

  const keys = await vendorApiKeyService.listApiKeys(vendorId);
  return NextResponse.json(keys);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vendorId = parseInt(id, 10);

  if (isNaN(vendorId)) {
    return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, permissions, expiresInDays } = parsed.data;

  let expiresAt: Date | undefined;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // TODO: Get actual user ID from session
  const createdBy = 1;

  const result = await vendorApiKeyService.createApiKey(
    vendorId,
    name,
    createdBy,
    permissions,
    expiresAt
  );

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vendorId = parseInt(id, 10);

  if (isNaN(vendorId)) {
    return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { keyId } = parsed.data;

  await vendorApiKeyService.revokeApiKey(keyId);

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
