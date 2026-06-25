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

export async function PUT(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();
        // Only accept the two managed fields; ignore anything else.
        const callbackUrl =
          typeof body?.callbackUrl === 'string' ? body.callbackUrl : undefined;
        const ssoSecret =
          typeof body?.ssoSecret === 'string' ? body.ssoSecret : undefined;

        // Validate callback URL shape up-front (empty allowed = clear it).
        if (callbackUrl && callbackUrl.trim() !== '') {
          try {
            const u = new URL(callbackUrl.trim().replace(/^["']|["']$/g, ''));
            if (u.protocol !== 'https:' && u.protocol !== 'http:') {
              throw new Error('bad protocol');
            }
          } catch {
            return NextResponse.json(
              { success: false, error: 'Callback URL ไม่ถูกต้อง (ต้องเป็น URL https://)' },
              { status: 400 }
            );
          }
        }

        await updateMetaherbSsoConfig({ callbackUrl, ssoSecret }, session.userId);
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error saving Metaherb SSO settings:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to save settings' },
          { status: 500 }
        );
      }
    },
    ['settings:write']
  );
}
