"use client";

import { useEffect, useRef } from 'react';
import { locale, loadMessages } from "devextreme/localization";
import config from 'devextreme/core/config';

// Thai translations
import thMessages from '@/localization/th.json';

// DevExtreme license key (base64 encoded)
const LICENSE_KEY = "ewogICJmb3JtYXQiOiAxLAogICJjdXN0b21lcklkIjogIjkyMjY4ODllLTg0ZjUtNDViYS1iZDBhLTk2YWFjNzM1N2ZkMiIsCiAgIm1heFZlcnNpb25BbGxvd2VkIjogMjQxCn0=.B56odZPzNL+xQDyTdVRCztW0Utxw9hADVBHRxiRYEOAHUvIYMHRervj0n9fJKv9AtgJ7RjCHD7H/ykFRy+q26FU2WvAY6bO+rJutWd1mFUWBOMPtXfoyTZUSx5Ye8tTYCQWCzg==";

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

    // Set locale to Thai (Intl API will handle date/number formatting)
    locale('th');
  }, []);

  return <>{children}</>;
}
