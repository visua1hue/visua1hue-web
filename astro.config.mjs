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

  // Fonts (stable in Astro 6)
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['400', '500', '700'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
    },
  ],

  // Integrations
  integrations: [
    icon({
      iconDir: 'src/assets/icons',
    }),
  ],

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