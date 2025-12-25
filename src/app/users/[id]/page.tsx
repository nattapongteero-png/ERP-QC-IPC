'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Shield,
  Building2,
  Calendar,
  Clock,
  Key,
  Trash2,
  Save,
  ArrowLeft,
  UserCheck,
  UserX,
  Edit3,
  X,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UserData {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  name: string;
  email: string;
  role: string;
  department: string;
}

interface PasswordForm {
  newPassword: string;
  confirmPassword: string;
}

const roleOptions = [
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

const departmentOptions = [
  { value: '', label: 'ไม่ระบุ' },
  { value: 'ฝ่ายผลิต', label: 'ฝ่ายผลิต' },
  { value: 'ฝ่ายควบคุมคุณภาพ', label: 'ฝ่ายควบคุมคุณภาพ' },
  { value: 'ฝ่ายคลังสินค้า', label: 'ฝ่ายคลังสินค้า' },
  { value: 'ฝ่ายจัดซื้อ', label: 'ฝ่ายจัดซื้อ' },
  { value: 'ฝ่ายขาย', label: 'ฝ่ายขาย' },
  { value: 'ฝ่ายบัญชี', label: 'ฝ่ายบัญชี' },
  { value: 'ฝ่ายบุคคล', label: 'ฝ่ายบุคคล' },
  { value: 'ฝ่ายไอที', label: 'ฝ่ายไอที' },
  { value: 'ฝ่ายบริหาร', label: 'ฝ่ายบริหาร' },
];

const getRoleConfig = (role: string): {
  variant: 'success' | 'info' | 'warning' | 'danger' | 'default';
  icon: React.ReactNode;
  bgColor: string;
} => {
  switch (role) {
    case 'admin':
      return { variant: 'danger', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-red-100' };
    case 'manager':
      return { variant: 'warning', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-orange-100' };
    case 'production':
      return { variant: 'success', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-green-100' };
    case 'qc':
      return { variant: 'success', icon: <Shield className="h-4 w-4" />, bgColor: 'bg-emerald-100' };
    case 'warehouse':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-blue-100' };
    case 'purchasing':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-cyan-100' };
    case 'sales':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-indigo-100' };
    case 'accounting':
      return { variant: 'info', icon: <Building2 className="h-4 w-4" />, bgColor: 'bg-violet-100' };
    case 'hr':
      return { variant: 'info', icon: <User className="h-4 w-4" />, bgColor: 'bg-pink-100' };
    default:
      return { variant: 'default', icon: <User className="h-4 w-4" />, bgColor: 'bg-gray-100' };
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
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    email: '',
    role: '',
    department: '',
  });

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();

      if (data.success) {
        setUser(data.data);
        setEditForm({
          name: data.data.name || '',
          email: data.data.email || '',
          role: data.data.role || 'user',
          department: data.data.department || '',
        });
      } else {
        setError(data.error || 'ไม่พบข้อมูลผู้ใช้');
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('บันทึกข้อมูลสำเร็จ');
        setIsEditing(false);
        fetchUser();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordForm.newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('เปลี่ยนรหัสผ่านสำเร็จ');
        setShowPasswordSection(false);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setPasswordError(data.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setPasswordError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(user.isActive ? 'ปิดใช้งานผู้ใช้สำเร็จ' : 'เปิดใช้งานผู้ใช้สำเร็จ');
        fetchUser();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'ไม่สามารถเปลี่ยนสถานะได้');
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        router.push('/users');
      } else {
        setError(data.error || 'ไม่สามารถลบผู้ใช้ได้');
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError('เกิดข้อผิดพลาดในการลบผู้ใช้');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'user',
        department: user.department || '',
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-gray-400" />
          <p className="text-gray-500">{error || 'ไม่พบข้อมูลผู้ใช้'}</p>
          <DxButton
            text="กลับไปหน้ารายการ"
            icon="back"
            type="default"
            onClick={() => router.push('/users')}
          />
        </div>
      </MainLayout>
    );
  }

  const roleConfig = getRoleConfig(user.role);

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <DxButton
              icon="back"
              type="normal"
              stylingMode="outlined"
              hint="กลับ"
              onClick={() => router.push('/users')}
            />
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getAvatarColor(user.name)}`}>
                {getInitials(user.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={user.isActive ? 'success' : 'danger'} dot>
                    {user.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </Badge>
                  <Badge variant={roleConfig.variant}>
                    {formatRole(user.role)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <DxButton
                text="แก้ไข"
                icon="edit"
                type="default"
                onClick={() => setIsEditing(true)}
              />
            ) : (
              <>
                <DxButton
                  text="ยกเลิก"
                  icon="close"
                  type="normal"
                  stylingMode="outlined"
                  onClick={handleCancelEdit}
                />
                <DxButton
                  text="บันทึก"
                  icon="save"
                  type="success"
                  onClick={handleSave}
                  disabled={isSaving}
                />
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info - Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-400" />
                  ข้อมูลผู้ใช้
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      ชื่อ-นามสกุล
                    </label>
                    {isEditing ? (
                      <DxTextBox
                        value={editForm.name}
                        onValueChange={(value) => setEditForm({ ...editForm, name: value })}
                        placeholder="กรอกชื่อ-นามสกุล"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{user.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      อีเมล
                    </label>
                    {isEditing ? (
                      <DxTextBox
                        value={editForm.email}
                        onValueChange={(value) => setEditForm({ ...editForm, email: value })}
                        placeholder="กรอกอีเมล"
                        mode="email"
                      />
                    ) : (
                      <p className="text-gray-900">{user.email}</p>
                    )}
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      บทบาท
                    </label>
                    {isEditing ? (
                      <DxSelectBox
                        items={roleOptions}
                        value={editForm.role}
                        onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                        valueExpr="value"
                        displayExpr="label"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${roleConfig.bgColor}`}>
                          {roleConfig.icon}
                        </div>
                        <span className="text-gray-900">{formatRole(user.role)}</span>
                      </div>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      แผนก
                    </label>
                    {isEditing ? (
                      <DxSelectBox
                        items={departmentOptions}
                        value={editForm.department}
                        onValueChange={(value) => setEditForm({ ...editForm, department: value })}
                        valueExpr="value"
                        displayExpr="label"
                        searchEnabled
                      />
                    ) : (
                      <p className="text-gray-900">{user.department || '-'}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password Change Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-gray-400" />
                    เปลี่ยนรหัสผ่าน
                  </CardTitle>
                  {!showPasswordSection && (
                    <DxButton
                      text="เปลี่ยนรหัสผ่าน"
                      icon="key"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setShowPasswordSection(true)}
                    />
                  )}
                </div>
              </CardHeader>
              {showPasswordSection && (
                <CardContent>
                  <div className="space-y-4">
                    {passwordError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {passwordError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500">รหัสผ่านใหม่</label>
                        <div className="relative">
                          <DxTextBox
                            value={passwordForm.newPassword}
                            onValueChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
                            placeholder="กรอกรหัสผ่านใหม่"
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
                        <label className="text-sm font-medium text-gray-500">ยืนยันรหัสผ่าน</label>
                        <DxTextBox
                          value={passwordForm.confirmPassword}
                          onValueChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
                          placeholder="กรอกรหัสผ่านอีกครั้ง"
                          mode={showPassword ? 'text' : 'password'}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <DxButton
                        text="ยกเลิก"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => {
                          setShowPasswordSection(false);
                          setPasswordForm({ newPassword: '', confirmPassword: '' });
                          setPasswordError(null);
                        }}
                      />
                      <DxButton
                        text="เปลี่ยนรหัสผ่าน"
                        type="success"
                        icon="save"
                        onClick={handlePasswordChange}
                        disabled={isSaving || !passwordForm.newPassword}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {user.isActive ? (
                    <UserCheck className="h-5 w-5 text-green-500" />
                  ) : (
                    <UserX className="h-5 w-5 text-red-500" />
                  )}
                  สถานะการใช้งาน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant={user.isActive ? 'success' : 'danger'} dot className="text-base">
                      {user.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-2">
                      {user.isActive
                        ? 'ผู้ใช้สามารถเข้าสู่ระบบได้'
                        : 'ผู้ใช้ไม่สามารถเข้าสู่ระบบได้'}
                    </p>
                  </div>
                  <DxButton
                    text={user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    type={user.isActive ? 'danger' : 'success'}
                    stylingMode="outlined"
                    onClick={handleToggleStatus}
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Timestamps Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  ข้อมูลระบบ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">สร้างเมื่อ</p>
                    <p className="text-gray-900">{formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Edit3 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">แก้ไขล่าสุด</p>
                    <p className="text-gray-900">{formatDate(user.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">รหัสผู้ใช้</p>
                    <p className="text-gray-900 font-mono">#{user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  โซนอันตราย
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  การลบผู้ใช้จะเป็นการปิดใช้งานบัญชี (Soft Delete)
                  ข้อมูลจะยังคงอยู่ในระบบ
                </p>
                <DxButton
                  text="ลบผู้ใช้"
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(true)}
                  width="100%"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      <DxPopup
        visible={showDeleteConfirm}
        onHiding={() => setShowDeleteConfirm(false)}
        title="ยืนยันการลบผู้ใช้"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">ลบผู้ใช้ {user.name}?</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <p className="text-gray-600 mb-6">
            การลบผู้ใช้จะเป็นการปิดใช้งานบัญชี ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้
            แต่ข้อมูลจะยังคงอยู่ในระบบ
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <DxButton
              text="ลบผู้ใช้"
              type="danger"
              icon="trash"
              onClick={handleDelete}
              disabled={isDeleting}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}
