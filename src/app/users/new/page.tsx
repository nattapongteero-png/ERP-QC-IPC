'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { PageHeader } from '@/components/ui/page-header';
import {
  User,
  Mail,
  Shield,
  Building2,
  Key,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

interface OrgUnit {
  id: number;
  name: string;
  nameTh?: string;
  type: string;
  isActive: boolean;
}

interface AppRole {
  id: number;
  code: string;
  name: string;
  nameTh?: string;
  description?: string;
  isActive: boolean;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  department: string;
}

// Password strength buckets. Score is number of rules passed (0-5).
// Labels are resolved via i18n at render time; we only key them here.
function scorePassword(pw: string): { score: number; rules: { key: string; ok: boolean }[] } {
  const rules = [
    { key: 'len', ok: pw.length >= 6 },
    { key: 'len8', ok: pw.length >= 8 },
    { key: 'lower', ok: /[a-z]/.test(pw) },
    { key: 'upper', ok: /[A-Z]/.test(pw) },
    { key: 'num', ok: /[0-9]/.test(pw) },
  ];
  return { score: rules.filter((r) => r.ok).length, rules };
}

function generateStrongPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function NewUserPage() {
  const router = useRouter();
  const t = useTranslations('users');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
  });

  const [roles, setRoles] = useState<AppRole[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

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

        if (rolesData.success && rolesData.data) {
          setRoles(rolesData.data);
          setFormData((prev) => ({ ...prev, role: rolesData.data[0]?.code || '' }));
        }

        if (orgUnitsData.success && orgUnitsData.data) {
          setDepartments(orgUnitsData.data);
        }
      } catch (err) {
        console.error('Failed to fetch lookup data:', err);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchLookupData();
  }, []);

  // Role picker source — shows bilingual label so Thai-only and English-only
  // roles both display cleanly.
  const roleItems = useMemo(
    () =>
      roles
        .filter((r) => r.isActive)
        .map((r) => {
          const th = (r.nameTh || '').trim();
          const en = (r.name || '').trim();
          const both = th && en && th !== en ? `${th} / ${en}` : th || en || r.code;
          return { value: r.code, label: `${r.code} — ${both}`, description: r.description || '' };
        }),
    [roles],
  );

  // users.department is stored as the org-unit name (matches the legacy Edit
  // page and most existing rows). Keep the value = name for round-trip
  // compatibility — id-based value silently lost the selection on reopen.
  const departmentItems = useMemo(
    () =>
      departments.map((d) => {
        const th = (d.nameTh || '').trim();
        const en = (d.name || '').trim();
        const both = th && en && th !== en ? `${th} / ${en}` : th || en;
        return { value: d.name, label: both };
      }),
    [departments],
  );

  const selectedRole = roles.find((r) => r.code === formData.role);

  // Inline validation state — updated on change, used for UI hints + submit guard
  const emailValid = !formData.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const passwordStrength = scorePassword(formData.password);
  const passwordsMatch = formData.confirmPassword === '' ? null : formData.password === formData.confirmPassword;

  const canSubmit =
    formData.name.trim() &&
    formData.email.trim() &&
    emailValid &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword &&
    !isSubmitting;

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return t('form.validation.nameRequired');
    if (!formData.email.trim()) return t('form.validation.emailRequired');
    if (!emailValid) return t('form.validation.emailInvalid');
    if (!formData.password) return t('form.validation.passwordRequired');
    if (formData.password.length < 6) return t('form.validation.passwordMin');
    if (formData.password !== formData.confirmPassword) return t('form.validation.passwordMismatch');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          department: formData.department || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(t('form.toast.createSuccess'));
        setTimeout(() => router.push('/users'), 1500);
      } else {
        setError(data.error || t('form.toast.createError'));
      }
    } catch (err) {
      console.error('Failed to create user:', err);
      setError(t('form.toast.createException'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePassword = () => {
    const pw = generateStrongPassword();
    setFormData((prev) => ({ ...prev, password: pw, confirmPassword: pw }));
    setShowPassword(true);
  };

  const strengthLabel = (() => {
    if (formData.password.length === 0) return '';
    if (passwordStrength.score <= 2) return t('form.strength.weak');
    if (passwordStrength.score === 3) return t('form.strength.fair');
    if (passwordStrength.score === 4) return t('form.strength.good');
    return t('form.strength.strong');
  })();
  const strengthColor = (() => {
    if (passwordStrength.score <= 2) return 'bg-red-500';
    if (passwordStrength.score === 3) return 'bg-amber-500';
    if (passwordStrength.score === 4) return 'bg-blue-500';
    return 'bg-green-500';
  })();

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-3xl mx-auto">
        <PageHeader title={t('form.createTitle')} description={t('form.createDescription')} />

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section 1: Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-blue-500" />
                {t('form.sectionIdentity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.nameLabel')} <span className="text-red-500">*</span>
                  </label>
                  <DxTextBox
                    value={formData.name}
                    onValueChange={(value) => setFormData({ ...formData, name: value })}
                    placeholder={t('form.namePlaceholder')}
                    mode="text"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.emailLabel')} <span className="text-red-500">*</span>
                  </label>
                  <DxTextBox
                    value={formData.email}
                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                    placeholder={t('form.emailPlaceholder')}
                    mode="email"
                  />
                  {formData.email && !emailValid && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <X className="h-3 w-3" /> {t('form.emailInvalid')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Access / role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-purple-500" />
                {t('form.sectionAccess')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.roleLabel')} <span className="text-red-500">*</span>
                  </label>
                  <DxSelectBox
                    items={roleItems}
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as string })}
                    valueExpr="value"
                    displayExpr="label"
                    searchExpr={['label', 'description']}
                    searchEnabled
                    placeholder={t('form.rolePlaceholder')}
                    disabled={isLoadingOptions}
                  />
                  {selectedRole?.description && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                      ℹ️ {selectedRole.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.departmentLabel')} <span className="text-gray-400 text-xs">{t('form.departmentOptional')}</span>
                  </label>
                  <DxSelectBox
                    items={departmentItems}
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value as string })}
                    valueExpr="value"
                    displayExpr="label"
                    searchExpr="label"
                    searchEnabled
                    placeholder={t('form.departmentPlaceholder')}
                    disabled={isLoadingOptions}
                    showClearButton
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Security / password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base">
                  <Key className="h-5 w-5 text-amber-500" />
                  {t('form.sectionSecurity')}
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {t('form.generatePassword')}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.passwordLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DxTextBox
                      value={formData.password}
                      onValueChange={(value) => setFormData({ ...formData, password: value })}
                      placeholder={t('form.passwordPlaceholder')}
                      mode={showPassword ? 'text' : 'password'}
                    />
                    <button
                      type="button"
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-gray-400" />
                    {t('form.confirmPasswordLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DxTextBox
                      value={formData.confirmPassword}
                      onValueChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                      placeholder={t('form.confirmPasswordPlaceholder')}
                      mode={showConfirm ? 'text' : 'password'}
                    />
                    <button
                      type="button"
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordsMatch === true && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('form.passwordsMatch')}
                    </p>
                  )}
                  {passwordsMatch === false && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <X className="h-3 w-3" /> {t('form.passwordsNotMatch')}
                    </p>
                  )}
                </div>
              </div>

              {/* Password strength + requirements checklist */}
              {formData.password && (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">{t('form.passwordStrength')}</span>
                    <span className={`text-xs font-semibold ${
                      passwordStrength.score <= 2 ? 'text-red-600' :
                      passwordStrength.score === 3 ? 'text-amber-600' :
                      passwordStrength.score === 4 ? 'text-blue-600' : 'text-green-600'
                    }`}>{strengthLabel}</span>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i <= passwordStrength.score ? strengthColor : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {passwordStrength.rules.map((r) => (
                      <div
                        key={r.key}
                        className={`flex items-center gap-1.5 ${r.ok ? 'text-green-700' : 'text-gray-500'}`}
                      >
                        {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {t(`form.rules.${r.key}`)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions — stack on mobile, inline on tablet+ */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <DxButton
              text={t('form.cancel')}
              stylingMode="outlined"
              onClick={() => router.push('/users')}
              width="100%"
              elementAttr={{ class: 'sm:!w-auto' }}
            />
            <DxButton
              text={isSubmitting ? t('form.saving') : t('form.create')}
              type="success"
              icon="save"
              useSubmitBehavior
              disabled={!canSubmit}
              width="100%"
              elementAttr={{ class: 'sm:!w-auto' }}
            />
          </div>
        </form>

        {isLoadingOptions && (
          <div className="flex items-center justify-center py-2 text-sm text-gray-500">
            <DxLoadIndicator />
            <span className="ml-2">{t('form.loadingOptions')}</span>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
