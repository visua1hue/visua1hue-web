import { defineMiddleware } from 'astro:middleware';

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

const applySecurity = (headers: Headers) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, locals } = context;
  const cfRuntime = (locals as { cfContext?: { waitUntil?: (p: Promise<unknown>) => void } }).cfContext;
  const cacheAvailable = typeof caches !== 'undefined';
  const isCacheable = request.method === 'GET' || request.method === 'HEAD';
  const cacheKey = isCacheable && cacheAvailable ? new Request(request.url, request) : null;
  const edgeCache = cacheAvailable ? (caches as unknown as { default: Cache }).default : null;

  if (cacheKey && edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('x-cache', 'HIT');
      return res;
    }
  }

  const response = await next();
  applySecurity(response.headers);

  if (
    cacheKey &&
    edgeCache &&
    response.status === 200 &&
    response.headers.get('content-type')?.includes('text/html')
  ) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'
    );
    response.headers.set('x-cache', 'MISS');
    const toStore = response.clone();
    cfRuntime?.waitUntil?.(edgeCache.put(cacheKey, toStore));
  }

  return response;
});
