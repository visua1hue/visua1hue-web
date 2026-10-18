// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { execSync } from 'node:child_process';

// Short commit for the BUILD link. Workers Builds exposes the SHA; local builds read git.
const buildSha = (() => {
  const ci = process.env.WORKERS_CI_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

// https://astro.build/config
export default defineConfig({
  // Site Metadata
  site: 'https://visua1hue.dev',

  // Build & Output Configuration
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    persistState: true,
    configPath: 'wrangler.jsonc',
  }),

  // Fonts — self-hosted, vendored from rsms/inter releases (see .github/workflows/sync-inter-font.yml)
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/InterVariable.woff2'],
          },
        ],
      },
    },
    {
      // Vendored from the `geist` npm package (OFL); only 400 is used
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          {
            weight: '400',
            style: 'normal',
            src: ['./src/assets/fonts/GeistMono-Regular.woff2'],
          },
        ],
      },
    },
  ],

  // Dev Toolbar
  devToolbar: { enabled: false },

  // Prefetch Performance Tuning
  prefetch: {
    defaultStrategy: 'hover',
  },

  // Vite Configuration
  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(buildSha),
    },
    build: {
      minify: true,
      // Ship every script as a file so the CSP can drop 'unsafe-inline' for scripts
      assetsInlineLimit: 0,
    },
  },
});