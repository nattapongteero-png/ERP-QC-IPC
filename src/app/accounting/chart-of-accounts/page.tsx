'use client';

// Chart of Accounts Page
// Feature: 010-accounting-module-integration
// User Story 1: Create and Manage Chart of Accounts

import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TreeList, {
  Column,
  SearchPanel,
  HeaderFilter,
  Selection,
  Toolbar,
  Item,
} from 'devextreme-react/tree-list';
import { Popup } from 'devextreme-react/popup';
import Form, { SimpleItem, GroupItem, RequiredRule, StringLengthRule, PatternRule } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  BookOpen,
  Wallet,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
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

// Type colors for badges
const TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  '1': 'default', // Assets
  '2': 'destructive', // Liabilities
  '3': 'secondary', // Equity
  '4': 'outline', // Revenue
  '5': 'destructive', // Expenses
};

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
      notify('บันทึกบัญชีสำเร็จ', 'success', 3000);
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
      notify('แก้ไขบัญชีสำเร็จ', 'success', 3000);
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
      notify('ส่งออกสำเร็จ', 'success', 3000);
    } catch (error) {
      console.error('Export failed:', error);
      notify('ส่งออกไม่สำเร็จ', 'error', 3000);
    }
  }, []);

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
    const formInstance = formRef.current?.instance;
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
    { id: null, displayValue: '(ไม่มีบัญชีแม่)' },
    ...accounts
      .filter(a => !a.isPostable && a.isActive)
      .map(a => ({
        id: a.id,
        displayValue: `${a.code} - ${a.nameTh}`,
      })),
  ], [accounts]);

  // Render type badge
  const renderTypeBadge = useCallback((cellInfo: { value: string; data: { typeCode: string } }) => {
    const typeCode = cellInfo.data?.typeCode;
    return (
      <Badge variant={TYPE_COLORS[typeCode] || 'default'}>
        {cellInfo.value}
      </Badge>
    );
  }, []);

  // Render status
  const renderStatus = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <Badge variant="default">ใช้งาน</Badge>
    ) : (
      <Badge variant="secondary">ไม่ใช้งาน</Badge>
    );
  }, []);

  // Render postable
  const renderPostable = useCallback((cellInfo: { value: boolean }) => {
    return cellInfo.value ? (
      <span className="text-green-600">ลงบัญชีได้</span>
    ) : (
      <span className="text-gray-400">-</span>
    );
  }, []);

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ResponsivePageHeader
        title="ผังบัญชี (Chart of Accounts)"
        subtitle="จัดการผังบัญชีตามมาตรฐานการบัญชีไทย (TAS)"
        icon={BookOpen}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="บัญชีทั้งหมด"
            value={stats.total}
            icon={BookOpen}
            iconColor="text-blue-500"
            accentColor="border-blue-500"
          />
          <StatCard
            label="ใช้งาน"
            value={stats.active}
            icon={TrendingUp}
            iconColor="text-green-500"
            accentColor="border-green-500"
          />
          <StatCard
            label="ลงบัญชีได้"
            value={stats.postable}
            icon={Wallet}
            iconColor="text-purple-500"
            accentColor="border-purple-500"
          />
          <StatCard
            label="บัญชีธนาคาร"
            value={stats.bankAccounts}
            icon={CreditCard}
            iconColor="text-orange-500"
            accentColor="border-orange-500"
          />
        </div>

        {/* TreeList */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <TreeList
            dataSource={treeData}
            keyExpr="id"
            parentIdExpr="parentId"
            rootValue={0}
            showBorders={true}
            showRowLines={true}
            columnAutoWidth={true}
            autoExpandAll={false}
            defaultExpandedRowKeys={[]}
            height={600}
            onRowDblClick={handleRowDblClick}
          >
            <SearchPanel visible={true} placeholder="ค้นหา..." />
            <HeaderFilter visible={true} />
            <Selection mode="single" />

            <Toolbar>
              <Item location="before">
                <Button
                  icon="add"
                  text="เพิ่มบัญชี"
                  type="default"
                  stylingMode="contained"
                  onClick={() => handleOpenAddDialog()}
                />
              </Item>
              <Item location="after">
                <Button
                  icon="export"
                  text="ส่งออก"
                  onClick={handleExport}
                />
              </Item>
              <Item location="after">
                <Button
                  icon="refresh"
                  onClick={handleRefresh}
                />
              </Item>
            </Toolbar>

            <Column dataField="code" caption="รหัสบัญชี" width={120} />
            <Column dataField="nameTh" caption="ชื่อบัญชี (ไทย)" width={250} />
            <Column dataField="nameEn" caption="ชื่อบัญชี (อังกฤษ)" width={200} />
            <Column
              dataField="typeName"
              caption="ประเภท"
              width={120}
              cellRender={renderTypeBadge}
            />
            <Column dataField="level" caption="ระดับ" width={80} alignment="center" />
            <Column
              dataField="isPostable"
              caption="ลงบัญชี"
              width={100}
              cellRender={renderPostable}
            />
            <Column
              dataField="isActive"
              caption="สถานะ"
              width={100}
              cellRender={renderStatus}
            />
            <Column
              dataField="isBankAccount"
              caption="บัญชีธนาคาร"
              width={120}
              dataType="boolean"
            />
          </TreeList>
        </div>

        {/* GL Account Form Dialog */}
        <Popup
          visible={showDialog}
          onHiding={handleCloseDialog}
          title={editingAccount ? `แก้ไขบัญชี: ${editingAccount.code}` : 'เพิ่มบัญชีใหม่'}
          width={700}
          height="auto"
          maxHeight={650}
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4">
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
              <GroupItem caption="ข้อมูลพื้นฐาน" colSpan={2} colCount={2}>
                <SimpleItem
                  dataField="code"
                  label={{ text: 'รหัสบัญชี' }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: 'เช่น 1-1100-01',
                    disabled: !!editingAccount, // Code cannot be edited
                  }}
                >
                  <RequiredRule message="กรุณาระบุรหัสบัญชี" />
                  <PatternRule pattern={/^[0-9\-.]+$/} message="รหัสบัญชีต้องเป็นตัวเลข ขีด หรือจุดเท่านั้น" />
                  <StringLengthRule max={20} message="รหัสบัญชีต้องไม่เกิน 20 ตัวอักษร" />
                </SimpleItem>
                <SimpleItem
                  dataField="accountTypeId"
                  label={{ text: 'ประเภทบัญชี' }}
                  editorType="dxSelectBox"
                  editorOptions={{
                    items: accountTypeLookup,
                    valueExpr: 'id',
                    displayExpr: 'displayValue',
                    placeholder: 'เลือกประเภทบัญชี',
                    searchEnabled: true,
                  }}
                >
                  <RequiredRule message="กรุณาเลือกประเภทบัญชี" />
                </SimpleItem>
                <SimpleItem
                  dataField="nameTh"
                  label={{ text: 'ชื่อบัญชี (ภาษาไทย)' }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: 'ชื่อบัญชีภาษาไทย',
                  }}
                >
                  <RequiredRule message="กรุณาระบุชื่อบัญชีภาษาไทย" />
                  <StringLengthRule max={200} message="ชื่อบัญชีต้องไม่เกิน 200 ตัวอักษร" />
                </SimpleItem>
                <SimpleItem
                  dataField="nameEn"
                  label={{ text: 'ชื่อบัญชี (ภาษาอังกฤษ)' }}
                  editorType="dxTextBox"
                  editorOptions={{
                    placeholder: 'Account Name in English',
                  }}
                >
                  <RequiredRule message="กรุณาระบุชื่อบัญชีภาษาอังกฤษ" />
                  <StringLengthRule max={200} message="ชื่อบัญชีต้องไม่เกิน 200 ตัวอักษร" />
                </SimpleItem>
                <SimpleItem
                  dataField="parentId"
                  label={{ text: 'บัญชีแม่' }}
                  editorType="dxSelectBox"
                  editorOptions={{
                    items: parentLookup,
                    valueExpr: 'id',
                    displayExpr: 'displayValue',
                    placeholder: 'เลือกบัญชีแม่ (ถ้ามี)',
                    searchEnabled: true,
                    showClearButton: true,
                  }}
                />
                <SimpleItem
                  dataField="description"
                  label={{ text: 'คำอธิบาย' }}
                  editorType="dxTextArea"
                  editorOptions={{
                    placeholder: 'คำอธิบายบัญชี (ถ้ามี)',
                    height: 60,
                  }}
                />
              </GroupItem>

              <GroupItem caption="ตัวเลือก" colSpan={2} colCount={3}>
                <SimpleItem
                  dataField="isPostable"
                  label={{ text: 'ลงบัญชีได้' }}
                  editorType="dxCheckBox"
                  editorOptions={{
                    text: 'สามารถลงบัญชีได้',
                  }}
                />
                <SimpleItem
                  dataField="isBankAccount"
                  label={{ text: 'บัญชีธนาคาร' }}
                  editorType="dxCheckBox"
                  editorOptions={{
                    text: 'เป็นบัญชีธนาคาร',
                  }}
                />
                {editingAccount && (
                  <SimpleItem
                    dataField="isActive"
                    label={{ text: 'สถานะ' }}
                    editorType="dxCheckBox"
                    editorOptions={{
                      text: 'ใช้งาน',
                    }}
                  />
                )}
              </GroupItem>

              {formData.isBankAccount && (
                <GroupItem caption="ข้อมูลธนาคาร" colSpan={2} colCount={2}>
                  <SimpleItem
                    dataField="bankName"
                    label={{ text: 'ชื่อธนาคาร' }}
                    editorType="dxTextBox"
                    editorOptions={{
                      placeholder: 'เช่น ธนาคารกรุงเทพ',
                    }}
                  >
                    <StringLengthRule max={100} message="ชื่อธนาคารต้องไม่เกิน 100 ตัวอักษร" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="bankAccountNumber"
                    label={{ text: 'เลขที่บัญชี' }}
                    editorType="dxTextBox"
                    editorOptions={{
                      placeholder: 'เลขที่บัญชีธนาคาร',
                    }}
                  >
                    <StringLengthRule max={50} message="เลขที่บัญชีต้องไม่เกิน 50 ตัวอักษร" />
                  </SimpleItem>
                </GroupItem>
              )}
            </Form>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button
                text="ยกเลิก"
                onClick={handleCloseDialog}
                stylingMode="outlined"
              />
              <Button
                text={isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                type="default"
                stylingMode="contained"
                onClick={handleSave}
                disabled={isSaving}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  );
}
