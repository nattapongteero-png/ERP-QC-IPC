import { beforeAll, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';

// Set test environment
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';

// Create a robust mock CSSStyleDeclaration
const createMockCSSStyleDeclaration = (): CSSStyleDeclaration => {
  const mockStyle = {
    getPropertyValue: () => '',
    setProperty: () => {},
    removeProperty: () => '',
    item: () => '',
    length: 0,
    parentRule: null,
    cssText: '',
    cssFloat: '',
    fontFamily: '',
    fontSize: '',
    color: '',
    backgroundColor: '',
    display: '',
    position: '',
    width: '',
    height: '',
  };
  return mockStyle as unknown as CSSStyleDeclaration;
};

// Mock window.getComputedStyle for DevExtreme theme system compatibility
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;

  const safeGetComputedStyle = (element: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
    if (!element || !element.ownerDocument || !element.isConnected) {
      return createMockCSSStyleDeclaration();
    }
    try {
      return originalGetComputedStyle.call(window, element, pseudoElt);
    } catch {
      return createMockCSSStyleDeclaration();
    }
  };

  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    configurable: true,
    value: safeGetComputedStyle,
  });

}

// Suppress DevExtreme async errors that occur after test cleanup
// These are known issues with DevExtreme's theme system in jsdom environment
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason: unknown) => {
    const message = String(reason);
    if (message.includes('trial_panel') || message.includes('document is not defined')) {
      return; // Suppress DevExtreme trial panel errors
    }
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    const message = error.message || '';
    if (message.includes('getComputedStyle') || message.includes('themes.js')) {
      return; // Suppress DevExtreme theme system errors
    }
    console.error('Uncaught Exception:', error);
    throw error; // Re-throw non-DevExtreme errors
  });
}

// Global setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  vi.clearAllTimers();
});
