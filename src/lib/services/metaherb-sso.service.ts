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
const KEY_CALLBACK = 'metaherb.callback_url'; // value = plain URL
const KEY_PR_STATUS_URL = 'metaherb.pr_status_url'; // value = plain URL (outbound PR-status webhook)

function getTables() {
  return { settings: getTableRef('settings') };
}

/** Resolved config the SSO route actually uses (decrypted secret). */
export interface MetaherbSsoConfig {
  ssoSecret: string | null;
  callbackUrl: string | null;
  /** Outbound PR-status webhook target (.../pr-status/<company>). */
  prStatusUrl: string | null;
  /**
   * Where each value came from — for diagnostics in the settings UI.
   * 'db-decrypt-failed' = a secret IS stored but couldn't be decrypted
   * (almost always a VMI_ENCRYPTION_KEY mismatch/rotation), so we fell back.
   */
  source: {
    secret: 'db' | 'env' | 'none' | 'db-decrypt-failed';
    callback: 'db' | 'env' | 'none';
    prStatus: 'db' | 'env' | 'none';
  };
}

/** What the settings UI shows (secret never leaves the server in clear). */
export interface MetaherbSsoSettingsView {
  callbackUrl: string;
  prStatusUrl: string;
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

  // --- callback URL ---
  let callbackUrl: string | null = null;
  let callbackSource: MetaherbSsoConfig['source']['callback'] = 'none';
  if (db[KEY_CALLBACK]) {
    callbackUrl = db[KEY_CALLBACK];
    callbackSource = 'db';
  } else if (process.env.METAHERB_CALLBACK_URL) {
    callbackUrl = process.env.METAHERB_CALLBACK_URL;
    callbackSource = 'env';
  }

  // --- PR-status webhook URL (outbound) ---
  let prStatusUrl: string | null = null;
  let prStatusSource: MetaherbSsoConfig['source']['prStatus'] = 'none';
  if (db[KEY_PR_STATUS_URL]) {
    prStatusUrl = db[KEY_PR_STATUS_URL];
    prStatusSource = 'db';
  } else if (process.env.METAHERB_PR_STATUS_URL) {
    prStatusUrl = process.env.METAHERB_PR_STATUS_URL.trim().replace(/^["']|["']$/g, '');
    prStatusSource = 'env';
  }

  // Reference dbAvailable so a future caller can branch on it; logged above.
  void dbAvailable;

  return {
    ssoSecret,
    callbackUrl,
    prStatusUrl,
    source: { secret: secretSource, callback: callbackSource, prStatus: prStatusSource },
  };
}

/** Settings-page view: never returns the secret value, only whether it's set. */
export async function getMetaherbSsoSettingsView(): Promise<MetaherbSsoSettingsView> {
  const cfg = await getMetaherbSsoConfig();
  return {
    callbackUrl: cfg.callbackUrl ?? '',
    prStatusUrl: cfg.prStatusUrl ?? '',
    secretConfigured: !!cfg.ssoSecret,
    source: cfg.source,
  };
}

export interface MetaherbSsoUpdate {
  /** New plaintext secret. Omit/empty = leave the stored secret unchanged. */
  ssoSecret?: string;
  /** New callback URL. Provide to set; empty string clears it. */
  callbackUrl?: string;
  /** New PR-status webhook URL. Provide to set; empty string clears it. */
  prStatusUrl?: string;
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

    if (typeof data.callbackUrl === 'string') {
      // Normalise stray quotes/spaces from copy-paste.
      const clean = data.callbackUrl.trim().replace(/^["']|["']$/g, '');
      // A whitespace-only value is almost never an intentional "clear" — skip it
      // so a stray save can't silently wipe a working callback. To actually
      // clear, the UI must send an explicit empty string with no other content.
      const isClear = data.callbackUrl === '';
      if (clean !== '' || isClear) {
        await upsert(KEY_CALLBACK, clean);
      }
    }

    if (typeof data.prStatusUrl === 'string') {
      // Same trim/quote-strip + explicit-empty-to-clear rule as callbackUrl.
      const clean = data.prStatusUrl.trim().replace(/^["']|["']$/g, '');
      const isClear = data.prStatusUrl === '';
      if (clean !== '' || isClear) {
        await upsert(KEY_PR_STATUS_URL, clean);
      }
    }

    // Only touch the secret when a non-empty new value is provided.
    if (data.ssoSecret && data.ssoSecret.trim() !== '') {
      await upsert(KEY_SECRET, encrypt(data.ssoSecret.trim()));
    }
  });
}
