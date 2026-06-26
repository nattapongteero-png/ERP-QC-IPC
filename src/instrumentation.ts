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
      console.error('[Instrumentation] Database schema sync failed:', error);
      // Don't throw - allow server to start even if sync fails
      // The app can still work if tables already exist
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
  }
}
