'use client';

// Chart of Accounts Page
// Feature: 010-accounting-module-integration
// User Story 1: Create and Manage Chart of Accounts

import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import TreeList, {
  Column,
  SearchPanel,
  HeaderFilter,
  Selection,
} from 'devextreme-react/tree-list';
import { Popup } from 'devextreme-react/popup';
import Form, { SimpleItem, GroupItem, RequiredRule, StringLengthRule, PatternRule } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';
import type { GLAccount, GLAccountType, GLAccountCreate, GLAccountUpdate } from '@/types/accounting';

// API functions
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

  // Trigger download
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

// Form data interface
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


// Default form data factory
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

// Convert GLAccount to form data
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

export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('accounting');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null);
  const [formData, setFormData] = useState<GLAccountFormData>(getDefaultFormData());
  const [isSaving, setIsSaving] = useState(false);

  // Fetch data
  const { data: accounts = [], isLoading: accountsLoading, refetch } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  const { data: accountTypes = [] } = useQuery({
    queryKey: ['gl-account-types'],
    queryFn: fetchGLAccountTypes,
  });

  // Create mutation
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

  // Update mutation
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
    const postable = accounts.filter(a => a.isPostable).length;
    const bankAccounts = accounts.filter(a => a.isBankAccount).length;

    return { total, active, postable, bankAccounts };
  }, [accounts]);

  // Prepare tree data
  const treeData = useMemo(() => {
    return accounts.map(account => ({
      ...account,
      parentId: account.parentId || 0,
      typeCode: account.accountType?.code || '',
      typeName: account.accountType?.nameTh || '',
    }));
  }, [accounts]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      await exportCOA(false);
      notify(t('chartOfAccounts.exportSuccess'), 'success', 3000);
    } catch (error) {
      console.error('Export failed:', error);
      notify(t('chartOfAccounts.exportFailed'), 'error', 3000);
    }
  }, [t]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle open add dialog
  const handleOpenAddDialog = useCallback((parentAccount?: GLAccount | null) => {
    setEditingAccount(null);
    setFormData(getDefaultFormData(parentAccount));
    setShowDialog(true);
  }, []);

  // Handle open edit dialog
  const handleOpenEditDialog = useCallback((account: GLAccount) => {
    setEditingAccount(account);
    setFormData(accountToFormData(account));
    setShowDialog(true);
  }, []);

  // Handle close dialog
  const handleCloseDialog = useCallback(() => {
    setShowDialog(false);
    setEditingAccount(null);
    setFormData(getDefaultFormData());
    setIsSaving(false);
  }, []);

  // Handle save
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

  // Handle row double click
  const handleRowDblClick = useCallback((e: { data: GLAccount }) => {
    handleOpenEditDialog(e.data);
  }, [handleOpenEditDialog]);

  // Account type lookup data
  const accountTypeLookup = useMemo(() =>
    accountTypes.map(t => ({
      id: t.id,
      displayValue: `${t.code} - ${t.nameTh}`,
    })),
  [accountTypes]);

  // Parent account lookup data (only non-postable accounts)
  const parentLookup = useMemo(() => [
    { id: null, displayValue: t('chartOfAccounts.form.fields.noParent') },
    ...accounts
      .filter(a => !a.isPostable && a.isActive)
      .map(a => ({
        id: a.id,
        displayValue: `${a.code} - ${a.nameTh}`,
      })),
  ], [accounts, t]);

  // Render type badge
  const renderTypeBadge = useCallback((cellInfo: { value: string }) => {
    return <span className="text-sm font-medium">{cellInfo.value}</span>;
  }, []);

  // Render status
  const renderStatus = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <AccountingStatusBadge status="active" />
    ) : (
      <AccountingStatusBadge status="inactive" />
    );
  }, []);

  // Render postable
  const renderPostable = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <span className="text-green-600">{t('chartOfAccounts.columns.postableYes')}</span>
    ) : (
      <span className="text-gray-400">-</span>
    );
  }, [t]);

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="coa-page">
      <AccountingPageHeader
        title={t('chartOfAccounts.title')}
        subtitle={t('chartOfAccounts.subtitle')}
        icon="book"
        onRefresh={handleRefresh}
        actions={
          <Button
            text={t('chartOfAccounts.export')}
            icon="export"
            onClick={handleExport}
            stylingMode="outlined"
            className="gap-2 bg-white/80 backdrop-blur-sm"
          />
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="coa-stats">
          <AccountingKPICard
            label={t('chartOfAccounts.stats.total')}
            value={stats.total}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label={t('chartOfAccounts.stats.active')}
            value={stats.active}
            icon="check-circle"
            variant="success"
          />
          <AccountingKPICard
            label={t('chartOfAccounts.stats.postable')}
            value={stats.postable}
            icon="wallet"
            variant="default"
          />
          <AccountingKPICard
            label={t('chartOfAccounts.stats.bankAccounts')}
            value={stats.bankAccounts}
            icon="credit-card"
            variant="info"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex-1" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('chartOfAccounts.actions.label')}
            </label>
            <Button
              icon="add"
              text={t('chartOfAccounts.actions.add')}
              type="default"
              stylingMode="contained"
              onClick={() => handleOpenAddDialog()}
              elementAttr={{ 'data-testid': 'coa-add-btn' }}
            />
          </div>
        </AccountingFilterPanel>

        {/* TreeList */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200" data-testid="coa-treelist">
          <TreeList
            dataSource={treeData}
            keyExpr="id"
            parentIdExpr="parentId"
            rootValue={0}
            showBorders={false}
            showRowLines={true}
            columnAutoWidth={true}
            autoExpandAll={false}
            defaultExpandedRowKeys={[]}
            height={600}
            onRowDblClick={handleRowDblClick}
          >
            <SearchPanel visible={true} width={240} placeholder={t('chartOfAccounts.search.placeholder')} />
            <HeaderFilter visible={true} />
            <Selection mode="single" />

            <Column dataField="code" caption={t('chartOfAccounts.columns.code')} width={120} />
            <Column dataField="nameTh" caption={t('chartOfAccounts.columns.nameTh')} width={250} />
            <Column dataField="nameEn" caption={t('chartOfAccounts.columns.nameEn')} width={200} />
            <Column
              dataField="typeName"
              caption={t('chartOfAccounts.columns.type')}
              width={120}
              cellRender={renderTypeBadge}
            />
            <Column dataField="level" caption={t('chartOfAccounts.columns.level')} width={80} alignment="center" />
            <Column
              dataField="isPostable"
              caption={t('chartOfAccounts.columns.postable')}
              width={100}
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

        {/* GL Account Form Dialog */}
        <Popup
          visible={showDialog}
          onHiding={handleCloseDialog}
          title={editingAccount ? t('chartOfAccounts.form.editTitle', { code: editingAccount.code }) : t('chartOfAccounts.form.addTitle')}
          width={700}
          height="auto"
          maxHeight={650}
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4" data-testid="coa-form-dialog">
            <Form
              ref={formRef}
              formData={formData}
              colCount={2}
              labelLocation="top"
              showColonAfterLabel={false}
              onFieldDataChanged={(e) => {
                setFormData(prev => ({ ...prev, [e.dataField as string]: e.value }));
              }}
            >
              <GroupItem caption={t('chartOfAccounts.form.sections.basic')} colSpan={2} colCount={2}>
                <SimpleItem
                  dataField="code"
                  label={{ text: t('chartOfAccounts.form.fields.code') }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: t('chartOfAccounts.form.fields.codePlaceholder'),
                    disabled: !!editingAccount, // Code cannot be edited
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

              <GroupItem caption={t('chartOfAccounts.form.sections.options')} colSpan={2} colCount={3}>
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
                <GroupItem caption={t('chartOfAccounts.form.sections.bank')} colSpan={2} colCount={2}>
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
              <Button
                text={t('chartOfAccounts.actions.cancel')}
                onClick={handleCloseDialog}
                stylingMode="outlined"
                elementAttr={{ 'data-testid': 'coa-cancel-btn' }}
              />
              <Button
                text={isSaving ? t('chartOfAccounts.actions.saving') : t('chartOfAccounts.actions.save')}
                type="default"
                stylingMode="contained"
                onClick={handleSave}
                disabled={isSaving}
                elementAttr={{ 'data-testid': 'coa-save-btn' }}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  );
}
