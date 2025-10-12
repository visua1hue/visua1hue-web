// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  // Site Metadata
  site: 'https://visua1hue.dev',

  // Build & Output Configuration
  output: 'server',
  adapter: cloudflare(),

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
    ssr: {
      external: ['node:buffer']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            motion: ['motion'],
          },
        },
      },
    },
  },
});