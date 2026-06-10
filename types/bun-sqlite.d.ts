/**
 * Minimal ambient declaration for `bun:sqlite`.
 *
 * Some integration/unit tests run under Bun and import the built-in
 * `bun:sqlite` module. The project typechecks with `tsc` (not Bun), which
 * cannot resolve that runtime module, so it reported TS2307. This declares the
 * small surface the tests + the drizzle bun-sqlite adapter use. It does not
 * affect runtime — Bun provides the real implementation.
 */
declare module 'bun:sqlite' {
  export interface Statement<T = unknown> {
    all(...params: unknown[]): T[];
    get(...params: unknown[]): T | null;
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
    values(...params: unknown[]): unknown[][];
    finalize(): void;
  }

  export class Database {
    constructor(filename?: string, options?: Record<string, unknown>);
    query<T = unknown>(sql: string): Statement<T>;
    prepare<T = unknown>(sql: string): Statement<T>;
    run(sql: string, ...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
    exec(sql: string): void;
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
    close(): void;
  }

  export default Database;
}
