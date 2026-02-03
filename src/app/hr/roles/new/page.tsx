'use client';

// Create New Role Page
// Feature: 007-hr-personnel-management

import { useTranslations } from 'next-intl';
import { RoleForm } from '@/components/hr/role-form';

export default function NewRolePage() {
  const t = useTranslations('hr');
  return <div data-title={t('roles.actions.addRole')}><RoleForm mode="create" /></div>;
}
