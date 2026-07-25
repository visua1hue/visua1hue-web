// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import icon from 'astro-icon';

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
  ],

  // Integrations
  integrations: [
    icon({
      iconDir: 'src/assets/icons',
    }),
  ],

  // Dev Toolbar
  devToolbar: { enabled: false },

  // Prefetch Performance Tuning
  prefetch: {
    defaultStrategy: 'hover',
  },

  // Vite Configuration
  vite: {
    build: {
      minify: true,
    },
  },
});