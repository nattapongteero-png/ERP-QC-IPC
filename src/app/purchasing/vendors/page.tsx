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

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
}

const approvalStatuses = [
  { value: '', label: 'All Statuses' },
  { value: 'true', label: 'Approved' },
  { value: 'false', label: 'Not Approved' },
];

const vmiStatuses = [
  { value: '', label: 'All Types' },
  { value: 'true', label: 'VMI' },
  { value: 'false', label: 'Non-VMI' },
];

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [vmiFilter, setVmiFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (approvalFilter) params.set('isApproved', approvalFilter);
      if (vmiFilter) params.set('isVMI', vmiFilter);

      const res = await fetch(`/api/vendors?${params}`);
      const data = await res.json();

      if (data.success) {
        setVendors(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, approvalFilter, vmiFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchVendors();
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'contactPerson', header: 'Contact Person', render: (v: Vendor) => v.contactPerson || '-' },
    { key: 'phone', header: 'Phone', render: (v: Vendor) => v.phone || '-' },
    { key: 'email', header: 'Email', render: (v: Vendor) => v.email || '-' },
    {
      key: 'leadTimeDays',
      header: 'Lead Time',
      render: (v: Vendor) => v.leadTimeDays ? `${v.leadTimeDays} days` : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v: Vendor) => (
        <div className="flex gap-1">
          <Badge variant={v.isApproved ? 'success' : 'warning'} dot>
            {v.isApproved ? 'Approved' : 'Pending'}
          </Badge>
          {v.isVMI && (
            <Badge variant="info">VMI</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Vendors"
          description="จัดการข้อมูลผู้ขาย"
          actions={
            <Button onClick={() => router.push('/purchasing/vendors/new')} leftIcon={<Plus className="h-4 w-4" />}>
              New Vendor
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
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={approvalStatuses}
                  value={approvalFilter}
                  onChange={(e) => setApprovalFilter(e.target.value)}
                />
              </div>
              <div className="w-full md:w-32">
                <Select
                  options={vmiStatuses}
                  value={vmiFilter}
                  onChange={(e) => setVmiFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : vendors.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={vendors}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No vendors found"
                  onRowClick={(vendor) => router.push(`/purchasing/vendors/${vendor.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} vendors
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() =>
                          setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page * pagination.limit >= pagination.total}
                        onClick={() =>
                          setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
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
                title="No vendors found"
                description="Get started by adding your first vendor"
                action={{
                  label: 'New Vendor',
                  onClick: () => router.push('/purchasing/vendors/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
