// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';
import { execSync } from 'node:child_process';
import securityHeaders from './astro-headers.ts';
import sitemap from '@astrojs/sitemap';

// Workers Builds exposes the SHA; local builds read git
const buildSha = (() => {
  const ci = process.env.WORKERS_CI_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  site: 'https://visua1hue.dev',

  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    persistState: true,
    configPath: 'wrangler.jsonc',
  }),

  // Inter is synced by .github/workflows/sync-inter-font.yml
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      options: {
        variants: [
          {
            // Subset by .github/scripts/subset-inter.sh; axes untouched
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/InterVariable.woff2'],
          },
        ],
      },
    },
    {
      // Subset by .github/scripts/subset-geist-mono.sh; only 400 used
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

  // No auto curly quotes or dashes in src/content/*.md
  markdown: { processor: satteri({ features: { smartPunctuation: false } }) },

  // On, the adapter adds a SESSION KV binding to every deploy
  session: false,

  integrations: [securityHeaders(), sitemap({ filter: (page) => !page.endsWith('/privacy/') })],

  // CSS ~12KB; inlining saves a render-blocking request
  build: {
    inlineStylesheets: 'always',
  },

  devToolbar: { enabled: false },

  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(buildSha),
    },
    build: {
      minify: true,
      // Scripts as files, so the CSP needs no 'unsafe-inline'
      assetsInlineLimit: 0,
    },
  },
});