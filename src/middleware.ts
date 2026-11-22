import { defineMiddleware } from "astro:middleware";
import { SECURITY_HEADERS } from "./security-headers";

// Worker responses only (/_image); static pages use _headers
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
});
