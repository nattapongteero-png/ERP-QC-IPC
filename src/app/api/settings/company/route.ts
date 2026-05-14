/**
 * API Route: Company Settings
 * GET  /api/settings/company - Load company settings
 * PUT  /api/settings/company - Save company settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getCompanySettings,
  upsertCompanySettings,
} from '@/lib/services/settings.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const settings = await getCompanySettings();
      return NextResponse.json({ success: true, data: settings });
    } catch (error) {
      console.error('Error loading company settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load settings' },
        { status: 500 },
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      await upsertCompanySettings(body, session.userId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error saving company settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save settings' },
        { status: 500 },
      );
    }
  });
}
