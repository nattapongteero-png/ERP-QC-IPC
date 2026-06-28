/**
 * Unit tests — buildMetaherbUrls (base URL + company key → all endpoint URLs).
 * Pure function, no DB; just verifies URL composition + edge cases.
 */

import { describe, it, expect } from 'vitest';
import { buildMetaherbUrls } from '@/lib/services/metaherb-sso.service';

describe('buildMetaherbUrls', () => {
  it('builds every endpoint from base + key', () => {
    const urls = buildMetaherbUrls('https://api.pomdevth.site', 'uat');
    expect(urls).toEqual({
      callbackUrl: 'https://api.pomdevth.site/api/sso/erp/callback/uat',
      prStatusUrl: 'https://api.pomdevth.site/api/erp/pr-status/uat',
      poSubmitUrl: 'https://api.pomdevth.site/api/erp/po-submit/uat',
      poOwnerDecisionUrl: 'https://api.pomdevth.site/api/erp/po-owner-decision/uat',
    });
  });

  it('strips a trailing slash on the base (no double slash)', () => {
    const urls = buildMetaherbUrls('https://api.pomdevth.site/', 'arjaro');
    expect(urls?.prStatusUrl).toBe('https://api.pomdevth.site/api/erp/pr-status/arjaro');
  });

  it('returns null when base or key is missing', () => {
    expect(buildMetaherbUrls('', 'uat')).toBeNull();
    expect(buildMetaherbUrls('https://api.x', '')).toBeNull();
    expect(buildMetaherbUrls(null, null)).toBeNull();
  });
});
