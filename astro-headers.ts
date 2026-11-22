import { createHash } from "node:crypto";
import { appendFile, readdir, readFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { SECURITY_HEADERS } from "./src/security-headers";

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

/** The CSP blocks any inline script without a hash. */
async function assertInlineScriptsHashed(clientDir: URL): Promise<void> {
  const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
  const files = (await readdir(clientDir, { recursive: true })).filter((f) => f.endsWith(".html"));
  for (const file of files) {
    const html = await readFile(new URL(file, clientDir), "utf8");
    for (const [, body = ""] of html.matchAll(INLINE_SCRIPT)) {
      const hash = `sha256-${createHash("sha256").update(body).digest("base64")}`;
      if (!csp.includes(`'${hash}'`)) {
        throw new Error(`Inline script in ${file} isn't in the CSP. Its hash is '${hash}' (src/security-headers.ts)`);
      }
    }
  }
}

/** Prerendered pages skip middleware; their headers go in `_headers`. */
export default function securityHeaders(): AstroIntegration {
  let clientDir: URL;
  return {
    name: "security-headers",
    hooks: {
      "astro:config:done": ({ config }) => {
        clientDir = config.build.client;
      },
      "astro:build:done": async ({ logger }) => {
        await assertInlineScriptsHashed(clientDir);
        const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`);
        await appendFile(new URL("_headers", clientDir), `\n/*\n${lines.join("\n")}\n`);
        logger.info(`Added ${lines.length} security headers to _headers`);
      },
    },
  };
}
