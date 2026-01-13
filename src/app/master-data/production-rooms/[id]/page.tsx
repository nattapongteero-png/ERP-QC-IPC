'use client';

import { use } from 'react';
import { ProductionRoomForm } from '@/components/master-data';

export default function ProductionRoomEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductionRoomForm mode="edit" id={Number(id)} />;
}
