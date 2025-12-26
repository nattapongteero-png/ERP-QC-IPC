import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';

// Set test environment
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';

// Mock window.getComputedStyle for DevExtreme theme system compatibility
const originalGetComputedStyle = window.getComputedStyle;
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: (element: Element, pseudoElt?: string | null) => {
    try {
      return originalGetComputedStyle(element, pseudoElt);
    } catch {
      // Return a mock style object when element is no longer in DOM
      return {
        getPropertyValue: () => '',
        fontFamily: '',
      } as CSSStyleDeclaration;
    }
  },
});

// Global setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  // Clear any pending DevExtreme timers
  vi.clearAllTimers();
});
