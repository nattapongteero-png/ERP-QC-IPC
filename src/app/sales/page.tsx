'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SalesPage() {
  const router = useRouter();
  const t = useTranslations('sales');

  useEffect(() => {
    // Redirect to orders page
    router.replace('/sales/orders');
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">{t('common.loading')}</p>
    </div>
  );
}
