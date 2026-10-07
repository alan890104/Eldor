import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';
// Preview server for auditioning the music (npm run music, open /?music): pinned to port 5431 with no HMR,
// so editing a track never interrupts what is playing through hot reload; refresh the page to get the new version.
export default mergeConfig(base, defineConfig({ server: { port: 5431, strictPort: true, hmr: false } }));
