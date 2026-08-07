// @ts-check

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Needed for absolute canonical and alternate URLs (ADR-0013). The host is
  // fixed by ADR-0016.
  site: 'https://checkpoint.cescovalle.com',
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});
