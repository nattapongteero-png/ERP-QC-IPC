/**
 * Settings Service
 *
 * Manages company settings using the key-value `settings` table.
 * Each setting is stored as a row with `key`, `value`, and `category`.
 */

import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';

// Keys for company settings
const COMPANY_SETTINGS_CATEGORY = 'company';
const REGULATORY_SETTINGS_CATEGORY = 'regulatory';
const PREFIX_SETTINGS_CATEGORY = 'prefix';

export interface CompanySettings {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  fdaLicense: string;
  gmpCertificate: string;
  lotPrefix: string;
  poPrefix: string;
  soPrefix: string;
  woPrefix: string;
}

// Map setting keys to their categories
const SETTING_CATEGORIES: Record<keyof CompanySettings, string> = {
  companyName: COMPANY_SETTINGS_CATEGORY,
  companyNameTh: COMPANY_SETTINGS_CATEGORY,
  address: COMPANY_SETTINGS_CATEGORY,
  phone: COMPANY_SETTINGS_CATEGORY,
  email: COMPANY_SETTINGS_CATEGORY,
  taxId: REGULATORY_SETTINGS_CATEGORY,
  fdaLicense: REGULATORY_SETTINGS_CATEGORY,
  gmpCertificate: REGULATORY_SETTINGS_CATEGORY,
  lotPrefix: PREFIX_SETTINGS_CATEGORY,
  poPrefix: PREFIX_SETTINGS_CATEGORY,
  soPrefix: PREFIX_SETTINGS_CATEGORY,
  woPrefix: PREFIX_SETTINGS_CATEGORY,
};

const DEFAULTS: CompanySettings = {
  companyName: '',
  companyNameTh: '',
  address: '',
  phone: '',
  email: '',
  taxId: '',
  fdaLicense: '',
  gmpCertificate: '',
  lotPrefix: 'LOT',
  poPrefix: 'PO',
  soPrefix: 'SO',
  woPrefix: 'WO',
};

function getTables() {
  return {
    settings: getTableRef('settings'),
  };
}

/**
 * Get all company settings from the database.
 * Returns defaults for any missing keys.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db.select().from(tables.settings);

    // Build a key→value map from DB rows
    const dbMap = new Map<string, string>();
    for (const row of rows as { key: string; value: string | null }[]) {
      if (row.value != null) {
        dbMap.set(row.key, row.value);
      }
    }

    // Merge with defaults
    const result: CompanySettings = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof CompanySettings)[]) {
      const dbValue = dbMap.get(key);
      if (dbValue !== undefined) {
        result[key] = dbValue;
      }
    }

    return result;
  });
}

/**
 * Upsert company settings.
 * Only updates keys present in the provided data.
 */
export async function upsertCompanySettings(
  data: Partial<CompanySettings>,
  userId?: number,
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    for (const [key, value] of Object.entries(data)) {
      if (!(key in SETTING_CATEGORIES)) continue;

      const category = SETTING_CATEGORIES[key as keyof CompanySettings];

      // Check if key exists
      const existing = await db
        .select({ id: tables.settings.id })
        .from(tables.settings)
        .where(eq(tables.settings.key, key))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(tables.settings)
          .set({
            value: value ?? '',
            category,
            updatedBy: userId ?? null,
            updatedAt: now,
          })
          .where(eq(tables.settings.key, key));
      } else {
        // Insert new
        await db.insert(tables.settings).values({
          key,
          value: value ?? '',
          category,
          updatedBy: userId ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });
}
