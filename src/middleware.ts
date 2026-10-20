import { defineMiddleware } from "astro:middleware";
import { SECURITY_HEADERS } from "./security-headers";

// Pages are prerendered and served as static assets with headers from _headers; the
// Worker only handles the rest (today: Astro's /_image endpoint), so set them here too
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
});
