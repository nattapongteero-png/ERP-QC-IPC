/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for database schema synchronization and other startup tasks.
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');

    // Dynamically import to avoid issues during build
    const { initializeDatabaseWithSync } = await import('./lib/db/schema-sync');

    try {
      await initializeDatabaseWithSync();
      console.log('[Instrumentation] Database schema sync completed successfully');
    } catch (error) {
      // Still don't throw — a server that refuses to boot helps nobody, and
      // most of the app works even with a partial schema. But this must be
      // shouted, not whispered: UAT ran for months with 37 tables missing
      // because the only trace was one console.error nobody was reading.
      console.error(
        '\n' +
          '='.repeat(78) + '\n' +
          '[Instrumentation] DATABASE SCHEMA SYNC FAILED\n' +
          'The database does NOT match the ORM schema. Pages backed by missing\n' +
          'tables will return HTTP 500. Check the [Schema Sync] errors above.\n' +
          '='.repeat(78) + '\n',
        error,
      );
    }

    // Drain any Metaherb PR-status webhooks that were left pending across a
    // restart/redeploy (the durable backstop for the inline fire-and-forget
    // sends). Non-blocking and never throws — startup must not depend on it.
    try {
      const { retryDueMetaherbPrWebhooks } = await import(
        './lib/services/metaherb-pr-webhook.service'
      );
      void retryDueMetaherbPrWebhooks().catch((err) =>
        console.error('[Instrumentation] Metaherb webhook boot-drain failed:', err)
      );
    } catch (error) {
      console.error('[Instrumentation] Metaherb webhook boot-drain import failed:', error);
    }

    // Same durable backstop for the Metaherb PO-submit webhook.
    try {
      const { retryDueMetaherbPoWebhooks } = await import(
        './lib/services/metaherb-po-webhook.service'
      );
      void retryDueMetaherbPoWebhooks().catch((err) =>
        console.error('[Instrumentation] Metaherb PO webhook boot-drain failed:', err)
      );
    } catch (error) {
      console.error('[Instrumentation] Metaherb PO webhook boot-drain import failed:', error);
    }
  }
}
