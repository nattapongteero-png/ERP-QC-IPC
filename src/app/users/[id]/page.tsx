'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Shield,
  Building2,
  Calendar,
  Clock,
  Key,
  Trash2,
  Save,
  ArrowLeft,
  UserCheck,
  UserX,
  Edit3,
  X,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UserData {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  name: string;
  email: string;
  role: string;
  department: string;
}

interface PasswordForm {
  newPassword: string;
  confirmPassword: string;
}

// HR Role loaded from /api/hr/roles — source of truth for role dropdown
interface HRRole {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isSystemRole?: boolean;
  isActive?: boolean;
  permissionCount?: number;
}

// Org Unit loaded from /api/hr/org-units — source of truth for department
interface OrgUnit {
  id: number;
  name: string;
  code?: string;
}

const getRoleConfig = (role: string): {
  variant: 'success' | 'info' | 'warning' | 'danger' | 'default';
  icon: React.ReactNode;
  bgColor: string;
} => {
  switch (role) {
    case 'admin':
      return { variant: 'danger', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-red-100' };
    case 'manager':
      return { variant: 'warning', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-orange-100' };
    case 'production':
      return { variant: 'success', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-green-100' };
    case 'qc':
      return { variant: 'success', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-emerald-100' };
    case 'warehouse':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-blue-100' };
    case 'purchasing':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-cyan-100' };
    case 'sales':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-indigo-100' };
    case 'accounting':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-violet-100' };
    case 'hr':
      return { variant: 'info', icon: <User className="h-4 w-4" />, bgColor: 'bg-pink-100' };
    default:
      return { variant: 'default', icon: <User className="h-4 w-4" />, bgColor: 'bg-gray-100' };
  }
};

// Legacy fallback labels for role codes predating the HR Roles system.
// When an existing user has role="admin"/"manager"/etc (hard-coded in the old
// flow), we show a human-readable Thai label so the UI doesn't display raw
// code. Any role coming from HR Roles uses its `name` field instead.
const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  manager: 'ผู้จัดการ',
  production: 'ฝ่ายผลิต',
  qc: 'ฝ่าย QC',
  warehouse: 'ฝ่ายคลัง',
  purchasing: 'ฝ่ายจัดซื้อ',
  sales: 'ฝ่ายขาย',
  accounting: 'ฝ่ายบัญชี',
  hr: 'ฝ่ายบุคคล',
  user: 'ผู้ใช้ทั่วไป',
};

const formatRole = (role: string, hrRoles: HRRole[] = []): string => {
  // 1. Try to find in HR Roles (source of truth)
  const hrMatch = hrRoles.find(r => r.code === role);
  if (hrMatch) return hrMatch.name || hrMatch.code;
  // 2. Fall back to legacy label
  if (LEGACY_ROLE_LABELS[role]) return LEGACY_ROLE_LABELS[role];
  // 3. Return raw code
  return role;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('users');
  const userId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // HR Roles and Org Units — fetched from /api/hr/roles and /api/hr/org-units
  // so the dropdowns reflect real data managed in the HR module.
  const [hrRoles, setHrRoles] = useState<HRRole[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    email: '',
    role: '',
    department: '',
  });

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();

      if (data.success) {
        setUser(data.data);
        setEditForm({
          name: data.data.name || '',
          email: data.data.email || '',
          role: data.data.role || 'user',
          department: data.data.department || '',
        });
      } else {
        setError(data.error || t('detail.toast.notFound'));
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError(t('detail.toast.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  // Fetch HR Roles and Org Units for dropdowns — matches /users/new flow so
  // the role list stays in sync with what HR admins configure in /hr/roles.
  useEffect(() => {
    const fetchLookupData = async () => {
      try {
        setIsLoadingOptions(true);
        const [rolesRes, orgUnitsRes] = await Promise.all([
          fetch('/api/hr/roles'),
          fetch('/api/hr/org-units'),
        ]);
        const rolesData = await rolesRes.json();
        const orgUnitsData = await orgUnitsRes.json();

        if (rolesData.success && Array.isArray(rolesData.data)) {
          setHrRoles(rolesData.data);
        }
        if (orgUnitsData.success && Array.isArray(orgUnitsData.data)) {
          setOrgUnits(orgUnitsData.data);
        }
      } catch (err) {
        console.error('Failed to fetch HR lookup data:', err);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchLookupData();
  }, []);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(t('detail.toast.saveSuccess'));
        setIsEditing(false);
        fetchUser();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || t('detail.toast.saveError'));
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      setError(t('detail.toast.saveException'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t('detail.password.minError'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('detail.password.mismatchError'));
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordForm.newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(t('detail.password.changeSuccess'));
        setShowPasswordSection(false);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setPasswordError(data.error || t('detail.password.changeError'));
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setPasswordError(t('detail.password.changeException'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(user.isActive ? t('detail.toast.deactivateSuccess') : t('detail.toast.activateSuccess'));
        fetchUser();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || t('detail.toast.statusError'));
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError(t('detail.toast.statusException'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        router.push('/users');
      } else {
        setError(data.error || t('detail.toast.deleteError'));
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(t('detail.toast.deleteException'));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'user',
        department: user.department || '',
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-gray-400" />
          <p className="text-gray-500">{error || t('detail.toast.notFound')}</p>
          <DxButton
            text={t('detail.backToList')}
            icon="back"
            type="default"
            onClick={() => router.push('/users')}
          />
        </div>
      </MainLayout>
    );
  }

  const roleConfig = getRoleConfig(user.role);

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <DxButton
              icon="back"
              type="normal"
              stylingMode="outlined"
              hint={t('detail.backHint')}
              data-testid="user-detail-back-btn"
              onClick={() => router.push('/users')}
            />
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getAvatarColor(user.name)}`}>
                {getInitials(user.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={user.isActive ? 'success' : 'danger'} dot>
                    {user.isActive ? t('detail.statusActive') : t('detail.statusInactive')}
                  </Badge>
                  <Badge variant={roleConfig.variant}>
                    {formatRole(user.role)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <DxButton
                text={t('detail.edit')}
                icon="edit"
                type="default"
                data-testid="user-detail-edit-btn"
                onClick={() => setIsEditing(true)}
              />
            ) : (
              <>
                <DxButton
                  text={t('detail.cancel')}
                  icon="close"
                  type="normal"
                  stylingMode="outlined"
                  data-testid="user-detail-cancel-btn"
                  onClick={handleCancelEdit}
                />
                <DxButton
                  text={t('detail.save')}
                  icon="save"
                  type="success"
                  data-testid="user-detail-save-btn"
                  onClick={handleSave}
                  disabled={isSaving}
                />
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info - Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-400" />
                  {t('detail.userInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t('detail.nameLabel')}
                    </label>
                    {isEditing ? (
                      <DxTextBox
                        value={editForm.name}
                        onValueChange={(value) => setEditForm({ ...editForm, name: value })}
                        placeholder={t('detail.namePlaceholder')}
                        data-testid="user-edit-name-input"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{user.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('detail.emailLabel')}
                    </label>
                    {isEditing ? (
                      <DxTextBox
                        value={editForm.email}
                        onValueChange={(value) => setEditForm({ ...editForm, email: value })}
                        placeholder={t('detail.emailPlaceholder')}
                        mode="email"
                        data-testid="user-edit-email-input"
                      />
                    ) : (
                      <p className="text-gray-900">{user.email}</p>
                    )}
                  </div>

                  {/* Role — dropdown is populated from /api/hr/roles
                       (HR Roles module). Legacy roles (admin, manager, etc.)
                       are included as a fallback group so existing users
                       can still be represented while their codes get migrated
                       to proper HR Roles. */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('detail.roleLabel')}
                      {isEditing && (
                        <a
                          href="/hr/roles"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-blue-600 hover:text-blue-800 hover:underline font-normal"
                        >
                          {t('detail.manageRoles')}
                        </a>
                      )}
                    </label>
                    {isEditing ? (
                      <>
                        <DxSelectBox
                          items={[
                            // HR Roles group (live data)
                            ...hrRoles.map((r) => ({
                              value: r.code,
                              label: `${r.name || r.code} (${r.code})`,
                              group: 'HR Roles',
                            })),
                            // Legacy roles fallback — only show those not already
                            // defined in HR Roles (avoid duplicate codes)
                            ...Object.entries(LEGACY_ROLE_LABELS)
                              .filter(([code]) => !hrRoles.some((r) => r.code === code))
                              .map(([code, label]) => ({
                                value: code,
                                label: `${label} (${code}) · legacy`,
                                group: 'Legacy',
                              })),
                          ]}
                          value={editForm.role}
                          onValueChange={(value) => setEditForm({ ...editForm, role: value as string })}
                          valueExpr="value"
                          displayExpr="label"
                          searchEnabled
                          disabled={isLoadingOptions}
                          data-testid="user-edit-role-select"
                        />
                        {isLoadingOptions && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> {t('detail.loadingRoles')}
                          </p>
                        )}
                        {/* Show description of currently selected HR role, if any */}
                        {(() => {
                          const selected = hrRoles.find((r) => r.code === editForm.role);
                          if (selected) {
                            return (
                              <div className="mt-1 text-xs text-gray-500 bg-blue-50 border-l-2 border-blue-300 px-2 py-1 rounded">
                                <Shield className="h-3 w-3 inline mr-1 text-blue-600" />
                                {selected.description || t('detail.roleFromHr')}
                                {typeof selected.permissionCount === 'number' && (
                                  <span className="ml-2 text-blue-700 font-semibold">
                                    · {t('detail.permissionsCount', { count: selected.permissionCount })}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          if (editForm.role && LEGACY_ROLE_LABELS[editForm.role]) {
                            return (
                              <div className="mt-1 text-xs text-amber-700 bg-amber-50 border-l-2 border-amber-300 px-2 py-1 rounded">
                                ⚠️ {t('detail.legacyRoleWarning')}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${roleConfig.bgColor}`}>
                          {roleConfig.icon}
                        </div>
                        <span className="text-gray-900">{formatRole(user.role, hrRoles)}</span>
                        {hrRoles.some((r) => r.code === user.role) && (
                          <Badge variant="info">HR Role</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Department — populated from /api/hr/org-units */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {t('detail.departmentLabel')}
                    </label>
                    {isEditing ? (
                      <DxSelectBox
                        items={[
                          { value: '', label: t('detail.departmentNone') },
                          ...orgUnits.map((u) => ({ value: u.name, label: u.name })),
                        ]}
                        value={editForm.department}
                        onValueChange={(value) => setEditForm({ ...editForm, department: value as string })}
                        valueExpr="value"
                        displayExpr="label"
                        searchEnabled
                        disabled={isLoadingOptions}
                        data-testid="user-edit-department-select"
                      />
                    ) : (
                      <p className="text-gray-900">{user.department || '-'}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password Change Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-gray-400" />
                    {t('detail.changePassword')}
                  </CardTitle>
                  {!showPasswordSection && (
              <DxButton
                  text={t('detail.changePassword')}
                  icon="key"
                  type="normal"
                  stylingMode="outlined"
                  data-testid="user-detail-change-password-btn"
                  onClick={() => setShowPasswordSection(true)}
                />
                  )}
                </div>
              </CardHeader>
              {showPasswordSection && (
                <CardContent>
                  <div className="space-y-4">
                    {passwordError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {passwordError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500">{t('detail.password.newLabel')}</label>
                        <div className="relative">
                          <DxTextBox
                            value={passwordForm.newPassword}
                            onValueChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
                            placeholder={t('detail.password.newPlaceholder')}
                            mode={showPassword ? 'text' : 'password'}
                            data-testid="user-detail-new-password-input"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500">{t('detail.password.confirmLabel')}</label>
                        <DxTextBox
                          value={passwordForm.confirmPassword}
                          onValueChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
                          placeholder={t('detail.password.confirmPlaceholder')}
                          mode={showPassword ? 'text' : 'password'}
                          data-testid="user-detail-confirm-password-input"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <DxButton
                        text={t('detail.cancel')}
                        type="normal"
                        stylingMode="outlined"
                        data-testid="user-detail-password-cancel-btn"
                        onClick={() => {
                          setShowPasswordSection(false);
                          setPasswordForm({ newPassword: '', confirmPassword: '' });
                          setPasswordError(null);
                        }}
                      />
                      <DxButton
                        text={t('detail.changePassword')}
                        type="success"
                        icon="save"
                        data-testid="user-detail-password-save-btn"
                        onClick={handlePasswordChange}
                        disabled={isSaving || !passwordForm.newPassword}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {user.isActive ? (
                    <UserCheck className="h-5 w-5 text-green-500" />
                  ) : (
                    <UserX className="h-5 w-5 text-red-500" />
                  )}
                  {t('detail.statusCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant={user.isActive ? 'success' : 'danger'} dot className="text-base">
                      {user.isActive ? t('detail.statusActiveNow') : t('detail.statusInactive')}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-2">
                      {user.isActive
                        ? t('detail.canLogin')
                        : t('detail.cannotLogin')}
                    </p>
                  </div>
                  <DxButton
                    text={user.isActive ? t('detail.deactivate') : t('detail.activate')}
                    type={user.isActive ? 'danger' : 'success'}
                    stylingMode="outlined"
                    data-testid="user-detail-toggle-status-btn"
                    onClick={handleToggleStatus}
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Timestamps Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  {t('detail.systemInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('detail.createdAt')}</p>
                    <p className="text-gray-900">{formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Edit3 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('detail.updatedAt')}</p>
                    <p className="text-gray-900">{formatDate(user.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('detail.userId')}</p>
                    <p className="text-gray-900 font-mono">#{user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  {t('detail.dangerZone')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  {t('detail.deleteNote')}
                </p>
                <DxButton
                  text={t('detail.deleteUser')}
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  data-testid="user-detail-delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  width="100%"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      <DxPopup
        visible={showDeleteConfirm}
        onHiding={() => setShowDeleteConfirm(false)}
        title={t('detail.deletePopup.title')}
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{t('detail.deletePopup.confirmName', { name: user.name })}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <p className="text-gray-600 mb-6">
            {t('detail.deletePopup.message')}
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text={t('detail.cancel')}
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <DxButton
              text={t('detail.deleteUser')}
              type="danger"
              icon="trash"
              onClick={handleDelete}
              disabled={isDeleting}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}
