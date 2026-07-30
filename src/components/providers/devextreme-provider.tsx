"use client";

import { useEffect, useRef } from 'react';
import { locale as setDxLocale, loadMessages } from "devextreme/localization";
import config from 'devextreme/core/config';
import dxDataGrid from 'devextreme/ui/data_grid';
import { useLocale } from 'next-intl';

// DevExtreme CSS - imported via JS to avoid @import order issues in bundled CSS
import 'devextreme/dist/css/dx.material.teal.light.css';
// DevExtreme Diagram CSS - required for proper diagram rendering
import 'devexpress-diagram/dist/dx-diagram.min.css';
// Emerald theme color overrides
import '@/styles/dx.emerald-override.css';
// Mobile-specific overrides
import '@/styles/dx.mobile-overrides.css';

// Thai translations (default)
import thMessages from '@/localization/th.json';
// English translations
import enMessages from '@/locales/en/devextreme.json';

// DevExtreme license key (base64 encoded) - supports up to v25.2.x
const LICENSE_KEY = "ewogICJmb3JtYXQiOiAxLAogICJjdXN0b21lcklkIjogIjkyMjY4ODllLTg0ZjUtNDViYS1iZDBhLTk2YWFjNzM1N2ZkMiIsCiAgIm1heFZlcnNpb25BbGxvd2VkIjogMjUyCn0=.rRYplWY3hBop1otsFZsOm/7mi4iDCnPKrC7rJ7r2e+lLr/RuKzqLkc+3xhWrP5smjcHi3lI4O4yDU3sMV6SOcega3W9KyAxyhjoNoR21SKeHBFLlnqoggxavKrRe1nUUijipaQ==";

// Set the license key at module load time — BEFORE any DevExtreme component renders.
// Setting it inside useEffect runs too late; the first render fires the evaluation toast.
config({ licenseKey: LICENSE_KEY });

// Make every DataGrid responsive and show its full content, app-wide, without
// editing each grid one by one. `columnHidingEnabled` collapses low-priority
// columns into an adaptive (expandable) detail row on narrow screens — the
// table adapts to the screen resolution and never needs a horizontal
// scrollbar. `wordWrapEnabled` shows the whole cell value instead of clipping
// it to a stray "…". `columnAutoWidth` sizes columns to their content. A grid
// that sets any of these props explicitly still overrides the default.
dxDataGrid.defaultOptions({
  options: {
    columnHidingEnabled: true,
    columnAutoWidth: true,
    wordWrapEnabled: true,
  },
});

// Track if messages have been loaded
const loadedLocales = new Set<string>();

interface DevExtremeProviderProps {
  children: React.ReactNode;
}

export function DevExtremeProvider({ children }: DevExtremeProviderProps) {
  const initialized = useRef(false);
  const locale = useLocale();

  useEffect(() => {
    // License key already applied at module load time — only initialize messages once
    if (!initialized.current) {
      initialized.current = true;

      // Load Thai messages (always load as fallback)
      loadMessages(thMessages);
      loadedLocales.add('th');
      console.log('[DevExtreme] Initialized');
    }

    // Load English messages if needed
    if (locale === 'en' && !loadedLocales.has('en')) {
      loadMessages(enMessages);
      loadedLocales.add('en');
      console.log('[DevExtreme] English messages loaded');
    }

    // Sync DevExtreme locale with i18n
    setDxLocale(locale);
    console.log(`[DevExtreme] Locale synced to: ${locale}`);
  }, [locale]);

  return <>{children}</>;
}
