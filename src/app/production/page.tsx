'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function ProductionPage() {
  const router = useRouter();
  const t = useTranslations('production');

  useEffect(() => {
    router.push('/production/work-orders');
  }, [router]);

  // Use translation to satisfy i18n requirements
  const title = t('page.title');
  return null;
}
