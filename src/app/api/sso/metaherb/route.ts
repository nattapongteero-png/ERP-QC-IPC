/**
 * Metaherb SSO Handoff (ERP = token issuer)
 *
 * The logged-in ERP user clicks "เข้าสู่ Metaherb" (sidebar → จัดซื้อ, ถัดจาก ผู้ขาย),
 * which hits this endpoint. We mint a short-lived HS256 JWT signed with the
 * shared SSO secret Metaherb issued us, then 302-redirect the browser to
 * Metaherb's callback. Metaherb verifies the token and logs the user in.
 *
 * Security:
 *  - Signed with METAHERB_SSO_SECRET ONLY (never the ERP's internal JWT_SECRET).
 *  - exp ≤ 180s, unique jti per token (Metaherb rejects replayed tokens).
 *  - HTTPS only in production; secret lives in env, never hardcoded.
 *
 * Spec claims: iss, email, name, role, requesterId (HR_employees.id), iat, exp, jti.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';

const CALLBACK_URL =
  process.env.METAHERB_CALLBACK_URL ||
  'https://metaherb.co.th/api/sso/erp/callback';

export async function GET(request: NextRequest) {
  try {
    // 1. Must be logged in to the ERP.
    const session = await getSession();
    if (!session) {
      // Bounce to login, then return here so the click "just works".
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', '/api/sso/metaherb');
      return NextResponse.redirect(loginUrl, 302);
    }

    // 2. Config — fail loud if onboarding env vars are missing.
    const companyKey = process.env.METAHERB_COMPANY_KEY;
    const ssoSecret = process.env.METAHERB_SSO_SECRET;
    if (!companyKey || !ssoSecret) {
      console.error(
        '[metaherb-sso] Missing METAHERB_COMPANY_KEY or METAHERB_SSO_SECRET'
      );
      return NextResponse.json(
        { success: false, error: 'Metaherb SSO is not configured on this server' },
        { status: 503 }
      );
    }

    // 3. Resolve HR_employees.id for the logged-in user (the "requester").
    //    Metaherb requires this to attribute the PR to a real employee.
    const requesterId = await executeDbOperation(async (db) => {
      const employees = getTableRef('hREmployees');
      const rows = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, session.userId))
        .limit(1);
      return rows[0]?.id as number | undefined;
    });
    if (!requesterId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'บัญชีผู้ใช้นี้ยังไม่ได้ผูกกับพนักงาน (HR_employees) จึงออก token ให้ Metaherb ไม่ได้',
        },
        { status: 409 }
      );
    }

    // 4. Mint the handoff token. exp clamped to ≤ 180s by expiresIn.
    const token = jwt.sign(
      {
        iss: companyKey,
        email: session.email,
        name: session.name,
        role: session.role,
        requesterId,
        jti: randomUUID(),
      },
      ssoSecret,
      { algorithm: 'HS256', expiresIn: '180s' }
    );

    // 5. Redirect to Metaherb's callback. Optional &redirect= passes a
    //    Metaherb-side landing path through verbatim (e.g. ?to=/market).
    const callback = new URL(CALLBACK_URL);
    callback.searchParams.set('token', token);
    const to = request.nextUrl.searchParams.get('to');
    if (to && to.startsWith('/')) {
      callback.searchParams.set('redirect', to);
    }

    return NextResponse.redirect(callback.toString(), 302);
  } catch (error) {
    console.error('[metaherb-sso] handoff failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start Metaherb SSO' },
      { status: 500 }
    );
  }
}
