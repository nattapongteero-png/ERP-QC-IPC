'use client';

// Chart of Accounts Page
// Feature: 010-accounting-module-integration
// User Story 1: Create and Manage Chart of Accounts

import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import TreeList, {
  Column,
  SearchPanel,
  HeaderFilter,
  Selection,
} from 'devextreme-react/tree-list';
import Form, { SimpleItem, GroupItem, RequiredRule, StringLengthRule, PatternRule } from 'devextreme-react/form';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { useMobile } from '@/hooks/use-mobile';
import { AccountingStatusBadge } from '@/components/accounting';
import {
  ListTree,
  BookOpen,
  CheckCircle,
  XCircle,
  Layers,
  Building2,
  Landmark,
  Pencil,
  Plus,
  SearchX,
  FileText,
  FolderTree,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { GLAccount, GLAccountType, GLAccountCreate, GLAccountUpdate } from '@/types/accounting';

// ============================================
// API functions
// ============================================
async function fetchGLAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const data = await res.json();
  return data.data || [];
}

async function fetchGLAccountTypes(): Promise<GLAccountType[]> {
  const res = await fetch('/api/accounting/gl-account-types');
  if (!res.ok) throw new Error('Failed to fetch account types');
  const data = await res.json();
  return data.data || [];
}

async function exportCOA(includeInactive: boolean = false) {
  const res = await fetch(`/api/accounting/gl-accounts?export=json&includeInactive=${includeInactive}`);
  if (!res.ok) throw new Error('Failed to export COA');
  const data = await res.json();

  const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chart-of-accounts-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function createGLAccount(data: GLAccountCreate): Promise<GLAccount> {
  const res = await fetch('/api/accounting/gl-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create account');
  }
  const result = await res.json();
  return result.data;
}

