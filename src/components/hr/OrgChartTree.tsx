"use client";

import { useCallback, useState, useMemo } from 'react';
import TreeList, { Column, Editing, Selection, SearchPanel, HeaderFilter, Scrolling, Sorting, ColumnChooser, Lookup } from 'devextreme-react/tree-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import type { OrgUnit, OrgUnitCreate, OrgUnitUpdate } from '@/types/hr';
import type { RowInsertingEvent, RowUpdatingEvent, RowRemovingEvent } from 'devextreme/ui/tree_list';
import type { SelectionChangedEvent } from 'devextreme/ui/tree_list';

export interface OrgChartTreeProps {
  /** Height of the tree list */
  height?: number | string;
  /** Called when an org unit is selected */
  onSelectionChange?: (orgUnit: OrgUnit | null) => void;
  /** Enable editing mode */
  editable?: boolean;
  /** Additional CSS class */
  className?: string;
}

interface FlatOrgUnit extends OrgUnit {
  hasItems?: boolean;
}

const ORG_UNIT_TYPES = [
  { value: 'company', label: 'บริษัท' },
  { value: 'site', label: 'สาขา' },
  { value: 'division', label: 'ฝ่าย' },
  { value: 'department', label: 'แผนก' },
  { value: 'section', label: 'หมวด' },
  { value: 'unit', label: 'หน่วย' },
];

async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const response = await fetch('/api/hr/org-units?isActive=true');
  if (!response.ok) {
    throw new Error('Failed to fetch organization units');
  }
  const result = await response.json();
  return result.data || [];
}

async function createOrgUnit(data: OrgUnitCreate): Promise<OrgUnit> {
  const response = await fetch('/api/hr/org-units', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create organization unit');
  }
  const result = await response.json();
  return result.data;
}

async function updateOrgUnit(id: number, data: OrgUnitUpdate): Promise<OrgUnit> {
  const response = await fetch(`/api/hr/org-units/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update organization unit');
  }
  const result = await response.json();
  return result.data;
}

async function deleteOrgUnit(id: number): Promise<void> {
  const response = await fetch(`/api/hr/org-units/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to deactivate organization unit');
  }
}

