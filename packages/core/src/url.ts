const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'fbclid', 'gclid', 'msclkid', 'twclid', 'igshid',
  'mc_eid', '_ga', '_hsenc', '_hsmi', 'ref',
]);

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
        u.searchParams.delete(key);
      }
    }
    const result = u.toString();
    return result.endsWith('/') && u.pathname.length > 1
      ? result.slice(0, -1)
      : result;
  } catch {
    return raw;
  }
}
