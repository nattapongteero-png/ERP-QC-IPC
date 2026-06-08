/**
 * Integration Tests: SOP template steps persist gmpDocumentId
 *
 * Verifies the GMP-document linkage added to procedure steps survives
 * add + update + read through the service layer.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _db: unknown = null;
  return { getTestDb: () => _db, setTestDb: (d: unknown) => { _db = d; } };
});

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import {
  addSOPTemplateStep,
  updateSOPTemplateStep,
  getSOPTemplateSteps,
} from '@/lib/services/sop-template-steps.service';

describe('SOP template steps — gmpDocumentId linkage', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;
  let templateId: number;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteSOPStepTemplates,
      schema.sqliteSOPTemplateSteps,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => closeTestDatabase(sqlite));

  beforeEach(async () => {
    cleanTables(sqlite, ['sop_template_steps', 'sop_step_templates']);
    const [tpl] = await db
      .insert(schema.sqliteSOPStepTemplates)
      .values({ code: 'SOP-1', name: 'T', nameTh: 'ที', category: 'mixing' })
      .returning();
    templateId = tpl.id;
  });

  it('addSOPTemplateStep persists gmpDocumentId', async () => {
    const step = await addSOPTemplateStep({
      templateId,
      sequence: 1,
      stepName: 'Mix',
      stepNameTh: 'ผสม',
      instructions: null,
      instructionsTh: null,
      defaultParameters: null,
      gmpDocumentId: 42,
    } as any);
    expect(step.gmpDocumentId).toBe(42);

    const [reloaded] = await getSOPTemplateSteps(templateId);
    expect(reloaded.gmpDocumentId).toBe(42);
  });

  it('updateSOPTemplateStep can set and clear gmpDocumentId', async () => {
    const step = await addSOPTemplateStep({
      templateId,
      sequence: 1,
      stepName: 'Mix',
      stepNameTh: 'ผสม',
      instructions: null,
      instructionsTh: null,
      defaultParameters: null,
      gmpDocumentId: null,
    } as any);
    expect(step.gmpDocumentId ?? null).toBeNull();

    const linked = await updateSOPTemplateStep(step.id, { gmpDocumentId: 7 } as any);
    expect(linked.gmpDocumentId).toBe(7);

    const cleared = await updateSOPTemplateStep(step.id, { gmpDocumentId: null } as any);
    expect(cleared.gmpDocumentId ?? null).toBeNull();
  });
});
