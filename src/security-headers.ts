/** CSP hash of the inline script in Layout.astro (src/scripts/internal-nav.js). The build fails if it drifts. */
export const INTERNAL_NAV_HASH = "sha256-hD/1w3NnSkJNk3ClgGcstfWRFk91ahjwYod8NdkQqTM=";

/** Set by middleware.ts on Worker responses; written to _headers by astro-headers.ts. */
export const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "bluetooth=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
    "midi=()",
    "xr-spatial-tracking=()",
  ].join(", "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' '${INTERNAL_NAV_HASH}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
};

