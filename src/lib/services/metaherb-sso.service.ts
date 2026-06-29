/**
 * Metaherb SSO Config Service
 *
 * Stores the Metaherb SSO handoff config in the key-value `settings` table so
 * an admin can change it from the web UI without redeploying / editing env.
 * Metaherb issues 2 per-environment values: a signing secret and a
 * company-scoped callback URL (.../callback/<company>).
 *
 * The secret is a credential → stored AES-256-GCM encrypted (reuses the VMI
 * encryption util + VMI_ENCRYPTION_KEY). The callback URL is non-secret →
 * stored plain.
 *
 * Resolution order for the running app (see getMetaherbSsoConfig):
 *   1. DB settings (admin-managed)         ← preferred
 *   2. process.env.METAHERB_*              ← fallback / bootstrap
 */

import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { encrypt, decrypt, isValidCiphertext } from '../crypto/encrypt';

const CATEGORY = 'metaherb_sso';
const KEY_SECRET = 'metaherb.sso_secret'; // value = AES-GCM ciphertext
const KEY_CALLBACK = 'metaherb.callback_url'; // value = plain URL (legacy explicit; superseded by base_url+company_key)
const KEY_PR_STATUS_URL = 'metaherb.pr_status_url'; // value = plain URL (legacy explicit)
const KEY_PO_SUBMIT_URL = 'metaherb.po_submit_url'; // value = plain URL (legacy explicit)
const KEY_FACTORY_NAME = 'metaherb.factory_name'; // value = plain text (our company/factory name sent in po-submit)
// New simplified model: store base URL + company key once, derive every endpoint.
const KEY_BASE_URL = 'metaherb.base_url'; // e.g. https://api.pomdevth.site
const KEY_COMPANY_KEY = 'metaherb.company_key'; // e.g. uat (the per-tenant segment baked into every URL)

/**
 * Path templates for the Metaherb endpoints, relative to the base URL. The
 * company key is the last segment of each (Metaherb routes by it; a mismatch
 * yields 403). Callback lives under /api/sso/erp/, the webhooks under /api/erp/.
 */
const METAHERB_PATHS = {
  callback: (key: string) => `/api/sso/erp/callback/${key}`,
  prStatus: (key: string) => `/api/erp/pr-status/${key}`,
  poSubmit: (key: string) => `/api/erp/po-submit/${key}`,
  poOwnerDecision: (key: string) => `/api/erp/po-owner-decision/${key}`,
} as const;

/** Resolved set of all Metaherb endpoint URLs (built from base + companyKey). */
export interface MetaherbUrls {
  callbackUrl: string;
  prStatusUrl: string;
  poSubmitUrl: string;
  poOwnerDecisionUrl: string;
}

/**
 * Build every Metaherb endpoint URL from a base URL + company key. Trims a
 * trailing slash on the base so we don't produce '//api'. Returns null if
 * either input is empty.
 */
export function buildMetaherbUrls(
  baseUrl: string | null | undefined,
  companyKey: string | null | undefined,
): MetaherbUrls | null {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
  const key = (companyKey ?? '').trim();
  if (!base || !key) return null;
  return {
    callbackUrl: base + METAHERB_PATHS.callback(key),
    prStatusUrl: base + METAHERB_PATHS.prStatus(key),
    poSubmitUrl: base + METAHERB_PATHS.poSubmit(key),
    poOwnerDecisionUrl: base + METAHERB_PATHS.poOwnerDecision(key),
  };
}

function getTables() {
  return { settings: getTableRef('settings') };
}

/** Resolved config the SSO route actually uses (decrypted secret). */
export interface MetaherbSsoConfig {
  ssoSecret: string | null;
  /** The base URL + company key the URLs were built from (when using the new model). */
  baseUrl: string | null;
  companyKey: string | null;
  callbackUrl: string | null;
  /** Outbound PR-status webhook target (.../pr-status/<company>). */
  prStatusUrl: string | null;
  /** Outbound PO-submit webhook target (.../po-submit/<company>). */
  poSubmitUrl: string | null;
  /** Outbound po-owner-decision webhook target (.../po-owner-decision/<company>). */
  poOwnerDecisionUrl: string | null;
  /** Our company/factory name, sent as `factory` in the po-submit body. */
  factoryName: string | null;
  /**
   * Where the URLs came from — for diagnostics in the settings UI.
   * 'base' = built from base_url + company_key (new model).
   * 'db-decrypt-failed' = a secret IS stored but couldn't be decrypted.
   */
  source: {
    secret: 'db' | 'env' | 'none' | 'db-decrypt-failed';
    urls: 'base' | 'legacy' | 'env' | 'none';
    // 'company' = inherited from the ERP company settings (the default — no
    // dedicated Metaherb factory value was set).
    factory: 'db' | 'env' | 'company' | 'none';
  };
}

