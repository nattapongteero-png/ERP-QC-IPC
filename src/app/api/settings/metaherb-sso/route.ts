/**
 * API Route: Metaherb SSO Settings
 * GET  /api/settings/metaherb-sso - Load config (secret value is NEVER returned)
 * PUT  /api/settings/metaherb-sso - Save config (secret encrypted at rest)
 *
 * Admin-managed alternative to the METAHERB_* env vars so the SSO secret /
 * callback URL can be changed from the web without a redeploy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getMetaherbSsoSettingsView,
  updateMetaherbSsoConfig,
} from '@/lib/services/metaherb-sso.service';

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const view = await getMetaherbSsoSettingsView();
        return NextResponse.json({ success: true, data: view });
      } catch (error) {
        console.error('Error loading Metaherb SSO settings:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to load settings' },
          { status: 500 }
        );
      }
    },
    ['settings:read']
  );
}

// Optional allow-list of permitted Metaherb hosts, comma-separated in
// METAHERB_ALLOWED_CALLBACK_HOSTS (e.g. "api.pomdevth.site,metaherb.co.th").
// When unset, any https/http host is accepted (back-compat). Applies to both
// the SSO callback URL and the PR-status webhook URL (same partner hosts).
function allowedCallbackHosts(): string[] {
  return (process.env.METAHERB_ALLOWED_CALLBACK_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Validate a Metaherb URL field (callback or pr-status). Returns an error
 * string if invalid, or null if OK (including the empty/clear case).
 * `label` personalises the Thai error message.
 */
function validateMetaherbUrl(value: string | undefined, label: string): string | null {
  if (!value || value.trim() === '') return null; // empty = clear, allowed
  let u: URL;
  try {
    u = new URL(value.trim().replace(/^["']|["']$/g, ''));
  } catch {
    return `${label}ไม่ถูกต้อง (ต้องเป็น URL https://)`;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return `${label}ต้องขึ้นต้นด้วย https:// หรือ http://`;
  }
  const allow = allowedCallbackHosts();
  if (allow.length > 0 && !allow.includes(u.host.toLowerCase())) {
    return `โฮสต์ของ${label}ไม่ได้รับอนุญาต (อนุญาต: ${allow.join(', ')})`;
  }
  return null;
}

export async function PUT(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      // Client errors (bad JSON) must read as 400, not 500.
      let body: Record<string, unknown> | null;
      try {
        body = (await request.json()) as Record<string, unknown> | null;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      try {
        // Only accept the managed fields; ignore anything else.
        const callbackUrl =
          typeof body?.callbackUrl === 'string' ? body.callbackUrl : undefined;
        const ssoSecret =
          typeof body?.ssoSecret === 'string' ? body.ssoSecret : undefined;
        const prStatusUrl =
          typeof body?.prStatusUrl === 'string' ? body.prStatusUrl : undefined;

        // Validate URL fields up-front (empty allowed = clear it).
        const callbackErr = validateMetaherbUrl(callbackUrl, 'Callback URL ');
        if (callbackErr) {
          return NextResponse.json({ success: false, error: callbackErr }, { status: 400 });
        }
        const prStatusErr = validateMetaherbUrl(prStatusUrl, 'PR Status Webhook URL ');
        if (prStatusErr) {
          return NextResponse.json({ success: false, error: prStatusErr }, { status: 400 });
        }

        await updateMetaherbSsoConfig({ callbackUrl, ssoSecret, prStatusUrl }, session.userId);
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error saving Metaherb SSO settings:', error);
        // Encryption key misconfig is the most likely server-side failure here.
        const msg =
          error instanceof Error && /VMI_ENCRYPTION_KEY/.test(error.message)
            ? 'บันทึกไม่สำเร็จ: ระบบเข้ารหัสยังไม่ได้ตั้งค่า (VMI_ENCRYPTION_KEY)'
            : 'Failed to save settings';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }
    },
    ['settings:write']
  );
}
