import vercel from '@astrojs/vercel/serverless';
import { defineConfig } from 'astro/config';
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    }
  }),
  vite: {
    ssr: {
      noExternal: ['path-to-regexp']
    }
  },
  integrations: [react()]
});