"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import TreeView from 'devextreme-react/tree-view';
import DropDownBox from 'devextreme-react/drop-down-box';
import { useQuery } from '@tanstack/react-query';
import type { OrgUnitTreeNode } from '@/types/hr';
import type { ItemClickEvent } from 'devextreme/ui/tree_view';
import type { OptionChangedEvent } from 'devextreme/ui/drop_down_box';

export interface OrgUnitPickerProps {
  /** Current value (org unit ID) */
  value?: number | null;
  /** Change handler */
  onValueChange?: (value: number | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Required field */
  required?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Width */
  width?: number | string;
  /** Filter by org unit type */
  filterByType?: string | string[];
  /** Exclude specific org unit ID and its descendants */
  excludeId?: number;
  /** Additional CSS class */
  className?: string;
}

interface TreeItem {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  items?: TreeItem[];
}

async function fetchOrgUnitTree(): Promise<OrgUnitTreeNode[]> {
  const response = await fetch('/api/hr/org-units/tree');
  if (!response.ok) {
    throw new Error('Failed to fetch organization units');
  }
  const result = await response.json();
  return result.data || [];
}

function transformToTreeItems(
  nodes: OrgUnitTreeNode[],
  excludeId?: number
): TreeItem[] {
  return nodes
    .filter(node => node.id !== excludeId)
    .map(node => ({
      id: node.id,
      code: node.code,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      items: node.children?.length
        ? transformToTreeItems(node.children, excludeId)
        : undefined,
    }));
}

function findNodeById(nodes: OrgUnitTreeNode[], id: number): OrgUnitTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children || [], id);
    if (found) return found;
  }
  return null;
}

export function OrgUnitPicker({
  value,
  onValueChange,
  placeholder = 'เลือกหน่วยงาน...',
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  showClearButton = true,
  width,
  excludeId,
  className,
}: OrgUnitPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>('');

  const { data: treeData = [], isLoading } = useQuery({
    queryKey: ['hr', 'org-units', 'tree'],
    queryFn: fetchOrgUnitTree,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform tree data for DevExtreme TreeView
  const treeItems = useMemo(
    () => transformToTreeItems(treeData, excludeId),
    [treeData, excludeId]
  );

  // Update display value when value or data changes
  useEffect(() => {
    if (value && treeData.length > 0) {
      const node = findNodeById(treeData, value);
      if (node) {
        setDisplayValue(`${node.code} - ${node.name}`);
      } else {
        setDisplayValue('');
      }
    } else {
      setDisplayValue('');
    }
  }, [value, treeData]);

  const handleItemClick = useCallback(
    (e: ItemClickEvent) => {
      const itemData = e.itemData as TreeItem | undefined;
      if (itemData) {
        onValueChange?.(itemData.id);
        setIsOpen(false);
      }
    },
    [onValueChange]
  );

  const handleOptionChanged = useCallback(
    (e: OptionChangedEvent) => {
      if (e.name === 'opened') {
        setIsOpen(e.value as boolean);
      }
      if (e.name === 'value' && e.value === null) {
        onValueChange?.(null);
        setDisplayValue('');
      }
    },
    [onValueChange]
  );

  const typeLabels: Record<string, string> = {
    company: 'บริษัท',
    site: 'สาขา',
    division: 'ฝ่าย',
    department: 'แผนก',
    section: 'หมวด',
    unit: 'หน่วย',
  };

  const renderTreeItem = (item: TreeItem) => {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="font-medium">{item.code}</span>
        <span className="text-gray-600">-</span>
        <span>{item.name}</span>
        <span className="text-xs text-gray-400 ml-auto">
          ({typeLabels[item.type] || item.type})
        </span>
      </div>
    );
  };

  const renderDropDownContent = () => {
    if (isLoading) {
      return <div className="p-4 text-center text-gray-500">กำลังโหลด...</div>;
    }

    return (
      <TreeView
        items={treeItems as unknown as object[]}
        dataStructure="tree"
        keyExpr="id"
        displayExpr="name"
        itemsExpr="items"
        selectionMode="single"
        selectByClick
        onItemClick={handleItemClick}
        itemRender={renderTreeItem as (item: object) => React.ReactNode}
        searchEnabled
        searchExpr={['code', 'name']}
        height={300}
      />
    );
  };

  return (
    <DropDownBox
      value={value}
      opened={isOpen}
      onOptionChanged={handleOptionChanged}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled || isLoading}
      readOnly={readOnly}
      showClearButton={showClearButton && !!value}
      width={width}
      className={className}
      contentRender={renderDropDownContent}
      dropDownOptions={{
        width: 450,
        height: 'auto',
      }}
      fieldRender={() => (
        <div className="dx-texteditor-input-container">
          <input
            className="dx-texteditor-input"
            value={displayValue}
            readOnly
            placeholder={placeholder}
          />
        </div>
      )}
    />
  );
}
