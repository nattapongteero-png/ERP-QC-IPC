'use client';

// HR New Employee Page
// Feature: 007-hr-personnel-management

import { useTranslations } from 'next-intl';
import { EmployeeForm } from '@/components/hr';

export default function NewEmployeePage() {
  const t = useTranslations('hr');
  return <div data-title={t('employees.actions.addEmployee')}><EmployeeForm mode="create" /></div>;
}
