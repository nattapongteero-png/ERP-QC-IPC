"use client";

import { useMemo } from 'react';
import Diagram, {
  Nodes,
  AutoLayout,
  ContextToolbox,
  PropertiesPanel,
  Toolbox,
} from 'devextreme-react/diagram';
import { useQuery } from '@tanstack/react-query';
import type { OrgUnit } from '@/types/hr';

export interface OrgChartDiagramProps {
  /** Height of the diagram */
  height?: number | string;
  /** Called when a node is selected */
  onNodeClick?: (orgUnit: OrgUnit | null) => void;
  /** Show toolbox for editing */
  showToolbox?: boolean;
  /** Additional CSS class */
  className?: string;
}

interface DiagramNode {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  text: string;
}

const TYPE_COLORS: Record<string, string> = {
  company: '#1a365d',
  site: '#2c5282',
  division: '#2b6cb0',
  department: '#3182ce',
  section: '#4299e1',
  unit: '#63b3ed',
};

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

export function OrgChartDiagram({
  height = 600,
  onNodeClick,
  showToolbox = false,
  className,
}: OrgChartDiagramProps) {
  const { data: orgUnits = [], isLoading } = useQuery({
    queryKey: ['hr', 'org-units'],
    queryFn: fetchOrgUnits,
  });

  const diagramNodes = useMemo((): DiagramNode[] => {
    return orgUnits.map(unit => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      type: unit.type,
      parentId: unit.parentId,
      text: `${unit.code}\n${unit.name}`,
    }));
  }, [orgUnits]);

  const handleSelectionChanged = (e: { items: { dataItem?: DiagramNode }[] }) => {
    const selected = e.items[0]?.dataItem || null;
    if (selected && onNodeClick) {
      const orgUnit = orgUnits.find(u => u.id === selected.id);
      onNodeClick(orgUnit || null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <Diagram
      height={height}
      className={className}
      readOnly={!showToolbox}
      simpleView={!showToolbox}
      onSelectionChanged={handleSelectionChanged}
      units="px"
    >
      <Nodes
        dataSource={diagramNodes}
        keyExpr="id"
        textExpr="text"
        parentKeyExpr="parentId"
        typeExpr={() => 'rectangle'}
        styleExpr={(item: DiagramNode) => ({
          fill: TYPE_COLORS[item.type] || '#4a5568',
        })}
      />
      <AutoLayout type="tree" orientation="vertical" />
      {showToolbox && (
        <>
          <Toolbox visibility="visible" />
          <PropertiesPanel visibility="visible" />
          <ContextToolbox enabled />
        </>
      )}
    </Diagram>
  );
}