async function updateGLAccount(id: number, data: GLAccountUpdate): Promise<GLAccount> {
  const res = await fetch(`/api/accounting/gl-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update account');
  }
  const result = await res.json();
  return result.data;
}

// ============================================
// Types / Configs
// ============================================
interface GLAccountFormData {
  code: string;
  nameTh: string;
  nameEn: string;
  accountTypeId: number | null;
  parentId: number | null;
  isPostable: boolean;
  isBankAccount: boolean;
  bankName: string;
  bankAccountNumber: string;
  description: string;
  isActive: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'postable' | 'bank';

const STATUS_FILTER_CONFIG: Record<StatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}> = {
  all: {
    translationKey: 'all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    icon: <Layers className="h-4 w-4" />,
  },
  active: {
    translationKey: 'active',
    bgColor: 'bg-green-600',
    textColor: 'text-white',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  inactive: {
    translationKey: 'inactive',
    bgColor: 'bg-gray-500',
    textColor: 'text-white',
    icon: <XCircle className="h-4 w-4" />,
  },
  postable: {
    translationKey: 'postable',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    icon: <BookOpen className="h-4 w-4" />,
  },
  bank: {
    translationKey: 'bank',
    bgColor: 'bg-teal-600',
    textColor: 'text-white',
    icon: <Landmark className="h-4 w-4" />,
  },
};

// Map account type category to a color palette
const getCategoryStyle = (category?: string) => {
  switch (category) {
    case 'asset':
      return { bg: 'bg-blue-100', text: 'text-blue-700', accent: 'border-blue-500' };
    case 'liability':
      return { bg: 'bg-red-100', text: 'text-red-700', accent: 'border-red-500' };
    case 'equity':
      return { bg: 'bg-purple-100', text: 'text-purple-700', accent: 'border-purple-500' };
    case 'revenue':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', accent: 'border-emerald-500' };
    case 'expense':
      return { bg: 'bg-amber-100', text: 'text-amber-700', accent: 'border-amber-500' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', accent: 'border-gray-400' };
  }
};

// ============================================
// Defaults / Converters
// ============================================
const getDefaultFormData = (parentAccount?: GLAccount | null): GLAccountFormData => ({
  code: '',
  nameTh: '',
  nameEn: '',
  accountTypeId: parentAccount?.accountTypeId || null,
  parentId: parentAccount?.id || null,
  isPostable: true,
  isBankAccount: false,
  bankName: '',
  bankAccountNumber: '',
  description: '',
  isActive: true,
});

const accountToFormData = (account: GLAccount): GLAccountFormData => ({
  code: account.code,
  nameTh: account.nameTh,
  nameEn: account.nameEn,
  accountTypeId: account.accountTypeId,
  parentId: account.parentId,
  isPostable: account.isPostable,
  isBankAccount: account.isBankAccount,
  bankName: account.bankName || '',
  bankAccountNumber: account.bankAccountNumber || '',
  description: account.description || '',
  isActive: account.isActive,
});

// ============================================
// Page Component
// ============================================
export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('accounting');
  const locale = useLocale();
  const { isMobile } = useMobile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null);
  const [formData, setFormData] = useState<GLAccountFormData>(getDefaultFormData());
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch data
  const { data: accounts = [], isLoading: accountsLoading, refetch } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  const { data: accountTypes = [] } = useQuery({
    queryKey: ['gl-account-types'],
    queryFn: fetchGLAccountTypes,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createGLAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gl-accounts'] });
      notify(t('chartOfAccounts.form.toast.createSuccess'), 'success', 3000);
      handleCloseDialog();
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GLAccountUpdate }) => updateGLAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gl-accounts'] });
      notify(t('chartOfAccounts.form.toast.updateSuccess'), 'success', 3000);
      handleCloseDialog();
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.isActive).length;
    const inactive = accounts.filter(a => !a.isActive).length;
    const typeCount = new Set(accounts.map(a => a.accountTypeId)).size;

    return { total, active, inactive, typeCount };
  }, [accounts]);

  // Tab counts for filter tabs
  const filterCounts: Record<StatusFilter, number> = useMemo(() => ({
    all: accounts.length,
    active: accounts.filter(a => a.isActive).length,
    inactive: accounts.filter(a => !a.isActive).length,
    postable: accounts.filter(a => a.isPostable).length,
    bank: accounts.filter(a => a.isBankAccount).length,
  }), [accounts]);

  // Filter accounts by search + status filter
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      // Status filter
      if (statusFilter === 'active' && !account.isActive) return false;
      if (statusFilter === 'inactive' && account.isActive) return false;
      if (statusFilter === 'postable' && !account.isPostable) return false;
      if (statusFilter === 'bank' && !account.isBankAccount) return false;

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return (
          account.code?.toLowerCase().includes(q) ||
          account.nameTh?.toLowerCase().includes(q) ||
          account.nameEn?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, statusFilter, search]);

  // Prepare tree data — when filtering/searching, show flat list; otherwise hierarchy
  const hasFilter = search !== '' || statusFilter !== 'all';
  const treeData = useMemo(() => {
    const source = hasFilter ? filteredAccounts : accounts;
    return source.map(account => ({
      ...account,
      // When filtering we flatten (no parent) so users see all matches
      parentId: hasFilter ? 0 : (account.parentId || 0),
      typeCode: account.accountType?.code || '',
      typeName: account.accountType?.nameTh || '',
      typeCategory: account.accountType?.category || '',
    }));
  }, [filteredAccounts, accounts, hasFilter]);

  // Handlers
  const handleExport = useCallback(async () => {
    try {
      await exportCOA(false);
      notify(t('chartOfAccounts.exportSuccess'), 'success', 3000);
    } catch (error) {
      console.error('Export failed:', error);
      notify(t('chartOfAccounts.exportFailed'), 'error', 3000);
    }
  }, [t]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleOpenAddDialog = useCallback((parentAccount?: GLAccount | null) => {
    setEditingAccount(null);
    setFormData(getDefaultFormData(parentAccount));
    setShowDialog(true);
  }, []);

  const handleOpenEditDialog = useCallback((account: GLAccount) => {
    setEditingAccount(account);
    setFormData(accountToFormData(account));
    setShowDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setShowDialog(false);
    setEditingAccount(null);
    setFormData(getDefaultFormData());
    setIsSaving(false);
  }, []);

  const handleSave = useCallback(async () => {
    const formInstance = formRef.current?.instance();
    if (!formInstance) return;

    const validationResult = formInstance.validate();
    if (!validationResult.isValid) return;

    setIsSaving(true);
    try {
      if (editingAccount) {
        await updateMutation.mutateAsync({
          id: editingAccount.id,
          data: {
            nameTh: formData.nameTh,
            nameEn: formData.nameEn,
            accountTypeId: formData.accountTypeId || undefined,
            parentId: formData.parentId,
            isActive: formData.isActive,
            isPostable: formData.isPostable,
            isBankAccount: formData.isBankAccount,
            bankName: formData.bankName || null,
            bankAccountNumber: formData.bankAccountNumber || null,
            description: formData.description || null,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: formData.code,
          nameTh: formData.nameTh,
          nameEn: formData.nameEn,
          accountTypeId: formData.accountTypeId!,
          parentId: formData.parentId,
          isPostable: formData.isPostable,
          isBankAccount: formData.isBankAccount,
          bankName: formData.bankName || undefined,
          bankAccountNumber: formData.bankAccountNumber || undefined,
          description: formData.description || undefined,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [editingAccount, formData, createMutation, updateMutation]);

  const handleRowDblClick = useCallback((e: { data: GLAccount }) => {
    handleOpenEditDialog(e.data);
  }, [handleOpenEditDialog]);

  // Lookup data
  const accountTypeLookup = useMemo(() =>
    accountTypes.map(t => ({
      id: t.id,
      displayValue: `${t.code} - ${t.nameTh}`,
    })),
  [accountTypes]);

  const parentLookup = useMemo(() => [
    { id: null, displayValue: t('chartOfAccounts.form.fields.noParent') },
    ...accounts
      .filter(a => !a.isPostable && a.isActive)
      .map(a => ({
        id: a.id,
        displayValue: `${a.code} - ${a.nameTh}`,
      })),
  ], [accounts, t]);

  // Cell renderers
  const renderTypeBadge = useCallback((cellInfo: { value: string; data: { typeCategory?: string } }) => {
    const style = getCategoryStyle(cellInfo.data.typeCategory);
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', style.bg, style.text)}>
        {cellInfo.value || '-'}
      </span>
    );
  }, []);

  const renderStatus = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <AccountingStatusBadge status="active" />
    ) : (
      <AccountingStatusBadge status="inactive" />
    );
  }, []);

  const renderPostable = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
        <CheckCircle className="h-3.5 w-3.5" />
        {t('chartOfAccounts.columns.postableYes')}
      </span>
    ) : (
      <span className="text-gray-400">-</span>
    );
  }, [t]);

  const renderCode = useCallback((cellInfo: { data: GLAccount & { typeCategory?: string } }) => {
    const style = getCategoryStyle(cellInfo.data.typeCategory);
    return (
      <div className="flex items-center gap-2">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', style.bg)}>
          <FolderTree className={cn('h-4 w-4', style.text)} />
        </div>
        <span className="font-mono font-semibold text-gray-900">{cellInfo.data.code}</span>
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full" data-testid="coa-page">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('chartOfAccounts.title')}
        subtitle={t('chartOfAccounts.subtitle')}
        icon={ListTree}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('actions.refresh') || 'Refresh'}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="export"
              text={t('chartOfAccounts.export')}
              stylingMode="outlined"
              onClick={handleExport}
              className="hidden md:inline-flex"
            />
            <DxButton
              text={t('chartOfAccounts.actions.add')}
              icon="plus"
              type="success"
              onClick={() => handleOpenAddDialog()}
              elementAttr={{ 'data-testid': 'coa-add-btn' }}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="coa-stats">
        <StatCard
          label={t('chartOfAccounts.stats.total')}
          value={stats.total}
          icon={FileText}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={accountsLoading}
        />
        <StatCard
          label={t('chartOfAccounts.stats.active')}
          value={stats.active}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={accountsLoading}
        />
        <StatCard
          label={t('chartOfAccounts.stats.byType')}
          value={stats.typeCount}
          icon={Layers}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={accountsLoading}
        />
        <StatCard
          label={t('chartOfAccounts.stats.inactive')}
          value={stats.inactive}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={accountsLoading}
        />
      </div>

      {/* Main Card: filters + content */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs (scroll-snap on mobile) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {(Object.keys(STATUS_FILTER_CONFIG) as StatusFilter[]).map((filter) => {
              const config = STATUS_FILTER_CONFIG[filter];
              const count = filterCounts[filter];
              const isActive = statusFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${config.bgColor} ${config.textColor} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  data-testid={`coa-filter-${filter}`}
                >
                  {config.icon}
                  <span>{t(`chartOfAccounts.filters.${config.translationKey}`)}</span>
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                    isActive
                      ? 'bg-white/25 text-inherit'
                      : 'bg-gray-200 text-gray-700'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Result Count Row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <DxTextBox
              placeholder={t('chartOfAccounts.search.placeholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <BookOpen className="h-4 w-4 text-gray-400" />
            <span>{t('chartOfAccounts.stats.accountsShown', { count: filteredAccounts.length })}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop TreeList */}
        {accountsLoading ? (
          isMobile ? (
            <AccountCardSkeletonList count={5} />
          ) : (
            <TreeListLoadingSkeleton />
          )
        ) : accounts.length === 0 ? (
          <EmptyState
            onCreate={() => handleOpenAddDialog()}
            addText={t('chartOfAccounts.actions.add')}
            title={t('chartOfAccounts.empty.title')}
            description={t('chartOfAccounts.empty.description')}
          />
        ) : filteredAccounts.length === 0 ? (
          <NoResultsState
            onClear={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            title={t('chartOfAccounts.noResults.title')}
            description={t('chartOfAccounts.noResults.description')}
            clearText={t('actions.clear') || 'Clear'}
          />
        ) : isMobile ? (
          <AccountCardList
            accounts={filteredAccounts}
            onEdit={handleOpenEditDialog}
            editText={t('actions.edit') || 'Edit'}
            activeText={t('chartOfAccounts.filters.active')}
            inactiveText={t('chartOfAccounts.filters.inactive')}
            postableText={t('chartOfAccounts.columns.postableYes')}
            bankText={t('chartOfAccounts.columns.bankAccount')}
          />
        ) : (
          <div className="overflow-x-auto" data-testid="coa-treelist">
            <div className="min-w-[900px]">
              <TreeList
                key={locale}
                dataSource={treeData}
                keyExpr="id"
                parentIdExpr="parentId"
                rootValue={0}
                showBorders={false}
                showRowLines={true}
                columnAutoWidth={true}
                autoExpandAll={hasFilter}
                defaultExpandedRowKeys={[]}
                height={600}
                onRowDblClick={handleRowDblClick}
              >
                <SearchPanel visible={false} />
                <HeaderFilter visible={true} />
                <Selection mode="single" />

                <Column
                  dataField="code"
                  caption={t('chartOfAccounts.columns.code')}
                  width={200}
                  cellRender={renderCode}
                />
                <Column dataField="nameTh" caption={t('chartOfAccounts.columns.nameTh')} width={250} />
                <Column dataField="nameEn" caption={t('chartOfAccounts.columns.nameEn')} width={200} />
                <Column
                  dataField="typeName"
                  caption={t('chartOfAccounts.columns.type')}
                  width={140}
                  cellRender={renderTypeBadge}
                />
                <Column dataField="level" caption={t('chartOfAccounts.columns.level')} width={80} alignment="center" />
                <Column
                  dataField="isPostable"
                  caption={t('chartOfAccounts.columns.postable')}
                  width={120}
                  cellRender={renderPostable}
                />
                <Column
                  dataField="isActive"
                  caption={t('chartOfAccounts.columns.status')}
                  width={100}
                  cellRender={renderStatus}
                />
                <Column
                  dataField="isBankAccount"
                  caption={t('chartOfAccounts.columns.bankAccount')}
                  width={120}
                  dataType="boolean"
                />
              </TreeList>
            </div>
          </div>
        )}
      </div>

      {/* GL Account Form Dialog */}
      <DxPopup
        visible={showDialog}
        onHiding={handleCloseDialog}
        title={editingAccount ? t('chartOfAccounts.form.editTitle', { code: editingAccount.code }) : t('chartOfAccounts.form.addTitle')}
        width={700}
        height="auto"
        maxHeight={650}
        showCloseButton={true}
        dragEnabled={true}
        fullScreenOnMobile={true}
      >
        <div className="p-4" data-testid="coa-form-dialog">
          <Form
            ref={formRef}
            formData={formData}
            colCount={isMobile ? 1 : 2}
            labelLocation="top"
            showColonAfterLabel={false}
            onFieldDataChanged={(e) => {
              setFormData(prev => ({ ...prev, [e.dataField as string]: e.value }));
            }}
          >
            <GroupItem caption={t('chartOfAccounts.form.sections.basic')} colSpan={isMobile ? 1 : 2} colCount={isMobile ? 1 : 2}>
              <SimpleItem
                dataField="code"
                label={{ text: t('chartOfAccounts.form.fields.code') }}
                editorType="dxTextBox"
                editorOptions={{
                  placeholder: t('chartOfAccounts.form.fields.codePlaceholder'),
                  disabled: !!editingAccount,
                }}
              >
                <RequiredRule message={t('chartOfAccounts.form.fields.codeRequired')} />
                <PatternRule pattern={/^[0-9\-.]+$/} message={t('chartOfAccounts.form.fields.codePattern')} />
                <StringLengthRule max={20} message={t('chartOfAccounts.form.fields.codeMaxLength')} />
              </SimpleItem>
              <SimpleItem
                dataField="accountTypeId"
                label={{ text: t('chartOfAccounts.form.fields.accountType') }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: accountTypeLookup,
                  valueExpr: 'id',
                  displayExpr: 'displayValue',
                  placeholder: t('chartOfAccounts.form.fields.accountTypePlaceholder'),
                  searchEnabled: true,
                }}
              >
                <RequiredRule message={t('chartOfAccounts.form.fields.accountTypeRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="nameTh"
                label={{ text: t('chartOfAccounts.form.fields.nameTh') }}
                editorType="dxTextBox"
                editorOptions={{
                  placeholder: t('chartOfAccounts.form.fields.nameThPlaceholder'),
                }}
              >
                <RequiredRule message={t('chartOfAccounts.form.fields.nameThRequired')} />
                <StringLengthRule max={200} message={t('chartOfAccounts.form.fields.nameMaxLength')} />
              </SimpleItem>
              <SimpleItem
                dataField="nameEn"
                label={{ text: t('chartOfAccounts.form.fields.nameEn') }}
                editorType="dxTextBox"
                editorOptions={{
                  placeholder: t('chartOfAccounts.form.fields.nameEnPlaceholder'),
                }}
              >
                <RequiredRule message={t('chartOfAccounts.form.fields.nameEnRequired')} />
                <StringLengthRule max={200} message={t('chartOfAccounts.form.fields.nameMaxLength')} />
              </SimpleItem>
              <SimpleItem
                dataField="parentId"
                label={{ text: t('chartOfAccounts.form.fields.parent') }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: parentLookup,
                  valueExpr: 'id',
                  displayExpr: 'displayValue',
                  placeholder: t('chartOfAccounts.form.fields.parentPlaceholder'),
                  searchEnabled: true,
                  showClearButton: true,
                }}
              />
              <SimpleItem
                dataField="description"
                label={{ text: t('chartOfAccounts.form.fields.description') }}
                editorType="dxTextArea"
                editorOptions={{
                  placeholder: t('chartOfAccounts.form.fields.descriptionPlaceholder'),
                  height: 60,
                }}
              />
            </GroupItem>

            <GroupItem caption={t('chartOfAccounts.form.sections.options')} colSpan={isMobile ? 1 : 2} colCount={isMobile ? 1 : 3}>
              <SimpleItem
                dataField="isPostable"
                label={{ text: t('chartOfAccounts.form.fields.isPostable') }}
                editorType="dxCheckBox"
                editorOptions={{
                  text: t('chartOfAccounts.form.fields.isPostableText'),
                }}
              />
              <SimpleItem
                dataField="isBankAccount"
                label={{ text: t('chartOfAccounts.form.fields.isBankAccount') }}
                editorType="dxCheckBox"
                editorOptions={{
                  text: t('chartOfAccounts.form.fields.isBankAccountText'),
                }}
              />
              {editingAccount && (
                <SimpleItem
                  dataField="isActive"
                  label={{ text: t('chartOfAccounts.form.fields.isActive') }}
                  editorType="dxCheckBox"
                  editorOptions={{
                    text: t('chartOfAccounts.form.fields.isActiveText'),
                  }}
                />
              )}
            </GroupItem>

            {formData.isBankAccount && (
              <GroupItem caption={t('chartOfAccounts.form.sections.bank')} colSpan={isMobile ? 1 : 2} colCount={isMobile ? 1 : 2}>
                <SimpleItem
                  dataField="bankName"
                  label={{ text: t('chartOfAccounts.form.fields.bankName') }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: t('chartOfAccounts.form.fields.bankNamePlaceholder'),
                  }}
                >
                  <StringLengthRule max={100} message={t('chartOfAccounts.form.fields.bankNameMaxLength')} />
                </SimpleItem>
                <SimpleItem
                  dataField="bankAccountNumber"
                  label={{ text: t('chartOfAccounts.form.fields.bankAccountNumber') }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: t('chartOfAccounts.form.fields.bankAccountNumberPlaceholder'),
                  }}
                >
                  <StringLengthRule max={50} message={t('chartOfAccounts.form.fields.bankAccountNumberMaxLength')} />
                </SimpleItem>
              </GroupItem>
            )}
          </Form>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <DxButton
              text={t('chartOfAccounts.actions.cancel')}
              onClick={handleCloseDialog}
              stylingMode="outlined"
              elementAttr={{ 'data-testid': 'coa-cancel-btn' }}
            />
            <DxButton
              text={isSaving ? t('chartOfAccounts.actions.saving') : t('chartOfAccounts.actions.save')}
              type="success"
              stylingMode="contained"
              onClick={handleSave}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'coa-save-btn' }}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces TreeList on mobile viewports.
 * Each card shows: code + name + type + status + postable/bank badges + 44px tap footer.
 */
function AccountCardList({
  accounts,
  onEdit,
  editText,
  activeText,
  inactiveText,
  postableText,
  bankText,
}: {
  accounts: GLAccount[];
  onEdit: (a: GLAccount) => void;
  editText: string;
  activeText: string;
  inactiveText: string;
  postableText: string;
  bankText: string;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {accounts.map((a) => {
        const style = getCategoryStyle(a.accountType?.category);
        return (
          <div
            key={a.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Tap area for edit */}
            <button
              type="button"
              onClick={() => onEdit(a)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  style.bg
                )}
              >
                <FolderTree className={cn('h-5 w-5', style.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-500 mb-0.5">{a.code}</p>
                    <p className="font-semibold text-gray-900 text-base truncate">{a.nameTh}</p>
                    {a.nameEn && (
                      <p className="text-xs text-gray-500 truncate">{a.nameEn}</p>
                    )}
                  </div>
                  <Badge variant={a.isActive ? 'success' : 'default'} dot>
                    {a.isActive ? activeText : inactiveText}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {a.accountType && (
                    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium', style.bg, style.text)}>
                      <Layers className="h-3 w-3" />
                      {a.accountType.code} - {a.accountType.nameTh}
                    </span>
                  )}
                  {a.isPostable && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      <CheckCircle className="h-3 w-3" />
                      {postableText}
                    </span>
                  )}
                  {a.isBankAccount && (
                    <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded">
                      <Landmark className="h-3 w-3" />
                      {bankText}
                    </span>
                  )}
                  {a.level > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      <ChevronRight className="h-3 w-3" />
                      L{a.level}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: 44px min-height touch target */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onEdit(a)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Pencil className="h-4 w-4" />
                <span>{editText}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function AccountCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/4 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-5 w-14 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop TreeList */
function TreeListLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/5 bg-gray-200 rounded" />
            <div className="h-2 w-1/3 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-24 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty state — shown when user has zero accounts */
function EmptyState({
  onCreate,
  addText,
  title,
  description,
}: {
  onCreate: () => void;
  addText: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-green-100 flex items-center justify-center mb-5">
        <ListTree className="h-10 w-10 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      <DxButton
        text={addText}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No results state — shown when filters yield zero but accounts exist */
function NoResultsState({
  onClear,
  title,
  description,
  clearText,
}: {
  onClear: () => void;
  title: string;
  description: string;
  clearText: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      <DxButton
        text={clearText}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

// Unused reference to preserve import hint for Building2 (account-type icon alternative)
void Building2;
void Plus;
