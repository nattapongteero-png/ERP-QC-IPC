'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function PurchasingPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');

  useEffect(() => {
    // Redirect to orders page
    router.replace('/purchasing/orders');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">{t('loading')}</p>
    </div>
  );
}
