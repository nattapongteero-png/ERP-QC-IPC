// Users Summary API
// Provides statistics for the users dashboard

import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';

interface RoleCount {
  role: string;
  count: number;
}

interface DepartmentCount {
  department: string | null;
  count: number;
}

interface UserRow {
  id: number;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string | Date | null;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const usersTable = getTableRef('users');

      // Get all users for computing statistics
      const allUsers: UserRow[] = await executeDbOperation(async (db) => {
        return db
          .select({
            id: usersTable.id,
            role: usersTable.role,
            department: usersTable.department,
            isActive: usersTable.isActive,
            createdAt: usersTable.createdAt,
          })
          .from(usersTable);
      });

      // Compute statistics
      const totalUsers = allUsers.length;
      const activeUsers = allUsers.filter(u => u.isActive).length;
      const inactiveUsers = totalUsers - activeUsers;

      // Count by role
      const roleCountMap = new Map<string, number>();
      allUsers.forEach(user => {
        const role = user.role || 'user';
        roleCountMap.set(role, (roleCountMap.get(role) || 0) + 1);
      });

      const byRole: RoleCount[] = Array.from(roleCountMap.entries())
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);

      // Count by department
      const deptCountMap = new Map<string, number>();
      allUsers.forEach(user => {
        const dept = user.department || 'ไม่ระบุ';
        deptCountMap.set(dept, (deptCountMap.get(dept) || 0) + 1);
      });

      const byDepartment: DepartmentCount[] = Array.from(deptCountMap.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);

      // Users created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentUsers = allUsers.filter(u => {
        if (!u.createdAt) return false;
        const createdDate = new Date(u.createdAt);
        return createdDate >= thirtyDaysAgo;
      }).length;

      // Users created in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thisWeekUsers = allUsers.filter(u => {
        if (!u.createdAt) return false;
        const createdDate = new Date(u.createdAt);
        return createdDate >= sevenDaysAgo;
      }).length;

      return successResponse({
        totalUsers,
        activeUsers,
        inactiveUsers,
        recentUsers,
        thisWeekUsers,
        byRole,
        byDepartment,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:read']);
}
