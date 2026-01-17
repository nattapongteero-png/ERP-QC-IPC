/**
 * Confidentiality Settings Page
 * Feature: 014-unit-cost - BOM Confidentiality Protection
 *
 * Allows admins to configure which roles can bypass confidentiality restrictions.
 */

'use client';

import { useState, useEffect } from 'react';
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
  { value: 'ADMIN', label: 'Administrator', description: 'Full system access' },
  { value: 'MANAGER', label: 'Manager', description: 'Department management' },
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'Team supervision' },
  { value: 'OPERATOR', label: 'Operator', description: 'Daily operations' },
  { value: 'QA', label: 'Quality Assurance', description: 'Quality control' },
  { value: 'RND', label: 'R&D', description: 'Research and development' },
  { value: 'PRODUCTION', label: 'Production', description: 'Manufacturing' },
  { value: 'WAREHOUSE', label: 'Warehouse', description: 'Inventory management' },
  { value: 'PURCHASING', label: 'Purchasing', description: 'Procurement' },
  { value: 'SALES', label: 'Sales', description: 'Sales operations' },
  { value: 'ACCOUNTING', label: 'Accounting', description: 'Financial operations' },
  { value: 'USER', label: 'User', description: 'Basic user' },
];

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
      notify('Bypass roles saved successfully', 'success', 3000);
    },
    onError: () => {
      notify('Failed to save bypass roles', 'error', 3000);
    },
  });

  // Handle role toggle
  const handleRoleToggle = (role: string, checked: boolean) => {
    // Prevent removing ADMIN role (always required)
    if (role === 'ADMIN' && !checked) {
      notify('Administrator role cannot be removed from bypass roles', 'warning', 3000);
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
          <p className="text-red-600">Failed to load settings</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Confidentiality Settings"
          description="Configure BOM confidentiality bypass roles"
          actions={
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <DxButton text="Back" icon="back" type="normal" />
              </Link>
              <DxButton
                text={saveMutation.isPending ? 'Saving...' : 'Save Changes'}
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
                <p className="font-medium mb-1">About Confidentiality Bypass Roles</p>
                <p>
                  Users with bypass roles can view all confidential BOM items regardless of access grants.
                  This is useful for administrators and senior management who need full visibility.
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
              <CardTitle>Bypass Roles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Select which roles should have automatic access to all confidential BOM items.
              The Administrator role is always included and cannot be removed.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_ROLES.map((role) => (
                <div
                  key={role.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    selectedRoles.includes(role.value)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`role-item-${role.value}`}
                >
                  <DxCheckBox
                    value={selectedRoles.includes(role.value)}
                    onValueChange={(checked) => handleRoleToggle(role.value, checked)}
                    disabled={role.value === 'ADMIN'} // ADMIN is always required
                    data-testid={`role-checkbox-${role.value}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{role.label}</span>
                      {role.value === 'ADMIN' && (
                        <span title="Required">
                          <Lock className="h-3.5 w-3.5 text-gray-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-gray-600">
                  <strong>{selectedRoles.length}</strong> role{selectedRoles.length !== 1 ? 's' : ''} can bypass confidentiality
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
              <CardTitle>Access Control Groups</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Manage confidential access groups to grant specific users access to confidential BOM items
              without giving them bypass roles.
            </p>
            <Link href="/admin/confidential-groups">
              <DxButton
                text="Manage Access Groups"
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
