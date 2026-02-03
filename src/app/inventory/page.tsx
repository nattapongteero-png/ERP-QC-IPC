'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function InventoryPage() {
  const router = useRouter();
  const t = useTranslations('inventory');

  useEffect(() => {
    router.push('/inventory/items');
  }, [router]);

  // Loading text while redirecting
  return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
}
