import { describe, it, expect } from 'vitest';
import type { Employee, EmployeeCreate } from '@/types/hr';

describe('Employee Types', () => {
  it('should accept valid employee with all new fields', () => {
    const employee: Employee = {
      id: 1,
      userId: null,
      employeeCode: 'EMP001',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      nickname: 'ชาย',
      email: 'somchai@example.com',
      phone: '0812345678',
      thaiCid: 'encrypted_value',
      dateOfBirth: '1990-01-15',
      gender: 'male',
      bloodType: 'O+',
      photoUrl: '/uploads/employees/1/photo.jpg',
      positionId: 1,
      orgUnitId: 1,
      siteId: 1,
      hireDate: '2024-01-01',
      terminationDate: null,
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(employee.thaiCid).toBeDefined();
    expect(employee.photoUrl).toBeDefined();
    expect(employee.dateOfBirth).toBeDefined();
  });

  it('should accept valid employee create data', () => {
    const createData: EmployeeCreate = {
      employeeCode: 'EMP002',
      firstName: 'สมหญิง',
      lastName: 'ใจดี',
      hireDate: '2024-01-01',
      thaiCid: '1234567890123',
      gender: 'female',
      bloodType: 'A+',
      educationLevel: 'bachelor',
    };

    expect(createData.thaiCid).toBeDefined();
    expect(createData.gender).toBe('female');
    expect(createData.educationLevel).toBe('bachelor');
  });
});
