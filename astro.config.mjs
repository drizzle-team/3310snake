import vercel from '@astrojs/vercel/serverless';
import { defineConfig } from 'astro/config';

export default defineConfig({
    output: 'server',
    adapter: vercel({
        webAnalytics: { enabled: true }
    }),
    vite: {
        ssr: {
            noExternal: ['path-to-regexp'],
        },
    },
});
