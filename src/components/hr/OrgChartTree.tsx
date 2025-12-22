"use client";

import { useCallback, useState, useMemo, useRef } from 'react';
import TreeList, { Column, Editing, Selection, SearchPanel, HeaderFilter, Scrolling, Sorting, ColumnChooser, Lookup } from 'devextreme-react/tree-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buddhistDateFormat } from '@/components/ui/dx-date-box';
import { useToast } from '@/components/ui/toast';
import type { OrgUnit, OrgUnitCreate, OrgUnitUpdate } from '@/types/hr';
import type { RowInsertingEvent, RowUpdatingEvent, RowRemovingEvent, InitNewRowEvent, EditorPreparingEvent } from 'devextreme/ui/tree_list';
import type { SelectionChangedEvent } from 'devextreme/ui/tree_list';
import {
  Building2,
  Factory,
  Layers,
  FolderTree,
  Users,
  Box,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';

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

// Type styling configuration
const TYPE_CONFIG: Record<string, {
  icon: typeof Building2;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  company: {
    icon: Building2,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
  },
  site: {
    icon: Factory,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  division: {
    icon: Layers,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  department: {
    icon: FolderTree,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  section: {
    icon: Users,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  unit: {
    icon: Box,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
};

// Prefix mapping for auto-generating codes
const ORG_TYPE_PREFIXES: Record<string, string> = {
  company: 'COMP',
  site: 'SITE',
  division: 'DIV',
  department: 'DEPT',
  section: 'SEC',
  unit: 'UNIT',
};

/**
 * Generate next org unit code based on existing codes
 */
function generateNextCode(existingCodes: string[], type: string): string {
  const prefix = ORG_TYPE_PREFIXES[type] || 'ORG';

  // Find existing codes with this prefix
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const numbers = existingCodes
    .map(code => {
      const match = code.match(pattern);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNumber = maxNumber + 1;

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const response = await fetch('/api/hr/org-units?isActive=true');
  if (!response.ok) {
    throw new Error('Failed to fetch organization units');
  }
  const result = await response.json();
  // API returns { success: true, data: { data: orgUnits } }
  const data = result.data?.data || result.data;
  return Array.isArray(data) ? data : [];
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
  const isInsertingRef = useRef(false);
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

  // Get all existing codes for auto-generation
  const existingCodes = useMemo(() => orgUnits.map(u => u.code), [orgUnits]);

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

  // Handle new row initialization - auto-generate code
  const handleInitNewRow = useCallback(
    (e: InitNewRowEvent<FlatOrgUnit, number>) => {
      isInsertingRef.current = true;
      const defaultType = 'department';
      const generatedCode = generateNextCode(existingCodes, defaultType);

      e.data = {
        ...e.data,
        code: generatedCode,
        type: defaultType,
        isGmpCritical: false,
        effectiveFrom: new Date().toISOString().split('T')[0],
      } as FlatOrgUnit;
    },
    [existingCodes]
  );

  // Handle editor preparation - make code read-only when editing existing row
  const handleEditorPreparing = useCallback(
    (e: EditorPreparingEvent<FlatOrgUnit, number>) => {
      if (e.dataField === 'code' && e.parentType === 'dataRow') {
        // Check if this is an edit (not insert) by checking if the row has an id
        if (!isInsertingRef.current) {
          e.editorOptions.readOnly = true;
        }
      }

      // Regenerate code when type changes during insert
      if (e.dataField === 'type' && isInsertingRef.current && e.parentType === 'dataRow') {
        const originalOnValueChanged = e.editorOptions.onValueChanged;
        e.editorOptions.onValueChanged = (args: { value: string }) => {
          if (originalOnValueChanged) {
            originalOnValueChanged(args);
          }
          // Update the code based on new type
          const newCode = generateNextCode(existingCodes, args.value);
          if (e.row?.data) {
            e.row.data.code = newCode;
          }
          // Refresh the code cell
          e.component?.cellValue(e.row!.rowIndex, 'code', newCode);
        };
      }
    },
    [existingCodes]
  );

  // Reset inserting flag when editing ends
  const handleEditingStart = useCallback(() => {
    isInsertingRef.current = false;
  }, []);

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
      onInitNewRow={handleInitNewRow}
      onEditingStart={handleEditingStart}
      onEditorPreparing={handleEditorPreparing}
      onRowInserting={handleRowInserting}
      onRowUpdating={handleRowUpdating}
      onRowRemoving={handleRowRemoving}
      autoExpandAll
      wordWrapEnabled
    >
      <Selection mode="single" />
      <SearchPanel visible placeholder="ค้นหา..." />
      <HeaderFilter visible />
      <Scrolling mode="standard" />
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

      {/* Organization Unit - Combined code, name with icon */}
      <Column
        dataField="name"
        caption="หน่วยงาน"
        minWidth={280}
        allowEditing
        cellRender={(cellData: { data: FlatOrgUnit }) => {
          const unit = cellData.data;
          const config = TYPE_CONFIG[unit.type] || TYPE_CONFIG.department;
          const Icon = config.icon;
          const typeLabel = ORG_UNIT_TYPES.find(t => t.value === unit.type)?.label || unit.type;

          return (
            <div className="flex items-center gap-3 py-1">
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                <Icon className={`h-4.5 w-4.5 ${config.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">{unit.name}</span>
                  {unit.isGmpCritical && (
                    <ShieldCheck className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {unit.code}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                    {typeLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* Code - Hidden in grid, shown in edit form */}
      <Column dataField="code" caption="รหัส" width={100} visible={false} allowEditing />

      {/* Name English - Hidden */}
      <Column dataField="nameEn" caption="ชื่อ (อังกฤษ)" width={200} visible={false} allowEditing />

      {/* Type - Hidden in grid (shown in combined cell), visible in edit */}
      <Column dataField="type" caption="ประเภท" width={120} visible={false} allowEditing>
        <Lookup dataSource={ORG_UNIT_TYPES} valueExpr="value" displayExpr="label" />
      </Column>

      {/* Parent - Hidden */}
      <Column dataField="parentId" caption="หน่วยงานหลัก" width={200} visible={false} allowEditing>
        <Lookup
          dataSource={parentLookupData}
          valueExpr="id"
          displayExpr="displayName"
          allowClearing
        />
      </Column>

      {/* GMP Critical - Professional badge */}
      <Column
        dataField="isGmpCritical"
        caption="GMP"
        width={110}
        dataType="boolean"
        alignment="center"
        allowEditing
        cellRender={(cellData: { value: boolean }) => (
          cellData.value ? (
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Shield className="h-3.5 w-3.5" />
                Critical
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-xs text-gray-400">—</span>
            </div>
          )
        )}
      />

      {/* Effective Date - With icon */}
      <Column
        dataField="effectiveFrom"
        caption="เริ่มใช้งาน"
        width={140}
        dataType="date"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        format={buddhistDateFormat as any}
        allowEditing
        editorOptions={{
          displayFormat: buddhistDateFormat,
          type: 'date',
        }}
        cellRender={(cellData: { value: Date | string | null }) => {
          if (!cellData.value) return <span className="text-gray-400">—</span>;
          const date = new Date(cellData.value);
          const thaiYear = date.getFullYear() + 543;
          const formatted = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${thaiYear}`;
          return (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm">{formatted}</span>
            </div>
          );
        }}
      />

      {/* Effective To - Hidden */}
      <Column
        dataField="effectiveTo"
        caption="วันที่สิ้นสุด"
        width={120}
        dataType="date"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        format={buddhistDateFormat as any}
        visible={false}
        allowEditing
        editorOptions={{
          displayFormat: buddhistDateFormat,
          type: 'date',
        }}
      />

      {/* Status - Professional badge */}
      <Column
        dataField="isActive"
        caption="สถานะ"
        width={110}
        dataType="boolean"
        alignment="center"
        allowEditing={false}
        cellRender={(cellData: { value: boolean }) => (
          <div className="flex items-center justify-center">
            {cellData.value ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ใช้งาน
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                <XCircle className="h-3.5 w-3.5" />
                ปิด
              </span>
            )}
          </div>
        )}
      />
    </TreeList>
  );
}
