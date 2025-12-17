'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/production/work-orders');
  }, [router]);

  return null;
}
