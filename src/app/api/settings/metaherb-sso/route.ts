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

// Optional allow-list of permitted Metaherb callback hosts, comma-separated in
// METAHERB_ALLOWED_CALLBACK_HOSTS (e.g. "api.pomdevth.site,metaherb.co.th").
// When unset, any https/http host is accepted (back-compat).
function allowedCallbackHosts(): string[] {
  return (process.env.METAHERB_ALLOWED_CALLBACK_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
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
        // Only accept the two managed fields; ignore anything else.
        const callbackUrl =
          typeof body?.callbackUrl === 'string' ? body.callbackUrl : undefined;
        const ssoSecret =
          typeof body?.ssoSecret === 'string' ? body.ssoSecret : undefined;

        // Validate callback URL shape up-front (empty allowed = clear it).
        if (callbackUrl && callbackUrl.trim() !== '') {
          let u: URL;
          try {
            u = new URL(callbackUrl.trim().replace(/^["']|["']$/g, ''));
          } catch {
            return NextResponse.json(
              { success: false, error: 'Callback URL ไม่ถูกต้อง (ต้องเป็น URL https://)' },
              { status: 400 }
            );
          }
          if (u.protocol !== 'https:' && u.protocol !== 'http:') {
            return NextResponse.json(
              { success: false, error: 'Callback URL ต้องขึ้นต้นด้วย https:// หรือ http://' },
              { status: 400 }
            );
          }
          const allow = allowedCallbackHosts();
          if (allow.length > 0 && !allow.includes(u.host.toLowerCase())) {
            return NextResponse.json(
              {
                success: false,
                error: `โฮสต์ของ Callback URL ไม่ได้รับอนุญาต (อนุญาต: ${allow.join(', ')})`,
              },
              { status: 400 }
            );
          }
        }

        await updateMetaherbSsoConfig({ callbackUrl, ssoSecret }, session.userId);
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
