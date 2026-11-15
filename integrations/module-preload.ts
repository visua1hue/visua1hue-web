import { readdir, readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";

const ENTRY = /<script type="module" src="(\/_astro\/[^"]+\.js)"/g;
const STATIC_IMPORT = /(?:from|import)\s*"\.\/([^"]+\.js)"/g;

/**
 * Component scripts share chunks (e.g. tokens.js) that the browser only discovers after
 * the importing script arrives. Preload every static import so they download in parallel.
 */
export default function modulePreload(): AstroIntegration {
  let clientDir: URL;
  return {
    name: "module-preload",
    hooks: {
      "astro:config:done": ({ config }) => {
        clientDir = config.build.client;
      },
      "astro:build:done": async ({ logger }) => {
        const imports = new Map<string, string[]>();
        const importsOf = async (src: string) => {
          let deps = imports.get(src);
          if (!deps) {
            const code = await readFile(new URL(`.${src}`, clientDir), "utf8");
            deps = [...code.matchAll(STATIC_IMPORT)].map((m) => `/_astro/${m[1]}`);
            imports.set(src, deps);
          }
          return deps;
        };

        const pages = (await readdir(clientDir, { recursive: true })).filter((f) => f.endsWith(".html"));
        for (const page of pages) {
          const file = new URL(page, clientDir);
          const html = await readFile(file, "utf8");
          const entries = [...html.matchAll(ENTRY)].map((m) => m[1]);
          const seen = new Set(entries);
          const preload: string[] = [];
          const queue = [...entries];
          for (let src; (src = queue.shift()); ) {
            for (const dep of await importsOf(src)) {
              if (seen.has(dep)) continue;
              seen.add(dep);
              preload.push(dep);
              queue.push(dep);
            }
          }
          if (!preload.length) continue;
          const links = preload.map((href) => `<link rel="modulepreload" href="${href}">`).join("");
          await writeFile(file, html.replace("</head>", `${links}</head>`));
          logger.info(`${page}: preloaded ${preload.length} shared chunk(s)`);
        }
      },
    },
  };
}
