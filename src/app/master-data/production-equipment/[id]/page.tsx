'use client';

import { use } from 'react';
import { ProductionEquipmentForm } from '@/components/master-data';

export default function ProductionEquipmentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductionEquipmentForm mode="edit" id={Number(id)} />;
}
