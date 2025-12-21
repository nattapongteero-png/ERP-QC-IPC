'use client';

// HR Organization Chart Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { OrgChartTree, OrgChartDiagram } from '@/components/hr';
import { Badge } from '@/components/ui/badge';
import { OrgUnit } from '@/types/hr';
import { Building2, Users, Network, List, GitBranch } from 'lucide-react';

type ViewMode = 'tree' | 'diagram';

const TYPE_LABELS: Record<string, string> = {
  company: 'บริษัท',
  site: 'สาขา',
  division: 'ฝ่าย',
  department: 'แผนก',
  section: 'หมวด',
  unit: 'หน่วย',
};

export default function OrgChartPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<OrgUnit | null>(null);

  const handleSelectionChange = useCallback((orgUnit: OrgUnit | null) => {
    setSelectedOrgUnit(orgUnit);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            โครงสร้างองค์กร
          </h1>
          <p className="text-gray-500 mt-1">
            Organization Structure
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                ${viewMode === 'tree'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <List className="h-4 w-4" />
              <span>Tree View</span>
            </button>
            <button
              onClick={() => setViewMode('diagram')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                ${viewMode === 'diagram'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <GitBranch className="h-4 w-4" />
              <span>Diagram</span>
            </button>
          </div>

          <DxButton
            icon="refresh"
            text="Refresh"
            type="default"
            stylingMode="outlined"
            onClick={() => window.location.reload()}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Org Chart View */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {viewMode === 'tree' ? (
            <OrgChartTree
              height={600}
              onSelectionChange={handleSelectionChange}
              editable
            />
          ) : (
            <OrgChartDiagram
              height={600}
              onNodeClick={handleSelectionChange}
            />
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Selected Unit Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              ข้อมูลหน่วยงาน
            </h3>

            {selectedOrgUnit ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Network className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedOrgUnit.code}</p>
                    <p className="text-sm text-gray-600">{selectedOrgUnit.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">ประเภท</p>
                    <Badge variant="default" className="mt-1">
                      {TYPE_LABELS[selectedOrgUnit.type] || selectedOrgUnit.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">สถานะ</p>
                    <Badge
                      variant={selectedOrgUnit.isActive ? 'success' : 'danger'}
                      className="mt-1"
                    >
                      {selectedOrgUnit.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </div>
                </div>

                {selectedOrgUnit.nameEn && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">ชื่อภาษาอังกฤษ</p>
                    <p className="text-sm text-gray-900 mt-1">{selectedOrgUnit.nameEn}</p>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">วันที่มีผล</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(selectedOrgUnit.effectiveFrom).toLocaleDateString('th-TH')}
                    {selectedOrgUnit.effectiveTo && (
                      <> ถึง {new Date(selectedOrgUnit.effectiveTo).toLocaleDateString('th-TH')}</>
                    )}
                  </p>
                </div>

                {selectedOrgUnit.isGmpCritical && (
                  <div className="pt-3 border-t border-gray-100">
                    <Badge variant="warning" className="w-full justify-center">
                      GMP Critical Area
                    </Badge>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <DxButton
                    icon="user"
                    text="ดูพนักงาน"
                    type="default"
                    stylingMode="outlined"
                    width="100%"
                    onClick={() => {
                      window.location.href = `/hr/employees?orgUnitId=${selectedOrgUnit.id}`;
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  เลือกหน่วยงานจาก{viewMode === 'tree' ? 'ตาราง' : 'แผนผัง'}เพื่อดูรายละเอียด
                </p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              คำอธิบายประเภท
            </h3>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-4 h-4 rounded"
                    style={{
                      backgroundColor:
                        key === 'company' ? '#1a365d' :
                        key === 'site' ? '#2c5282' :
                        key === 'division' ? '#2b6cb0' :
                        key === 'department' ? '#3182ce' :
                        key === 'section' ? '#4299e1' :
                        '#63b3ed'
                    }}
                  />
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              สถิติ
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">-</p>
                <p className="text-xs text-gray-500">หน่วยงาน</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">-</p>
                <p className="text-xs text-gray-500">พนักงาน</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
