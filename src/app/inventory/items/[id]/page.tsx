'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { ItemEditForm, type Item, type ItemFormData } from '@/components/ui/item-edit-form';
import { AlertTriangle } from 'lucide-react';

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const t = useTranslations('inventory');
  const isNew = params.id === 'new';

  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      fetchItem();
    }
  }, [params.id, isNew]);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setItem(data.data);
      } else {
        setError(data.error || 'Failed to load item');
      }
    } catch (err) {
      setError('Failed to load item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (formData: ItemFormData) => {
    setIsSaving(true);
    setError(null);

    try {
      const url = isNew ? '/api/items' : `/api/items/${params.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        // Invalidate the items list cache so it refreshes when we navigate back
        await queryClient.invalidateQueries({ queryKey: ['items-list'] });
        router.push('/inventory/items');
      } else {
        setError(data.error || 'Failed to save item');
      }
    } catch (err) {
      setError('Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('items.confirmDelete'))) return;

    try {
      const res = await fetch(`/api/items/${params.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        // Invalidate the items list cache so it refreshes when we navigate back
        await queryClient.invalidateQueries({ queryKey: ['items-list'] });
        router.push('/inventory/items');
      } else {
        setError(data.error || 'Failed to delete item');
      }
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col -m-4 md:-m-6">
        {error && (
          <div className="mx-8 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}

        <ItemEditForm
          item={item}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={!isNew ? handleDelete : undefined}
          isSaving={isSaving}
          showHeader={true}
          showDelete={!isNew}
          className="flex-1"
        />
      </div>
    </MainLayout>
  );
}
