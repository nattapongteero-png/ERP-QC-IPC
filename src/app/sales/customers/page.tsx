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

interface Customer {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  isActive: boolean;
}

const customerTypes = [
  { value: '', label: 'All Types' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'traditional_medicine', label: 'Traditional Medicine' },
  { value: 'spa_wellness', label: 'Spa & Wellness' },
  { value: 'government', label: 'Government' },
  { value: 'export', label: 'Export' },
  { value: 'other', label: 'Other' },
];

const activeStatuses = [
  { value: '', label: 'All Statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (typeFilter) params.set('customerType', typeFilter);
      if (activeFilter) params.set('isActive', activeFilter);

      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();

      if (data.success) {
        setCustomers(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, typeFilter, activeFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCustomers();
  };

  const getTypeVariant = (
    type: string
  ): 'success' | 'info' | 'warning' | 'default' => {
    switch (type) {
      case 'hospital':
      case 'clinic':
        return 'success';
      case 'pharmacy':
      case 'distributor':
        return 'info';
      case 'government':
      case 'traditional_medicine':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatCustomerType = (type: string): string => {
    const typeMap: Record<string, string> = {
      hospital: 'Hospital',
      clinic: 'Clinic',
      pharmacy: 'Pharmacy',
      distributor: 'Distributor',
      traditional_medicine: 'Traditional Medicine',
      spa_wellness: 'Spa & Wellness',
      government: 'Government',
      export: 'Export',
      other: 'Other',
    };
    return typeMap[type] || type;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'contactPerson',
      header: 'Contact Person',
      render: (c: Customer) => c.contactPerson || '-',
    },
    { key: 'phone', header: 'Phone', render: (c: Customer) => c.phone || '-' },
    { key: 'email', header: 'Email', render: (c: Customer) => c.email || '-' },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      render: (c: Customer) => formatCurrency(c.creditLimit),
    },
    {
      key: 'creditTermDays',
      header: 'Credit Term',
      render: (c: Customer) =>
        c.creditTermDays ? `${c.creditTermDays} days` : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Customer) => (
        <div className="flex gap-1 flex-wrap">
          <Badge variant={getTypeVariant(c.customerType)}>
            {formatCustomerType(c.customerType)}
          </Badge>
          {!c.isActive && (
            <Badge variant="danger" dot>
              Inactive
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="จัดการข้อมูลลูกค้า"
          actions={
            <Button
              onClick={() => router.push('/sales/customers/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Customer
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
                  placeholder="Search by code, name, email, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={customerTypes}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                />
              </div>
              <div className="w-full md:w-32">
                <Select
                  options={activeStatuses}
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
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
            ) : customers.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={customers}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No customers found"
                  onRowClick={(customer) =>
                    router.push(`/sales/customers/${customer.id}`)
                  }
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
                      of {pagination.total} customers
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
                title="No customers found"
                description="Get started by adding your first customer"
                action={{
                  label: 'New Customer',
                  onClick: () => router.push('/sales/customers/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
