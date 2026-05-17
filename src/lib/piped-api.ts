// Piped API instances with fallback rotation
// Updated: 2025-05-17 - replaced dead instances

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.yt',
  'https://pipedapi.darkness.services',
  'https://pipedapi.drgns.space',
  'https://pipedapi.moomoo.me',
  'https://piped-api.privacy.com.de',
];

let currentInstanceIndex = 0;
let failedInstances = new Set<number>();

export async function pipedFetch(path: string, timeoutMs = 8000): Promise<Response> {
  // Try each instance until one works
  for (let attempt = 0; attempt < PIPED_INSTANCES.length; attempt++) {
    const idx = (currentInstanceIndex + attempt) % PIPED_INSTANCES.length;
    if (failedInstances.has(idx)) continue;

    const url = `${PIPED_INSTANCES[idx]}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        failedInstances.add(idx);
      }, timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeout);

      if (res.ok) {
        currentInstanceIndex = idx;
        return res;
      }
      
      // Mark non-ok statuses as failed (except 429 which is rate limit)
      if (res.status === 429) {
        failedInstances.add(idx);
        continue;
      }
      // Also mark 5xx as failed
      if (res.status >= 500) {
        failedInstances.add(idx);
        continue;
      }
    } catch (err) {
      failedInstances.add(idx);
      continue;
    }
  }

  // If all instances failed, reset and try once more with first instance
  failedInstances.clear();
  const fallbackUrl = `${PIPED_INSTANCES[0]}${path}`;
  return fetch(fallbackUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
}
