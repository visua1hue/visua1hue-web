import { appendFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { SECURITY_HEADERS } from "./src/security-headers";

/** Prerendered pages never reach the middleware, so their headers go into `_headers`. */
export default function securityHeaders(): AstroIntegration {
  let clientDir: URL;
  return {
    name: "security-headers",
    hooks: {
      "astro:config:done": ({ config }) => {
        clientDir = config.build.client;
      },
      "astro:build:done": async ({ logger }) => {
        const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`);
        await appendFile(new URL("_headers", clientDir), `\n/*\n${lines.join("\n")}\n`);
        logger.info(`Added ${lines.length} security headers to _headers`);
      },
    },
  };
}
