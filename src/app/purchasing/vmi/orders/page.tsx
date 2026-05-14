'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasingVmiOrdersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/sales/vmi-orders');
  }, [router]);
  return <div className="p-8 text-center">Redirecting to VMI Orders...</div>;
}
