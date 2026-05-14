'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function OrgChartRedirect() {
  const router = useRouter();
  const t = useTranslations('hr');
  useEffect(() => {
    router.replace('/hr/org');
  }, [router]);
  return <div className="p-8 text-center">{t('orgRedirect.redirecting')}</div>;
}
