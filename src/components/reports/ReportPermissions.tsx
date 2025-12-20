'use client';

import { useState, useCallback } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import {
  Shield,
  Users,
  Eye,
  Download,
  Edit,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

export interface ReportPermission {
  id: number;
  templateId: number;
  role: string;
  canView: boolean;
  canDesign: boolean;
  canExport: boolean;
  createdAt: string;
}

// Standard roles for the system
const AVAILABLE_ROLES = [
  { id: 'admin', name: 'Admin', description: 'Full access to all reports' },
  { id: 'manager', name: 'Manager', description: 'View and export reports' },
  { id: 'user', name: 'User', description: 'View reports only' },
  { id: 'designer', name: 'Report Designer', description: 'Design and modify reports' },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access' },
];

export interface ReportPermissionsProps {
  templateCode: string;
  permissions: ReportPermission[];
  isLoading?: boolean;
  onAddPermission?: (permission: { role: string; canView: boolean; canDesign: boolean; canExport: boolean }) => Promise<void>;
  onUpdatePermission?: (id: number, permission: Partial<ReportPermission>) => Promise<void>;
  onDeletePermission?: (id: number) => Promise<void>;
  onRefresh?: () => void;
  className?: string;
}

export function ReportPermissions({
  templateCode,
  permissions,
  isLoading = false,
  onAddPermission,
  onUpdatePermission,
  onDeletePermission,
  onRefresh,
  className = '',
}: ReportPermissionsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingPermission, setAddingPermission] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [formPermissions, setFormPermissions] = useState({
    canView: true,
    canDesign: false,
    canExport: true,
  });

  const resetForm = useCallback(() => {
    setSelectedRole('');
    setFormPermissions({
      canView: true,
      canDesign: false,
      canExport: true,
    });
    setShowAddForm(false);
    setError(null);
  }, []);

  const handleAddPermission = useCallback(async () => {
    if (!onAddPermission) return;

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    // Check if role already has permission
    if (permissions.some(p => p.role === selectedRole)) {
      setError('This role already has permissions configured');
      return;
    }

    setAddingPermission(true);
    setError(null);

    try {
      await onAddPermission({
        role: selectedRole,
        ...formPermissions,
      });
      resetForm();
      onRefresh?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add permission';
      setError(errorMessage);
    } finally {
      setAddingPermission(false);
    }
  }, [selectedRole, formPermissions, permissions, onAddPermission, resetForm, onRefresh]);

  const handleDeletePermission = useCallback(async (id: number) => {
    if (!onDeletePermission) return;

    const confirmed = window.confirm('Are you sure you want to remove this permission?');
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await onDeletePermission(id);
      onRefresh?.();
    } catch (err) {
      console.error('Delete permission error:', err);
    } finally {
      setDeletingId(null);
    }
  }, [onDeletePermission, onRefresh]);

  const handleTogglePermission = useCallback(async (
    id: number,
    field: 'canView' | 'canDesign' | 'canExport',
    currentValue: boolean
  ) => {
    if (!onUpdatePermission) return;

    try {
      await onUpdatePermission(id, { [field]: !currentValue });
      onRefresh?.();
    } catch (err) {
      console.error('Update permission error:', err);
    }
  }, [onUpdatePermission, onRefresh]);

  const getRoleDisplayName = (role: string): string => {
    const found = AVAILABLE_ROLES.find(r => r.id === role);
    return found?.name || role;
  };

  // Filter out roles that already have permissions
  const availableRolesToAdd = AVAILABLE_ROLES.filter(
    role => !permissions.some(p => p.role === role.id)
  );

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">Permissions</h3>
        </div>
        {onAddPermission && !showAddForm && availableRolesToAdd.length > 0 && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Permission
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Add Role Permission</h4>

          {/* Error */}
          {error && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-3">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a role...</option>
              {availableRolesToAdd.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </option>
              ))}
            </select>
          </div>

          {/* Permission Toggles */}
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formPermissions.canView}
                onChange={(e) => setFormPermissions(prev => ({ ...prev, canView: e.target.checked }))}
                className="text-blue-600 rounded"
              />
              <Eye className="h-4 w-4 text-gray-500" />
              View
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formPermissions.canExport}
                onChange={(e) => setFormPermissions(prev => ({ ...prev, canExport: e.target.checked }))}
                className="text-blue-600 rounded"
              />
              <Download className="h-4 w-4 text-gray-500" />
              Export
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formPermissions.canDesign}
                onChange={(e) => setFormPermissions(prev => ({ ...prev, canDesign: e.target.checked }))}
                className="text-blue-600 rounded"
              />
              <Edit className="h-4 w-4 text-gray-500" />
              Design
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2">
            <DxButton
              text={addingPermission ? 'Adding...' : 'Add'}
              type="default"
              onClick={handleAddPermission}
              disabled={addingPermission}
            />
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={resetForm}
              disabled={addingPermission}
            />
          </div>
        </div>
      )}

      {/* Permissions List */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No permissions configured
            <p className="text-xs mt-1">All users can access this report by default</p>
          </div>
        ) : (
          <div className="space-y-3">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {getRoleDisplayName(permission.role)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Role: {permission.role}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Permission Badges */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePermission(permission.id, 'canView', permission.canView)}
                      className={`p-1.5 rounded ${permission.canView ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                      title={permission.canView ? 'Can view' : 'Cannot view'}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleTogglePermission(permission.id, 'canExport', permission.canExport)}
                      className={`p-1.5 rounded ${permission.canExport ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                      title={permission.canExport ? 'Can export' : 'Cannot export'}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleTogglePermission(permission.id, 'canDesign', permission.canDesign)}
                      className={`p-1.5 rounded ${permission.canDesign ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                      title={permission.canDesign ? 'Can design' : 'Cannot design'}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Delete Button */}
                  {onDeletePermission && (
                    <button
                      onClick={() => handleDeletePermission(permission.id)}
                      disabled={deletingId === permission.id}
                      className="p-1.5 hover:bg-red-100 rounded text-red-500"
                      title="Remove permission"
                    >
                      {deletingId === permission.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportPermissions;
