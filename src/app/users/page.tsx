'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTabs } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  Briefcase,
  Building2,
  TrendingUp,
  Mail,
  Calendar
} from 'lucide-react';
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

interface UsersSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  recentUsers: number;
  thisWeekUsers: number;
  byRole: { role: string; count: number }[];
  byDepartment: { department: string; count: number }[];
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
  { value: 'hr', label: 'ฝ่ายบุคคล' },
  { value: 'user', label: 'ผู้ใช้ทั่วไป' },
];

const getRoleConfig = (role: string): {
  variant: 'success' | 'info' | 'warning' | 'danger' | 'default';
  icon: React.ReactNode;
  bgColor: string;
  barColor: string;
} => {
  switch (role) {
    case 'admin':
      return { variant: 'danger', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-red-100', barColor: 'bg-red-500' };
    case 'manager':
      return { variant: 'warning', icon: <Briefcase className="h-4 w-4" />, bgColor: 'bg-orange-100', barColor: 'bg-orange-500' };
    case 'production':
      return { variant: 'success', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-green-100', barColor: 'bg-green-500' };
    case 'qc':
      return { variant: 'success', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-emerald-100', barColor: 'bg-emerald-500' };
    case 'warehouse':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-blue-100', barColor: 'bg-blue-500' };
    case 'purchasing':
      return { variant: 'info', icon: <Briefcase className="h-4 w-4" />, bgColor: 'bg-cyan-100', barColor: 'bg-cyan-500' };
    case 'sales':
      return { variant: 'info', icon: <TrendingUp className="h-4 w-4" />, bgColor: 'bg-indigo-100', barColor: 'bg-indigo-500' };
    case 'accounting':
      return { variant: 'info', icon: <Briefcase className="h-4 w-4" />, bgColor: 'bg-violet-100', barColor: 'bg-violet-500' };
    case 'hr':
      return { variant: 'info', icon: <Users className="h-4 w-4" />, bgColor: 'bg-pink-100', barColor: 'bg-pink-500' };
    default:
      return { variant: 'default', icon: <Users className="h-4 w-4" />, bgColor: 'bg-gray-100', barColor: 'bg-gray-500' };
  }
};

const formatRole = (role: string): string => {
  const found = roleOptions.find(r => r.value === role);
  return found ? found.label : role;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

type TabId = 'all' | 'active' | 'inactive';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<UsersSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await fetch('/api/users/summary');
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.data?.items || []);
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
  }, [roleFilter]);

  useEffect(() => {
    fetchSummary();
    fetchUsers();
  }, [fetchSummary, fetchUsers]);

  // Filter users based on search and tab
  const filteredUsers = useMemo(() => {
    let result = users;

    // Filter by tab
    if (activeTab === 'active') {
      result = result.filter(u => u.isActive);
    } else if (activeTab === 'inactive') {
      result = result.filter(u => !u.isActive);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(user =>
        user.email?.toLowerCase().includes(searchLower) ||
        user.name?.toLowerCase().includes(searchLower) ||
        user.department?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [users, activeTab, search]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/users/${e.data.id}`);
    }
  };

  const tabIds: TabId[] = ['all', 'active', 'inactive'];
  const tabs = [
    { id: 0, text: 'ทั้งหมด', icon: 'group' },
    { id: 1, text: 'ใช้งาน', icon: 'check' },
    { id: 2, text: 'ปิดใช้งาน', icon: 'close' },
  ];

  // Grid columns
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'name',
      caption: 'ผู้ใช้งาน',
      minWidth: 250,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-3 py-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(cellInfo.data.name)}`}>
            {getInitials(cellInfo.data.name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{cellInfo.data.name}</p>
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <Mail className="h-3 w-3" />
              <span className="truncate">{cellInfo.data.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      dataField: 'role',
      caption: 'บทบาท',
      width: 150,
      cellRender: (cellInfo) => {
        const config = getRoleConfig(cellInfo.data.role);
        return (
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${config.bgColor}`}>
              {config.icon}
            </div>
            <Badge variant={config.variant}>
              {formatRole(cellInfo.data.role)}
            </Badge>
          </div>
        );
      },
    },
    {
      dataField: 'department',
      caption: 'แผนก',
      width: 150,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span>{cellInfo.data.department || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
    {
      dataField: 'createdAt',
      caption: 'สร้างเมื่อ',
      width: 140,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>{formatDate(cellInfo.data.createdAt)}</span>
        </div>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 80,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <DxButton
          icon="edit"
          type="normal"
          stylingMode="text"
          hint="แก้ไข"
          onClick={(e) => {
            e.event?.stopPropagation();
            router.push(`/users/${cellInfo.data.id}`);
          }}
        />
      ),
    },
  ];

  // Summary card component
  const SummaryCard = ({
    title,
    value,
    icon,
    color,
    bgColor,
    subtitle,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    subtitle?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {isSummaryLoading ? '-' : value.toLocaleString()}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${bgColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Role distribution item
  const RoleItem = ({ role, count, total }: { role: string; count: number; total: number }) => {
    const config = getRoleConfig(role);
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-700">{formatRole(role)}</span>
            <span className="text-sm text-gray-500">{count} คน</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${config.barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-medium text-gray-400 w-12 text-right">{percentage}%</span>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4 lg:gap-6">
        {/* Header */}
        <PageHeader
          title="จัดการผู้ใช้งาน"
          description="จัดการบัญชีผู้ใช้และกำหนดสิทธิ์การเข้าถึงระบบ"
          actions={
            <DxButton
              text="เพิ่มผู้ใช้"
              icon="plus"
              type="success"
              onClick={() => router.push('/users/new')}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="ผู้ใช้ทั้งหมด"
            value={summary?.totalUsers || 0}
            icon={<Users className="h-6 w-6 text-blue-600" />}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <SummaryCard
            title="ใช้งานอยู่"
            value={summary?.activeUsers || 0}
            icon={<UserCheck className="h-6 w-6 text-green-600" />}
            color="text-green-600"
            bgColor="bg-green-100"
          />
          <SummaryCard
            title="ปิดใช้งาน"
            value={summary?.inactiveUsers || 0}
            icon={<UserX className="h-6 w-6 text-red-600" />}
            color="text-red-600"
            bgColor="bg-red-100"
          />
          <SummaryCard
            title="เพิ่มใหม่ (30 วัน)"
            value={summary?.recentUsers || 0}
            icon={<UserPlus className="h-6 w-6 text-purple-600" />}
            color="text-purple-600"
            bgColor="bg-purple-100"
            subtitle={summary?.thisWeekUsers ? `${summary.thisWeekUsers} คนสัปดาห์นี้` : undefined}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 flex-1 min-h-0">
          {/* Role Distribution - Sidebar */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                การกระจายตามบทบาท
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isSummaryLoading ? (
                <div className="flex justify-center py-8">
                  <DxLoadIndicator />
                </div>
              ) : summary?.byRole && summary.byRole.length > 0 ? (
                <div className="space-y-1">
                  {summary.byRole.map(({ role, count }) => (
                    <RoleItem
                      key={role}
                      role={role}
                      count={count}
                      total={summary.totalUsers}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>

          {/* Users Grid - Main Content */}
          <Card className="lg:col-span-3 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <DxTabs
                    items={tabs}
                    selectedIndex={tabIds.indexOf(activeTab)}
                    onSelectedIndexChange={(index) => setActiveTab(tabIds[index])}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <DxTextBox
                    placeholder="ค้นหาชื่อ, อีเมล, แผนก..."
                    value={search}
                    onValueChange={setSearch}
                    showClearButton
                    mode="search"
                    width={220}
                  />
                  <DxSelectBox
                    items={roleOptions}
                    value={roleFilter}
                    onValueChange={(value) => {
                      setRoleFilter(value);
                    }}
                    placeholder="บทบาท"
                    showClearButton
                    width={160}
                  />
                  <DxButton
                    icon="refresh"
                    type="normal"
                    stylingMode="outlined"
                    hint="รีเฟรช"
                    onClick={() => {
                      fetchSummary();
                      fetchUsers();
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-0">
              {filteredUsers.length > 0 || isLoading ? (
                <DxDataGrid
                  dataSource={filteredUsers}
                  keyExpr="id"
                  columns={columns}
                  loading={isLoading}
                  sorting
                  filterRow
                  headerFilter
                  export
                  exportFileName="users"
                  columnChooser
                  virtualScrolling={filteredUsers.length > 100}
                  fillHeight
                  onRowClick={handleRowClick}
                  noDataText="ไม่พบผู้ใช้งาน"
                />
              ) : (
                <EmptyState
                  icon={<Users className="h-12 w-12" />}
                  title="ไม่พบผู้ใช้งาน"
                  description={
                    activeTab === 'inactive'
                      ? 'ไม่มีผู้ใช้งานที่ถูกปิดใช้งาน'
                      : search || roleFilter
                        ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                        : 'เริ่มต้นด้วยการเพิ่มผู้ใช้ใหม่'
                  }
                  action={
                    !search && !roleFilter && activeTab === 'all' ? {
                      label: 'เพิ่มผู้ใช้',
                      onClick: () => router.push('/users/new'),
                    } : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
