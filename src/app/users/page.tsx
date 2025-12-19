'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Inbox } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string;
  isActive: boolean;
  createdAt: string;
}

const roleOptions = [
  { value: '', label: 'ทุกบทบาท' },
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
  { value: 'manager', label: 'ผู้จัดการ' },
  { value: 'production', label: 'ฝ่ายผลิต' },
  { value: 'qc', label: 'ฝ่าย QC' },
  { value: 'warehouse', label: 'ฝ่ายคลัง' },
  { value: 'purchasing', label: 'ฝ่ายจัดซื้อ' },
  { value: 'sales', label: 'ฝ่ายขาย' },
  { value: 'accounting', label: 'ฝ่ายบัญชี' },
  { value: 'user', label: 'ผู้ใช้ทั่วไป' },
];

const getRoleVariant = (role: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  switch (role) {
    case 'admin':
      return 'danger';
    case 'manager':
      return 'warning';
    case 'production':
    case 'qc':
      return 'success';
    case 'warehouse':
    case 'purchasing':
    case 'sales':
      return 'info';
    default:
      return 'default';
  }
};

const formatRole = (role: string): string => {
  const found = roleOptions.find(r => r.value === role);
  return found ? found.label : role;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedUsers = data.data?.items || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedUsers = fetchedUsers.filter((user: User) =>
            user.email?.toLowerCase().includes(searchLower) ||
            user.name?.toLowerCase().includes(searchLower)
          );
        }

        setUsers(fetchedUsers);
      } else {
        console.error('API error:', data.error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/users/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'name',
      caption: 'ชื่อ',
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{cellInfo.data.name}</span>
        </div>
      ),
    },
    {
      dataField: 'email',
      caption: 'อีเมล',
      width: 220,
      hideOnMobile: true,
    },
    {
      dataField: 'role',
      caption: 'บทบาท',
      width: 130,
      cellRender: (cellInfo) => (
        <Badge variant={getRoleVariant(cellInfo.data.role)}>
          {formatRole(cellInfo.data.role)}
        </Badge>
      ),
    },
    {
      dataField: 'department',
      caption: 'แผนก',
      width: 150,
      hideOnMobile: true,
      cellRender: (cellInfo) => cellInfo.data.department || '-',
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
    {
      dataField: 'createdAt',
      caption: 'สร้างเมื่อ',
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => formatDate(cellInfo.data.createdAt),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="ผู้ใช้งาน"
          description="จัดการผู้ใช้งานระบบ"
          actions={
            <DxButton
              text="เพิ่มผู้ใช้"
              icon="plus"
              type="success"
              onClick={() => router.push('/users/new')}
            />
          }
        />

        {/* Filters Card */}
        <Card elevation="raised" className="md:py-1">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยอีเมลหรือชื่อ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchUsers()}
                />
              </div>
              <div className="w-full md:w-48">
                <DxSelectBox
                  items={roleOptions}
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                  placeholder="บทบาท"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col">
            {users.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={users}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="users"
                searchPanel
                columnChooser
                virtualScrolling={users.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบผู้ใช้งาน"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบผู้ใช้งาน"
                description="เริ่มต้นด้วยการเพิ่มผู้ใช้ใหม่"
                action={{
                  label: 'เพิ่มผู้ใช้',
                  onClick: () => router.push('/users/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
