import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  // /api is proxied to the local wrangler dev (npm run cloud:dev); in production the same Worker serves it
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
});
