import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';

// Global setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
});
