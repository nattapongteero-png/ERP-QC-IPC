'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrgChartRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/hr/org');
  }, [router]);
  return <div className="p-8 text-center">Redirecting...</div>;
}