/**
 * Derive the PO-submit URL from the PR-status URL by replacing the
 * '/pr-status/' path segment with '/po-submit/'. Returns null if the input is
 * null or doesn't contain that segment.
 */
export function derivePoSubmitUrl(prStatusUrl: string | null): string | null {
  if (!prStatusUrl) return null;
  if (!prStatusUrl.includes('/pr-status/')) return null;
  return prStatusUrl.replace('/pr-status/', '/po-submit/');
}

/**
 * Derive the po-owner-decision URL from the po-submit URL (swap '/po-submit/' →
 * '/po-owner-decision/', same host + company segment). Returns null if the
 * input is null or doesn't contain '/po-submit/'.
 */
export function derivePoOwnerDecisionUrl(poSubmitUrl: string | null): string | null {
  if (!poSubmitUrl) return null;
  if (!poSubmitUrl.includes('/po-submit/')) return null;
  return poSubmitUrl.replace('/po-submit/', '/po-owner-decision/');
}

/** What the settings UI shows (secret never leaves the server in clear). */
export interface MetaherbSsoSettingsView {
  /** New simplified inputs. */
  baseUrl: string;
  companyKey: string;
  /** Our company/factory name sent in po-submit. */
  factoryName: string;
  /** Resolved endpoint URLs (read-only preview, built from base + key). */
  callbackUrl: string;
  prStatusUrl: string;
  poSubmitUrl: string;
  poOwnerDecisionUrl: string;
  /** True if a secret is configured (in DB or env) — value itself is hidden. */
  secretConfigured: boolean;
  source: MetaherbSsoConfig['source'];
}

async function readRawSettings(): Promise<Record<string, string>> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = (await db
      .select({ key: tables.settings.key, value: tables.settings.value })
      .from(tables.settings)
      .where(eq(tables.settings.category, CATEGORY))) as {
      key: string;
      value: string | null;
    }[];
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.value != null && r.value !== '') map[r.key] = r.value;
    }
    return map;
  });
}

/**
 * Resolve the active SSO config: DB first, env fallback. The returned
 * ssoSecret is decrypted plaintext ready for jwt.sign.
 */
