'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function OrgRedirectPage() {
  const t = useTranslations('hr');
  const router = useRouter();

  useEffect(() => {
    router.replace('/hr/org-chart');
  }, [router]);

  return <div>{t('page.title')}</div>;
}
