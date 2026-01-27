'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { cn } from '@/lib/utils/cn';
import {
  Users,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Hash,
  Building2,
  User,
  RefreshCw,
  CheckCircle,
  Hospital,
  Pill,
  Store,
  Truck,
  Leaf,
  Sparkles,
  Landmark,
  Globe,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Customer Type Configuration
// ============================================================================

const CUSTOMER_TYPE_CONFIG: Record<string, {
  translationKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  gradient: string;
}> = {
  hospital: {
    translationKey: 'hospital',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: Hospital,
    gradient: 'from-red-500 to-rose-600',
  },
  clinic: {
    translationKey: 'clinic',
    color: '#f97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: Pill,
    gradient: 'from-orange-500 to-amber-600',
  },
  pharmacy: {
    translationKey: 'pharmacy',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: Store,
    gradient: 'from-green-500 to-emerald-600',
  },
  distributor: {
    translationKey: 'distributor',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
  },
  traditional_medicine: {
    translationKey: 'traditional_medicine',
    color: '#a855f7',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    icon: Leaf,
    gradient: 'from-purple-500 to-violet-600',
  },
  spa_wellness: {
    translationKey: 'spa_wellness',
    color: '#ec4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: Sparkles,
    gradient: 'from-pink-500 to-rose-600',
  },
  government: {
    translationKey: 'government',
    color: '#6366f1',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-700',
    icon: Landmark,
    gradient: 'from-indigo-500 to-purple-600',
  },
  export: {
    translationKey: 'export',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Globe,
    gradient: 'from-cyan-500 to-teal-600',
  },
  other: {
    translationKey: 'other',
    color: '#64748b',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    icon: MoreHorizontal,
    gradient: 'from-slate-500 to-gray-600',
  },
};

const CUSTOMER_TYPE_KEYS = [
  'hospital', 'clinic', 'pharmacy', 'distributor',
  'traditional_medicine', 'spa_wellness', 'government', 'export', 'other'
] as const;

const CREDIT_TERM_KEYS = [7, 15, 30, 45, 60, 90] as const;

const PAYMENT_TERM_KEYS = ['cash', 'net7', 'net15', 'net30', 'net45', 'net60', 'net90', 'cod'] as const;

const PAYMENT_TERM_VALUES: Record<string, string> = {
  cash: 'Cash',
  net7: 'Net 7',
  net15: 'Net 15',
  net30: 'Net 30',
  net45: 'Net 45',
  net60: 'Net 60',
  net90: 'Net 90',
  cod: 'COD',
};

// ============================================================================
// Main Component
// ============================================================================

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('sales');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    customerType: 'hospital',
    creditLimit: 0,
    creditTermDays: 30,
    paymentTerms: 'Net 30',
    notes: '',
  });

  // Memoized translated options
  const customerTypeOptions = useMemo(() =>
    CUSTOMER_TYPE_KEYS.map(key => ({
      value: key,
      label: t(`customers.type.${key}` as const),
    })), [t]);

  const creditTermOptions = useMemo(() =>
    CREDIT_TERM_KEYS.map(days => ({
      value: days,
      label: t(`customers.new.creditTermOptions.${days}` as const),
    })), [t]);

  const paymentTermOptions = useMemo(() =>
    PAYMENT_TERM_KEYS.map(key => ({
      value: PAYMENT_TERM_VALUES[key],
      label: t(`customers.new.paymentOptions.${key}` as const),
    })), [t]);

  // Auto-generate customer code on page load
  const fetchNextCode = useCallback(async () => {
    setIsLoadingCode(true);
    try {
      const res = await fetch('/api/customers/next-code');
      const result = await res.json();
      if (result.success) {
        setGeneratedCode(result.data.code);
      } else {
        console.error('Failed to generate code:', result.error);
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
    } finally {
      setIsLoadingCode(false);
    }
  }, []);

  useEffect(() => {
    fetchNextCode();
  }, [fetchNextCode]);

  const handleSave = async () => {
    if (!generatedCode) {
      alert(t('customers.new.validation.waitForCode'));
      return;
    }
    if (!form.name.trim()) {
      alert(t('customers.new.validation.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: generatedCode,
          ...form,
          creditLimit: form.creditLimit || null,
          creditTermDays: form.creditTermDays || null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        // Invalidate customers query to refresh the list when navigating back
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        router.push(`/sales/customers/${result.data.id}`);
      } else {
        alert(result.error || t('customers.new.toast.createError'));
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
      alert(t('customers.new.toast.createError'));
    } finally {
      setIsSaving(false);
    }
  };

  const typeConfig = CUSTOMER_TYPE_CONFIG[form.customerType] || CUSTOMER_TYPE_CONFIG.hospital;
  const TypeIcon = typeConfig.icon;

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-r', typeConfig.gradient)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{t('customers.new.title')}</h1>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                      {t(`customers.type.${typeConfig.translationKey}` as const)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-white/80 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-4 w-4" />
                      {isLoadingCode ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('customers.new.generatingCode')}
                        </span>
                      ) : (
                        <span className="font-mono font-semibold">{generatedCode}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TypeIcon className="h-4 w-4" />
                      <span>{t(`customers.type.${typeConfig.translationKey}` as const)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DxButton
                  text={t('customers.new.actions.cancel')}
                  icon="back"
                  type="normal"
                  stylingMode="text"
                  onClick={() => router.push('/sales/customers')}
                  className="text-white hover:bg-white/20"
                />
                <button
                  onClick={fetchNextCode}
                  disabled={isLoadingCode}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors disabled:opacity-50"
                  title={t('customers.new.actions.regenerateCode')}
                >
                  <RefreshCw className={cn('h-5 w-5', isLoadingCode && 'animate-spin')} />
                </button>
                <DxButton
                  text={isSaving ? t('customers.new.actions.saving') : t('customers.new.actions.save')}
                  icon="save"
                  type="success"
                  onClick={handleSave}
                  disabled={isSaving || isLoadingCode}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Customer Code Display */}
        <Card elevation="raised" className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className={cn('w-2', typeConfig.gradient.replace('from-', 'bg-').split(' ')[0])} />
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', typeConfig.bgClass)}>
                      <Hash className={cn('h-6 w-6', typeConfig.textClass)} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('customers.new.codeLabel')}</p>
                      {isLoadingCode ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('customers.new.generatingCode')}</span>
                        </div>
                      ) : (
                        <p className="text-2xl font-mono font-bold text-gray-900">{generatedCode}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isLoadingCode && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <CheckCircle className="h-4 w-4" />
                        {t('customers.new.codeReady')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          {/* Basic Information */}
          <Card elevation="raised" className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-indigo-500" />
                {t('customers.new.sections.basic')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.name')} <span className="text-red-500">*</span>
                  </label>
                  <DxTextBox
                    value={form.name}
                    onValueChange={(value) => setForm({ ...form, name: value })}
                    placeholder={t('customers.new.fields.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.type')}
                  </label>
                  <DxSelectBox
                    items={customerTypeOptions}
                    value={form.customerType}
                    onValueChange={(value) => setForm({ ...form, customerType: value })}
                    valueExpr="value"
                    displayExpr="label"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.taxId')}
                  </label>
                  <DxTextBox
                    value={form.taxId}
                    onValueChange={(value) => setForm({ ...form, taxId: value })}
                    placeholder={t('customers.new.fields.taxIdPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Type Preview */}
          <Card elevation="raised">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <TypeIcon className="h-5 w-5" style={{ color: typeConfig.color }} />
                {t('customers.new.sections.type')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={cn('p-6 rounded-xl text-center', typeConfig.bgClass)}>
                <div className={cn('h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-3 bg-white/50')}>
                  <TypeIcon className="h-8 w-8" style={{ color: typeConfig.color }} />
                </div>
                <p className={cn('text-lg font-bold', typeConfig.textClass)}>{t(`customers.type.${typeConfig.translationKey}` as const)}</p>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('customers.new.status')}</span>
                  <span className="flex items-center gap-1.5 text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    {t('customers.status.active')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('customers.detail.fields.code')}</span>
                  <span className="font-mono font-medium text-gray-900">{generatedCode || '...'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card elevation="raised">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-blue-500" />
                {t('customers.new.sections.contact')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('customers.new.fields.contactPerson')}
                </label>
                <DxTextBox
                  value={form.contactPerson}
                  onValueChange={(value) => setForm({ ...form, contactPerson: value })}
                  placeholder={t('customers.new.fields.contactPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {t('customers.new.fields.phone')}
                  </span>
                </label>
                <DxTextBox
                  value={form.phone}
                  onValueChange={(value) => setForm({ ...form, phone: value })}
                  placeholder={t('customers.new.fields.phonePlaceholder')}
                  mode="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {t('customers.new.fields.email')}
                  </span>
                </label>
                <DxTextBox
                  value={form.email}
                  onValueChange={(value) => setForm({ ...form, email: value })}
                  placeholder={t('customers.new.fields.emailPlaceholder')}
                  mode="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {t('customers.new.fields.address')}
                  </span>
                </label>
                <DxTextBox
                  value={form.address}
                  onValueChange={(value) => setForm({ ...form, address: value })}
                  placeholder={t('customers.new.fields.addressPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Credit Information */}
          <Card elevation="raised" className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-green-500" />
                {t('customers.new.sections.credit')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.creditLimit')}
                  </label>
                  <DxNumberBox
                    value={form.creditLimit}
                    onValueChange={(value) => setForm({ ...form, creditLimit: value || 0 })}
                    format="#,##0"
                    min={0}
                    step={10000}
                    showSpinButtons
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.creditTerm')}
                  </label>
                  <DxSelectBox
                    items={creditTermOptions}
                    value={form.creditTermDays}
                    onValueChange={(value) => setForm({ ...form, creditTermDays: value })}
                    valueExpr="value"
                    displayExpr="label"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('customers.new.fields.paymentTerms')}
                  </label>
                  <DxSelectBox
                    items={paymentTermOptions}
                    value={form.paymentTerms}
                    onValueChange={(value) => setForm({ ...form, paymentTerms: value })}
                    valueExpr="value"
                    displayExpr="label"
                  />
                </div>
              </div>

              {/* Credit Preview */}
              <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">{t('customers.new.creditPreview.title')}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(form.creditLimit || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('customers.new.creditPreview.creditTerm')}</p>
                    <p className="text-lg font-semibold text-gray-900">{form.creditTermDays} {t('customers.detail.summary.days')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card elevation="raised" className="lg:col-span-3">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-amber-500" />
                {t('customers.new.sections.notes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DxTextBox
                value={form.notes}
                onValueChange={(value) => setForm({ ...form, notes: value })}
                placeholder={t('customers.new.fields.notesPlaceholder')}
              />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Action Bar */}
        <Card elevation="raised" className="sticky bottom-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isLoadingCode ? (
                  <span className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('customers.new.generatingCode')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {t('customers.detail.fields.code')}: <span className="font-mono font-bold">{generatedCode}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <DxButton
                  text={t('customers.new.actions.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => router.push('/sales/customers')}
                />
                <DxButton
                  text={isSaving ? t('customers.new.actions.saving') : t('customers.new.actions.save')}
                  icon="save"
                  type="success"
                  onClick={handleSave}
                  disabled={isSaving || isLoadingCode || !form.name.trim()}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