export async function getMetaherbSsoConfig(): Promise<MetaherbSsoConfig> {
  // DB read can fail (DB down). Distinguish that from "no rows" so a transient
  // outage doesn't silently look like an empty/unconfigured integration.
  let db: Record<string, string> = {};
  let dbAvailable = true;
  try {
    db = await readRawSettings();
  } catch (err) {
    dbAvailable = false;
    console.error(
      '[metaherb-sso] settings DB read failed — falling back to env config',
      err instanceof Error ? err.message : err
    );
  }

  // --- secret ---
  let ssoSecret: string | null = null;
  let secretSource: MetaherbSsoConfig['source']['secret'] = 'none';
  let secretDecryptFailed = false;
  const dbSecret = db[KEY_SECRET];
  if (dbSecret) {
    try {
      // Stored encrypted; tolerate a legacy plain value just in case.
      ssoSecret = isValidCiphertext(dbSecret) ? decrypt(dbSecret) : dbSecret;
      secretSource = 'db';
    } catch (err) {
      // Ciphertext present but won't decrypt — almost always a
      // VMI_ENCRYPTION_KEY mismatch/rotation, NOT "unconfigured". Surface it.
      secretDecryptFailed = true;
      ssoSecret = null;
      console.error(
        '[metaherb-sso] stored SSO secret failed to decrypt (VMI_ENCRYPTION_KEY rotated/differs?) — falling back to env',
        err instanceof Error ? err.message : err
      );
    }
  }
  if (!ssoSecret && process.env.METAHERB_SSO_SECRET) {
    // Trim stray quotes/whitespace from a hand-edited env value so we don't
    // sign with literal quotes.
    ssoSecret = process.env.METAHERB_SSO_SECRET.trim().replace(/^["']|["']$/g, '');
    secretSource = 'env';
  }
  if (!ssoSecret && secretDecryptFailed) {
    secretSource = 'db-decrypt-failed';
  }

  // --- endpoint URLs ---
  // Preferred (new) model: a single base URL + company key from which every
  // endpoint is built. Falls back to the legacy explicit per-URL settings (and
  // their env vars) so existing tenants keep working until they re-save with the
  // simplified form. base/key may come from DB or env.
  const baseUrl =
    db[KEY_BASE_URL] ||
    (process.env.METAHERB_BASE_URL ? process.env.METAHERB_BASE_URL.trim().replace(/^["']|["']$/g, '') : '');
  const companyKey =
    db[KEY_COMPANY_KEY] ||
    (process.env.METAHERB_COMPANY_KEY ? process.env.METAHERB_COMPANY_KEY.trim().replace(/^["']|["']$/g, '') : '');

  let callbackUrl: string | null = null;
  let prStatusUrl: string | null = null;
  let poSubmitUrl: string | null = null;
  let poOwnerDecisionUrl: string | null = null;
  let urlsSource: MetaherbSsoConfig['source']['urls'] = 'none';
  let resolvedBaseUrl: string | null = null;
  let resolvedCompanyKey: string | null = null;

  const built = buildMetaherbUrls(baseUrl, companyKey);
  if (built) {
    // New model wins when both base + key are present.
    callbackUrl = built.callbackUrl;
    prStatusUrl = built.prStatusUrl;
    poSubmitUrl = built.poSubmitUrl;
    poOwnerDecisionUrl = built.poOwnerDecisionUrl;
    resolvedBaseUrl = baseUrl;
    resolvedCompanyKey = companyKey;
    urlsSource = db[KEY_BASE_URL] || db[KEY_COMPANY_KEY] ? 'base' : 'env';
  } else {
    // Legacy: explicit full URLs (DB → env), po-submit/po-owner-decision derived.
    callbackUrl = db[KEY_CALLBACK] || process.env.METAHERB_CALLBACK_URL || null;
    prStatusUrl =
      db[KEY_PR_STATUS_URL] ||
      (process.env.METAHERB_PR_STATUS_URL
        ? process.env.METAHERB_PR_STATUS_URL.trim().replace(/^["']|["']$/g, '')
        : null);
    poSubmitUrl =
      db[KEY_PO_SUBMIT_URL] ||
      (process.env.METAHERB_PO_SUBMIT_URL
        ? process.env.METAHERB_PO_SUBMIT_URL.trim().replace(/^["']|["']$/g, '')
        : null) ||
      derivePoSubmitUrl(prStatusUrl);
    poOwnerDecisionUrl = derivePoOwnerDecisionUrl(poSubmitUrl);
    if (callbackUrl || prStatusUrl || poSubmitUrl) {
      urlsSource = db[KEY_CALLBACK] || db[KEY_PR_STATUS_URL] || db[KEY_PO_SUBMIT_URL] ? 'legacy' : 'env';
    }
  }

  // --- factory name (our company name sent in po-submit) ---
  // Default to the ERP's own company name (settings page) so this never needs a
  // separate entry. An explicit Metaherb factory value (DB/env) overrides it —
  // kept for the rare case the name shown to Metaherb should differ.
  let factoryName: string | null = null;
  let factorySource: MetaherbSsoConfig['source']['factory'] = 'none';
  if (db[KEY_FACTORY_NAME]) {
    factoryName = db[KEY_FACTORY_NAME];
    factorySource = 'db';
  } else if (process.env.METAHERB_FACTORY_NAME) {
    factoryName = process.env.METAHERB_FACTORY_NAME.trim();
    factorySource = 'env';
  } else {
    // Inherit from company settings (Thai name preferred, English fallback).
    try {
      const { getCompanySettings } = await import('./settings.service');
      const company = await getCompanySettings();
      const inherited = (company.companyNameTh || company.companyName || '').trim();
      if (inherited) {
        factoryName = inherited;
        factorySource = 'company';
      }
    } catch (err) {
      console.error(
        '[metaherb-sso] could not read company settings for factory fallback',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Reference dbAvailable so a future caller can branch on it; logged above.
  void dbAvailable;

  return {
    ssoSecret,
    baseUrl: resolvedBaseUrl,
    companyKey: resolvedCompanyKey,
    callbackUrl,
    prStatusUrl,
    poSubmitUrl,
    poOwnerDecisionUrl,
    factoryName,
    source: {
      secret: secretSource,
      urls: urlsSource,
      factory: factorySource,
    },
  };
}

/** Settings-page view: never returns the secret value, only whether it's set. */
export async function getMetaherbSsoSettingsView(): Promise<MetaherbSsoSettingsView> {
  const cfg = await getMetaherbSsoConfig();
  return {
    baseUrl: cfg.baseUrl ?? '',
    companyKey: cfg.companyKey ?? '',
    factoryName: cfg.factoryName ?? '',
    callbackUrl: cfg.callbackUrl ?? '',
    prStatusUrl: cfg.prStatusUrl ?? '',
    poSubmitUrl: cfg.poSubmitUrl ?? '',
    poOwnerDecisionUrl: cfg.poOwnerDecisionUrl ?? '',
    secretConfigured: !!cfg.ssoSecret,
    source: cfg.source,
  };
}

export interface MetaherbSsoUpdate {
  /** New plaintext secret. Omit/empty = leave the stored secret unchanged. */
  ssoSecret?: string;
  /** Metaherb API base URL, e.g. https://api.pomdevth.site. Empty string clears it. */
  baseUrl?: string;
  /** Per-tenant company key (last URL segment), e.g. uat. Empty string clears it. */
  companyKey?: string;
  /** Our company/factory name for po-submit. Provide to set; empty string clears it. */
  factoryName?: string;
}

/**
 * Upsert the SSO config. The secret is encrypted before storage. Passing an
 * empty/undefined ssoSecret leaves the existing secret untouched (so the UI
 * can save the callback URL without re-entering the secret every time).
 */
export async function updateMetaherbSsoConfig(
  data: MetaherbSsoUpdate,
  userId?: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    const upsert = async (key: string, value: string) => {
      const existing = await db
        .select({ id: tables.settings.id })
        .from(tables.settings)
        .where(eq(tables.settings.key, key))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(tables.settings)
          .set({ value, category: CATEGORY, updatedBy: userId ?? null, updatedAt: now })
          .where(eq(tables.settings.key, key));
      } else {
        await db.insert(tables.settings).values({
          key,
          value,
          category: CATEGORY,
          updatedBy: userId ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
    };

    if (typeof data.baseUrl === 'string') {
      // Normalise stray quotes/spaces + trailing slash from copy-paste.
      const clean = data.baseUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
      const isClear = data.baseUrl === '';
      if (clean !== '' || isClear) {
        await upsert(KEY_BASE_URL, clean);
        // Saving the simplified model supersedes any legacy explicit URLs — clear
        // them so they can't shadow the base+key resolution.
        await upsert(KEY_CALLBACK, '');
        await upsert(KEY_PR_STATUS_URL, '');
        await upsert(KEY_PO_SUBMIT_URL, '');
      }
    }

    if (typeof data.companyKey === 'string') {
      // Plain segment — trim + strip any slashes the user may paste.
      const clean = data.companyKey.trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '');
      const isClear = data.companyKey === '';
      if (clean !== '' || isClear) {
        await upsert(KEY_COMPANY_KEY, clean);
      }
    }

    if (typeof data.factoryName === 'string') {
      // Plain text — trim only. Empty = clear.
      const clean = data.factoryName.trim();
      const isClear = data.factoryName === '';
      if (clean !== '' || isClear) {
        await upsert(KEY_FACTORY_NAME, clean);
      }
    }

    // Only touch the secret when a non-empty new value is provided.
    if (data.ssoSecret && data.ssoSecret.trim() !== '') {
      await upsert(KEY_SECRET, encrypt(data.ssoSecret.trim()));
    }
  });
}
