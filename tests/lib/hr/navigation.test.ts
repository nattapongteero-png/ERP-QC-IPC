import { describe, it, expect, vi } from 'vitest';
import {
  getHrListPath,
  getHrDetailPath,
  getHrNewPath,
  getHrEditPath,
  createHrNavigator,
} from '@/lib/hr/navigation';

describe('HR Navigation Utilities', () => {
  describe('getHrListPath', () => {
    it('returns employees list path', () => {
      expect(getHrListPath('employees')).toBe('/hr/employees');
    });

    it('returns positions list path', () => {
      expect(getHrListPath('positions')).toBe('/hr/positions');
    });

    it('returns training courses list path', () => {
      expect(getHrListPath('training-courses')).toBe('/hr/training/courses');
    });

    it('returns training sessions list path', () => {
      expect(getHrListPath('training-sessions')).toBe('/hr/training/sessions');
    });

    it('returns roles list path', () => {
      expect(getHrListPath('roles')).toBe('/hr/roles');
    });

    it('returns authorizations list path', () => {
      expect(getHrListPath('authorizations')).toBe('/hr/authorizations');
    });

    it('returns health records list path', () => {
      expect(getHrListPath('health-records')).toBe('/hr/health-records');
    });
  });

  describe('getHrDetailPath', () => {
    it('returns employee detail path with numeric id', () => {
      expect(getHrDetailPath('employees', 1)).toBe('/hr/employees/1');
    });

    it('returns employee detail path with string id', () => {
      expect(getHrDetailPath('employees', '42')).toBe('/hr/employees/42');
    });

    it('returns position detail path', () => {
      expect(getHrDetailPath('positions', 5)).toBe('/hr/positions/5');
    });

    it('returns training course detail path', () => {
      expect(getHrDetailPath('training-courses', 10)).toBe('/hr/training/courses/10');
    });
  });

  describe('getHrNewPath', () => {
    it('returns employee new path', () => {
      expect(getHrNewPath('employees')).toBe('/hr/employees/new');
    });

    it('returns position new path', () => {
      expect(getHrNewPath('positions')).toBe('/hr/positions/new');
    });

    it('returns training course new path', () => {
      expect(getHrNewPath('training-courses')).toBe('/hr/training/courses/new');
    });
  });

  describe('getHrEditPath', () => {
    it('returns employee edit path with numeric id', () => {
      expect(getHrEditPath('employees', 1)).toBe('/hr/employees/1/edit');
    });

    it('returns employee edit path with string id', () => {
      expect(getHrEditPath('employees', '99')).toBe('/hr/employees/99/edit');
    });

    it('returns position edit path', () => {
      expect(getHrEditPath('positions', 3)).toBe('/hr/positions/3/edit');
    });

    it('returns training course edit path', () => {
      expect(getHrEditPath('training-courses', 7)).toBe('/hr/training/courses/7/edit');
    });
  });

  describe('createHrNavigator', () => {
    it('creates navigator with toList that calls router.push with list path', () => {
      const mockRouter = { push: vi.fn() };
      const navigator = createHrNavigator(mockRouter, 'employees');

      navigator.toList();

      expect(mockRouter.push).toHaveBeenCalledWith('/hr/employees');
    });

    it('creates navigator with toDetail that calls router.push with detail path', () => {
      const mockRouter = { push: vi.fn() };
      const navigator = createHrNavigator(mockRouter, 'employees');

      navigator.toDetail(42);

      expect(mockRouter.push).toHaveBeenCalledWith('/hr/employees/42');
    });

    it('creates navigator with toNew that calls router.push with new path', () => {
      const mockRouter = { push: vi.fn() };
      const navigator = createHrNavigator(mockRouter, 'positions');

      navigator.toNew();

      expect(mockRouter.push).toHaveBeenCalledWith('/hr/positions/new');
    });

    it('creates navigator with toEdit that calls router.push with edit path', () => {
      const mockRouter = { push: vi.fn() };
      const navigator = createHrNavigator(mockRouter, 'training-courses');

      navigator.toEdit(15);

      expect(mockRouter.push).toHaveBeenCalledWith('/hr/training/courses/15/edit');
    });

    it('works with different entities', () => {
      const mockRouter = { push: vi.fn() };

      const positionsNav = createHrNavigator(mockRouter, 'positions');
      positionsNav.toList();
      expect(mockRouter.push).toHaveBeenCalledWith('/hr/positions');

      const rolesNav = createHrNavigator(mockRouter, 'roles');
      rolesNav.toDetail(1);
      expect(mockRouter.push).toHaveBeenCalledWith('/hr/roles/1');
    });
  });
});
