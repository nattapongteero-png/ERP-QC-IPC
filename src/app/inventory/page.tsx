'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/inventory/items');
  }, [router]);

  return null;
}
