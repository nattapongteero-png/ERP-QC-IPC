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
 * Spec claims: email, name, role, iat, exp, jti, and OPTIONALLY requesterId
 * (HR_employees.id) when the login account is linked to an employee. The
 * handoff works with or without that link; requesterId is sent only when known.
 * No `iss` / company key — the company is encoded in the callback URL itself
 * (e.g. .../callback/arjaro), so Metaherb only issues us 2 values: SSO_SECRET +
 * CALLBACK_URL. These are admin-managed in the DB (see
 * metaherb-sso.service.ts), with the METAHERB_* env vars as a fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { getMetaherbSsoConfig } from '@/lib/services/metaherb-sso.service';

// This handler mints a credential off the session cookie — it must never be
// cached and must always run per-request (it reads cookies anyway, but be
// explicit so a future refactor can't accidentally make it static).
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 0. Login-CSRF defense. This GET mints a real SSO credential off the
    //    ambient auth-token cookie (SameSite=Lax still sends it on top-level
    //    cross-site GET navigations). Require the request to originate from a
    //    same-origin navigation so a third-party page can't force a token
    //    mint. Browsers that send Sec-Fetch-Site must report same-origin;
    //    older browsers that omit it fall back to an Origin/Referer host check.
    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite) {
      if (secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
        // 'none' = user typed the URL / bookmark (legitimate). Anything
        // cross-site/cross-origin is rejected.
        return NextResponse.json(
          { success: false, error: 'Cross-site request blocked' },
          { status: 403 }
        );
      }
    } else {
      // Fallback for browsers without Fetch Metadata: compare Origin/Referer
      // host to this request's host. Allow when neither header is present
      // (e.g. a plain typed navigation has no Origin and may have no Referer).
      const selfHost = request.headers.get('host');
      const source = request.headers.get('origin') || request.headers.get('referer');
      if (source && selfHost) {
        try {
          if (new URL(source).host !== selfHost) {
            return NextResponse.json(
              { success: false, error: 'Cross-site request blocked' },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'Cross-site request blocked' },
            { status: 403 }
          );
        }
      }
    }

    // 1. Must be logged in to the ERP.
    const session = await getSession();
    if (!session) {
      // Bounce to login, then return here so the click "just works".
      // Preserve our own query (e.g. ?to=/market) through the round-trip.
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set(
        'redirect',
        '/api/sso/metaherb' + request.nextUrl.search
      );
      return NextResponse.redirect(loginUrl, 302);
    }

    // 2. Config — admin-managed in DB, env as fallback. Metaherb issues two
    //    per-environment values: the signing secret and the company-scoped
    //    callback URL (.../callback/<company>).
    const config = await getMetaherbSsoConfig();
    const ssoSecret = config.ssoSecret;
    const callbackRaw = config.callbackUrl;
    if (!ssoSecret || !callbackRaw) {
      console.error(
        '[metaherb-sso] Not configured (set via /settings/metaherb-sso or METAHERB_* env)'
      );
      return NextResponse.json(
        { success: false, error: 'Metaherb SSO is not configured on this server' },
        { status: 503 }
      );
    }
    // Hand-edited .env values can carry stray quotes/spaces — normalise and
    // validate the callback as a real URL here so a typo surfaces as an
    // actionable 503 config error rather than a generic 500 later.
    const callbackUrl = callbackRaw.trim().replace(/^["']|["']$/g, '');
    let callback: URL;
    try {
      callback = new URL(callbackUrl);
    } catch {
      console.error(
        '[metaherb-sso] METAHERB_CALLBACK_URL is not a valid URL:',
        callbackRaw
      );
      return NextResponse.json(
        { success: false, error: 'Metaherb SSO is misconfigured (callback URL)' },
        { status: 503 }
      );
    }
    // Defence-in-depth: a too-short secret means a brute-forceable HS256 token.
    // Don't hard-fail (could lock out a working integration) but log loudly.
    if (ssoSecret.length < 32) {
      console.warn(
        '[metaherb-sso] METAHERB_SSO_SECRET is short (<32 chars) — use a high-entropy 256-bit secret'
      );
    }

    // 3. Resolve HR_employees.id for the logged-in user (the "requester").
    //    OPTIONAL: if the account is linked to an employee we send requesterId
    //    so Metaherb can attribute the PR to that employee; if not, we still
    //    issue the token (the handoff must work for accounts with no linked
    //    employee, e.g. a bare admin). Link an account via
    //    /users/[id] → "ผูกกับพนักงาน (HR)" to populate this.
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
      // Not an error — just no employee attribution available for this account.
      console.info(
        `[metaherb-sso] user ${session.userId} (${session.email}) has no linked hr_employees row — issuing token without requesterId`
      );
    }

    // 4. Mint the handoff token. exp clamped to ≤ 180s by expiresIn.
    //    No `iss` — the company is carried in the callback URL path.
    //    requesterId is included only when the account is linked to an employee.
    const token = jwt.sign(
      {
        email: session.email,
        name: session.name,
        role: session.role,
        ...(requesterId ? { requesterId } : {}),
        jti: randomUUID(),
      },
      ssoSecret,
      { algorithm: 'HS256', expiresIn: '180s' }
    );

    // 5. Redirect to Metaherb's company-scoped callback (path already contains
    //    the company, e.g. .../callback/arjaro). Optional &redirect= passes a
    //    Metaherb-side landing path through verbatim (e.g. ?to=/market). Only
    //    accept an in-app path ('/...' but not '//' protocol-relative) so the
    //    value can't smuggle an absolute URL onto Metaherb's side.
    callback.searchParams.set('token', token);
    const to = request.nextUrl.searchParams.get('to');
    if (to && to.startsWith('/') && !to.startsWith('//')) {
      callback.searchParams.set('redirect', to);
    }

    // The token rides in the URL; suppress the Referer so the Metaherb landing
    // page can't forward it to third-party subresources.
    return NextResponse.redirect(callback.toString(), {
      status: 302,
      headers: { 'Referrer-Policy': 'no-referrer' },
    });
  } catch (error) {
    console.error('[metaherb-sso] handoff failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start Metaherb SSO' },
      { status: 500 }
    );
  }
}
