'use client';

// Edit Role Page
// Feature: 007-hr-personnel-management

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { RoleForm } from '@/components/hr/role-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditRolePage({ params }: PageProps) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const roleId = parseInt(id, 10);

  if (isNaN(roleId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{t('roles.invalidId')}</p>
      </div>
    );
  }

  return <div data-title={t('roles.actions.viewRole')}><RoleForm mode="edit" roleId={roleId} /></div>;
}
