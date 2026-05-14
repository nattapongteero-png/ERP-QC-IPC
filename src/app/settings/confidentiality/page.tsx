/**
 * Confidentiality Settings Page
 * Feature: 014-unit-cost - BOM Confidentiality Protection
 *
 * Allows admins to configure which roles can bypass confidentiality restrictions.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { PageHeader } from '@/components/ui/page-header';
import { Shield, Lock, AlertTriangle, Check, Info } from 'lucide-react';
import Link from 'next/link';
import notify from 'devextreme/ui/notify';

// Available roles in the system
const AVAILABLE_ROLES = [
  'ADMIN', 'MANAGER', 'SUPERVISOR', 'OPERATOR', 'QA', 'RND',
  'PRODUCTION', 'WAREHOUSE', 'PURCHASING', 'SALES', 'ACCOUNTING', 'USER',
] as const;

// API functions
async function fetchBypassRoles(): Promise<{ roles: string[] }> {
  const response = await fetch('/api/admin/settings/confidential-bypass-roles');
  if (!response.ok) throw new Error('Failed to fetch bypass roles');
  const data = await response.json();
  return data.data || { roles: ['ADMIN'] };
}

async function saveBypassRoles(roles: string[]): Promise<void> {
  const response = await fetch('/api/admin/settings/confidential-bypass-roles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles }),
  });
  if (!response.ok) throw new Error('Failed to save bypass roles');
}

export default function ConfidentialitySettingsPage() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['ADMIN']);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current bypass roles
  const { data, isLoading, error } = useQuery({
    queryKey: ['confidential-bypass-roles'],
    queryFn: fetchBypassRoles,
  });

  // Update selected roles when data loads
  useEffect(() => {
    if (data?.roles) {
      setSelectedRoles(data.roles);
    }
  }, [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: saveBypassRoles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-bypass-roles'] });
      setHasChanges(false);
      notify(t('confidentiality.saveSuccess'), 'success', 3000);
    },
    onError: () => {
      notify(t('confidentiality.saveError'), 'error', 3000);
    },
  });

  // Handle role toggle
  const handleRoleToggle = (role: string, checked: boolean) => {
    // Prevent removing ADMIN role (always required)
    if (role === 'ADMIN' && !checked) {
      notify(t('confidentiality.adminCannotRemove'), 'warning', 3000);
      return;
    }

    setSelectedRoles((prev) => {
      const newRoles = checked
        ? [...prev, role]
        : prev.filter((r) => r !== role);
      setHasChanges(true);
      return newRoles;
    });
  };

  // Handle save
  const handleSave = () => {
    saveMutation.mutate(selectedRoles);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <DxLoadIndicator visible height={40} width={40} />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <p className="text-red-600">{t('confidentiality.loadError')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={t('confidentiality.title')}
          description={t('confidentiality.description')}
          actions={
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <DxButton text={t('confidentiality.back')} icon="back" type="normal" />
              </Link>
              <DxButton
                text={saveMutation.isPending ? t('settingsPage.saving') : t('confidentiality.saveChanges')}
                icon="save"
                type="success"
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
              />
            </div>
          }
        />

        {/* Info Banner */}
        <Card elevation="flat" className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">{t('confidentiality.aboutTitle')}</p>
                <p>
                  {t('confidentiality.aboutDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bypass Roles Configuration */}
        <Card elevation="raised">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle>{t('confidentiality.bypassRoles')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {t('confidentiality.selectRolesDescription')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_ROLES.map((roleValue) => (
                <div
                  key={roleValue}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    selectedRoles.includes(roleValue)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`role-item-${roleValue}`}
                >
                  <DxCheckBox
                    value={selectedRoles.includes(roleValue)}
                    onValueChange={(checked) => handleRoleToggle(roleValue, checked)}
                    disabled={roleValue === 'ADMIN'} // ADMIN is always required
                    data-testid={`role-checkbox-${roleValue}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{t(`confidentiality.roleLabels.${roleValue}`)}</span>
                      {roleValue === 'ADMIN' && (
                        <span title={t('confidentiality.required')}>
                          <Lock className="h-3.5 w-3.5 text-gray-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{t(`confidentiality.roleDescriptions.${roleValue}`)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-gray-600">
                  <strong>{selectedRoles.length}</strong> {selectedRoles.length !== 1 ? t('confidentiality.roles') : t('confidentiality.role')} {t('confidentiality.rolesCanBypass')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Control Groups Link */}
        <Card elevation="raised">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              <CardTitle>{t('confidentiality.accessGroups')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {t('confidentiality.accessGroupsDescription')}
            </p>
            <Link href="/admin/confidential-groups">
              <DxButton
                text={t('confidentiality.manageGroups')}
                icon="group"
                type="default"
              />
            </Link>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
