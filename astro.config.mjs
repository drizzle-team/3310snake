import vercel from '@astrojs/vercel/serverless';
import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import { loadEnv } from "vite";

loadEnv(process.env.NODE_ENV, process.cwd(), "");

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