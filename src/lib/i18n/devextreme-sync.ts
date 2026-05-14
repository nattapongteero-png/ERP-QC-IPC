/**
 * DevExtreme Locale Sync
 *
 * Synchronizes the i18n locale with DevExtreme's localization system
 * to ensure consistent language across both systems.
 */

'use client';

import { locale as setDxLocale, loadMessages } from 'devextreme/localization';
import type { Locale } from './config';

// Track if messages have been loaded
const loadedLocales = new Set<string>();

/**
 * Sync the current locale to DevExtreme
 */
export function syncDevExtremeLocale(locale: Locale): void {
  setDxLocale(locale);
  console.log(`[DevExtreme] Locale synced to: ${locale}`);
}

/**
 * Load custom DevExtreme messages for a locale
 */
export async function loadDevExtremeMessages(locale: Locale): Promise<void> {
  // Skip if already loaded
  if (loadedLocales.has(locale)) {
    return;
  }

  try {
    // Load custom DevExtreme messages from our locales
    const customMessages = await import(`@/locales/${locale}/devextreme.json`)
      .then((m) => m.default)
      .catch(() => null);

    if (customMessages) {
      // Convert our format to DevExtreme format
      // Our format: { dxDataGrid: { noDataText: "..." } }
      // DevExtreme format: { [locale]: { "dxDataGrid-noDataText": "..." } }
      const dxMessages: Record<string, Record<string, string>> = {
        [locale]: {},
      };

      for (const [component, messages] of Object.entries(customMessages)) {
        if (typeof messages === 'object' && messages !== null) {
          for (const [key, value] of Object.entries(messages as Record<string, string>)) {
            dxMessages[locale][`${component}-${key}`] = value;
          }
        }
      }

      loadMessages(dxMessages);
      loadedLocales.add(locale);
      console.log(`[DevExtreme] Custom messages loaded for: ${locale}`);
    }
  } catch (error) {
    console.warn(`[DevExtreme] Failed to load custom messages for ${locale}:`, error);
  }
}

/**
 * Initialize DevExtreme with the current locale
 */
export async function initDevExtremeLocale(locale: Locale): Promise<void> {
  await loadDevExtremeMessages(locale);
  syncDevExtremeLocale(locale);
}