export function OrgChartTree({
  height = 600,
  onSelectionChange,
  editable = true,
  className,
}: OrgChartTreeProps) {
  const [selectedRowKey, setSelectedRowKey] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: orgUnits = [], isLoading } = useQuery({
    queryKey: ['hr', 'org-units'],
    queryFn: fetchOrgUnits,
  });

  // Transform to flat data for TreeList
  const flatData = useMemo((): FlatOrgUnit[] => {
    return orgUnits.map(unit => ({
      ...unit,
      hasItems: orgUnits.some(u => u.parentId === unit.id),
    }));
  }, [orgUnits]);

  const createMutation = useMutation({
    mutationFn: createOrgUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'org-units'] });
      toast.success('สร้างหน่วยงานสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OrgUnitUpdate }) =>
      updateOrgUnit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'org-units'] });
      toast.success('แก้ไขหน่วยงานสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrgUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'org-units'] });
      toast.success('ปิดการใช้งานหน่วยงานสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const handleSelectionChanged = useCallback(
    (e: SelectionChangedEvent<FlatOrgUnit, number>) => {
      const selected = e.selectedRowsData?.[0] || null;
      setSelectedRowKey(selected?.id || null);
      onSelectionChange?.(selected);
    },
    [onSelectionChange]
  );

  const handleRowInserting = useCallback(
    (e: RowInsertingEvent<FlatOrgUnit, number>) => {
      e.cancel = new Promise<void>((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        const data = e.data as Partial<OrgUnitCreate>;
        createMutation.mutateAsync({
          code: data.code || '',
          name: data.name || '',
          nameEn: data.nameEn || undefined,
          type: data.type || 'department',
          parentId: data.parentId ?? null,
          siteId: data.siteId ?? null,
          isGmpCritical: data.isGmpCritical || false,
          effectiveFrom: data.effectiveFrom || today,
          effectiveTo: data.effectiveTo ?? null,
        }).then(() => resolve()).catch(reject);
      });
    },
    [createMutation]
  );

  const handleRowUpdating = useCallback(
    (e: RowUpdatingEvent<FlatOrgUnit, number>) => {
      e.cancel = new Promise<void>((resolve, reject) => {
        const newData = e.newData as Partial<FlatOrgUnit>;
        updateMutation.mutateAsync({
          id: e.oldData!.id,
          data: {
            name: newData.name,
            nameEn: newData.nameEn ?? undefined,
            parentId: newData.parentId,
            isGmpCritical: newData.isGmpCritical,
            effectiveTo: newData.effectiveTo ?? undefined,
          },
        }).then(() => resolve()).catch(reject);
      });
    },
    [updateMutation]
  );

  const handleRowRemoving = useCallback(
    (e: RowRemovingEvent<FlatOrgUnit, number>) => {
      e.cancel = new Promise<void>((resolve, reject) => {
        deleteMutation.mutateAsync(e.data!.id).then(() => resolve()).catch(reject);
      });
    },
    [deleteMutation]
  );

  const parentLookupData = useMemo(() => {
    return [{ id: null, displayName: '(รากของต้นไม้)' }, ...flatData.map(u => ({
      id: u.id,
      displayName: `${u.code} - ${u.name}`,
    }))];
  }, [flatData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <TreeList
      dataSource={flatData}
      keyExpr="id"
      parentIdExpr="parentId"
      hasItemsExpr="hasItems"
      showRowLines
      showBorders
      columnAutoWidth
      allowColumnReordering
      allowColumnResizing
      rowAlternationEnabled
      height={height}
      className={className}
      selectedRowKeys={selectedRowKey ? [selectedRowKey] : []}
      onSelectionChanged={handleSelectionChanged}
      onRowInserting={handleRowInserting}
      onRowUpdating={handleRowUpdating}
      onRowRemoving={handleRowRemoving}
      autoExpandAll
      wordWrapEnabled
    >
      <Selection mode="single" />
      <SearchPanel visible placeholder="ค้นหา..." />
      <HeaderFilter visible />
      <Scrolling mode="virtual" />
      <Sorting mode="multiple" />
      <ColumnChooser enabled mode="select" />

      {editable && (
        <Editing
          mode="popup"
          allowAdding
          allowUpdating
          allowDeleting
          useIcons
          popup={{
            title: 'หน่วยงาน',
            showTitle: true,
            width: 600,
            height: 'auto',
          }}
          texts={{
            saveRowChanges: 'บันทึก',
            cancelRowChanges: 'ยกเลิก',
            deleteRow: 'ปิดการใช้งาน',
            confirmDeleteMessage: 'ต้องการปิดการใช้งานหน่วยงานนี้หรือไม่?',
            addRow: 'เพิ่มหน่วยงาน',
            editRow: 'แก้ไข',
          }}
        />
      )}

      <Column dataField="code" caption="รหัส" width={100} allowEditing />
      <Column dataField="name" caption="ชื่อหน่วยงาน" minWidth={200} allowEditing />
      <Column dataField="nameEn" caption="ชื่อ (อังกฤษ)" width={200} visible={false} allowEditing />
      <Column dataField="type" caption="ประเภท" width={120} allowEditing>
        <Lookup dataSource={ORG_UNIT_TYPES} valueExpr="value" displayExpr="label" />
      </Column>
      <Column dataField="parentId" caption="หน่วยงานหลัก" width={200} visible={false} allowEditing>
        <Lookup
          dataSource={parentLookupData}
          valueExpr="id"
          displayExpr="displayName"
          allowClearing
        />
      </Column>
      <Column
        dataField="isGmpCritical"
        caption="GMP Critical"
        width={100}
        dataType="boolean"
        allowEditing
      />
      <Column
        dataField="effectiveFrom"
        caption="วันที่เริ่มต้น"
        width={120}
        dataType="date"
        format="dd/MM/yyyy"
        allowEditing
      />
      <Column
        dataField="effectiveTo"
        caption="วันที่สิ้นสุด"
        width={120}
        dataType="date"
        format="dd/MM/yyyy"
        visible={false}
        allowEditing
      />
      <Column
        dataField="isActive"
        caption="สถานะ"
        width={80}
        dataType="boolean"
        allowEditing={false}
        cellRender={(cellData: { value: boolean }) => (
          <span className={cellData.value ? 'text-green-600' : 'text-red-600'}>
            {cellData.value ? 'ใช้งาน' : 'ปิดใช้งาน'}
          </span>
        )}
      />
    </TreeList>
  );
}
