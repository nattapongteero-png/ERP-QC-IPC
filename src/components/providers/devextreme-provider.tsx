"use client";

import { useEffect, useRef } from 'react';
import { locale, loadMessages } from "devextreme/localization";
import config from 'devextreme/core/config';

// DevExtreme CSS - imported via JS to avoid @import order issues in bundled CSS
import 'devextreme/dist/css/dx.material.teal.light.css';
// DevExtreme Diagram CSS - required for proper diagram rendering
import 'devexpress-diagram/dist/dx-diagram.min.css';
// Emerald theme color overrides
import '@/styles/dx.emerald-override.css';
// Mobile-specific overrides
import '@/styles/dx.mobile-overrides.css';

// Thai translations
import thMessages from '@/localization/th.json';

// DevExtreme license key (base64 encoded) - supports up to v25.2.x
const LICENSE_KEY = "ewogICJmb3JtYXQiOiAxLAogICJjdXN0b21lcklkIjogIjkyMjY4ODllLTg0ZjUtNDViYS1iZDBhLTk2YWFjNzM1N2ZkMiIsCiAgIm1heFZlcnNpb25BbGxvd2VkIjogMjUyCn0=.rRYplWY3hBop1otsFZsOm/7mi4iDCnPKrC7rJ7r2e+lLr/RuKzqLkc+3xhWrP5smjcHi3lI4O4yDU3sMV6SOcega3W9KyAxyhjoNoR21SKeHBFLlnqoggxavKrRe1nUUijipaQ==";


interface DevExtremeProviderProps {
  children: React.ReactNode;
}

export function DevExtremeProvider({ children }: DevExtremeProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    // Set DevExtreme license key
    config({ licenseKey: LICENSE_KEY });

    // Load Thai messages for UI strings
    loadMessages(thMessages);

    // Set locale to Thai
    locale('th');

    // Log to verify initialization
    console.log('[DevExtreme] Initialized with Thai locale and Buddhist Era formatters');
  }, []);

  return <>{children}</>;
}
