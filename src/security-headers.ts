import { createHash } from "node:crypto";
import navEntryState from "./scripts/nav-entry-state.js?raw";

/** CSP hash of the script Layout.astro inlines, derived from its source so edits can't drift */
const INTERNAL_NAV_HASH = `sha256-${createHash("sha256").update(navEntryState).digest("base64")}`;

/** Used by middleware.ts (Worker) and astro-headers.ts (_headers). */
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

