'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Users } from 'lucide-react';

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
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'production', label: 'Production' },
  { value: 'qc', label: 'QC' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'sales', label: 'Sales' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'user', label: 'User' },
];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, roleFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchUsers();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const getRoleVariant = (
    role: string
  ): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
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
    const roleMap: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      production: 'Production',
      qc: 'QC',
      warehouse: 'Warehouse',
      purchasing: 'Purchasing',
      sales: 'Sales',
      accounting: 'Accounting',
      user: 'User',
    };
    return roleMap[role] || role;
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => (
        <Badge variant={getRoleVariant(user.role)}>{formatRole(user.role)}</Badge>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (user: User) => user.department || '-',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (user: User) => (
        <Badge variant={user.isActive ? 'success' : 'danger'} dot>
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (user: User) => formatDate(user.createdAt),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="จัดการผู้ใช้งานระบบ"
          actions={
            <Button
              onClick={() => router.push('/users/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add User
            </Button>
          }
        />

        <Card elevation="raised">
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by email or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  options={roleOptions}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 bg-gray-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : users.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={users}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No users found"
                  onRowClick={(user) => router.push(`/users/${user.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.total
                      )}{' '}
                      of {pagination.total} users
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: prev.page - 1,
                          }))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          pagination.page * pagination.limit >= pagination.total
                        }
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: prev.page + 1,
                          }))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No users found"
                description="Get started by adding your first user"
                action={{
                  label: 'Add User',
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
