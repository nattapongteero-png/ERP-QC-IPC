'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { PageHeader } from '@/components/ui/page-header';
import {
  User,
  Mail,
  Shield,
  Building2,
  Key,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface OrgUnit {
  id: number;
  name: string;
  type: string;
  isActive: boolean;
}

interface AppRole {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  department: string;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  department: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
  });

  const [roles, setRoles] = useState<AppRole[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'กรุณากรอกชื่อ-นามสกุล';
    }
    if (!formData.email.trim()) {
      return 'กรุณากรอกอีเมล';
    }
    if (!formData.email.includes('@')) {
      return 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    if (!formData.password) {
      return 'กรุณากรอกรหัสผ่าน';
    }
    if (formData.password.length < 6) {
      return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'รหัสผ่านไม่ตรงกัน';
    }
    return null;
  };

  useEffect(() => {
    const fetchLookupData = async () => {
      try {
        setIsLoadingOptions(true);

        const [rolesRes, orgUnitsRes] = await Promise.all([
          fetch('/api/hr/roles'),
          fetch('/api/hr/org-units'),
        ]);

        const rolesData = await rolesRes.json();
        const orgUnitsData = await orgUnitsRes.json();

        if (rolesData.success && rolesData.data) {
          setRoles(rolesData.data);
          setFormData(prev => ({ ...prev, role: rolesData.data[0]?.code || '' }));
        }

        if (orgUnitsData.success && orgUnitsData.data) {
          setDepartments(orgUnitsData.data);
        }
      } catch (err) {
        console.error('Failed to fetch lookup data:', err);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchLookupData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          department: formData.department || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('สร้างผู้ใช้สำเร็จ');
        setTimeout(() => {
          router.push('/users');
        }, 1500);
      } else {
        setError(data.error || 'ไม่สามารถสร้างผู้ใช้ได้');
      }
    } catch (err) {
      console.error('Failed to create user:', err);
      setError('เกิดข้อผิดพลาดในการสร้างผู้ใช้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <PageHeader
          title="สร้างผู้ใช้ใหม่"
          description="เพิ่มผู้ใช้งานใหม่เข้าสู่ระบบ"
        />

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              ข้อมูลผู้ใช้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    ชื่อ-นามสกุล *
                  </label>
                  <DxTextBox
                    value={formData.name}
                    onValueChange={(value) => setFormData({ ...formData, name: value })}
                    placeholder="กรอกชื่อ-นามสกุล"
                    mode="text"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    อีเมล *
                  </label>
                  <DxTextBox
                    value={formData.email}
                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                    placeholder="กรอกอีเมล"
                    mode="email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    บทบาท *
                  </label>
                  <DxSelectBox
                    items={roles.map(r => ({ value: r.code, label: r.name || r.code }))}
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as string })}
                    valueExpr="value"
                    displayExpr="label"
                    disabled={isLoadingOptions}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    แผนก
                  </label>
                  <DxSelectBox
                    items={departments.map(d => ({ value: d.id.toString(), label: d.name }))}
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value as string })}
                    valueExpr="value"
                    displayExpr="label"
                    searchEnabled
                    disabled={isLoadingOptions}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    รหัสผ่าน *
                  </label>
                  <div className="relative">
                    <DxTextBox
                      value={formData.password}
                      onValueChange={(value) => setFormData({ ...formData, password: value })}
                      placeholder="กรอกรหัสผ่าน"
                      mode={showPassword ? 'text' : 'password'}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    ยืนยันรหัสผ่าน *
                  </label>
                  <DxTextBox
                    value={formData.confirmPassword}
                    onValueChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    mode="password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <DxButton
                  text="ยกเลิก"
                  type="default"
                  stylingMode="outlined"
                  onClick={() => router.push('/users')}
                />
                <DxButton
                  text="บันทึก"
                  type="success"
                  icon="save"
                  useSubmitBehavior
                  disabled={isSubmitting}
                />
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center py-4">
                  <DxLoadIndicator />
                  <span className="ml-2 text-gray-600">กำลังบันทึก...</span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {isLoadingOptions && (
          <div className="flex items-center justify-center py-4">
            <DxLoadIndicator />
            <span className="ml-2 text-gray-600">กำลังโหลดข้อมูล...</span>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
