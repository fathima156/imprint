import { defineConfig } from 'vite';

// Minimal Vite config. `host: true` lets you open the dev server from a
// phone on the same network, which is handy for testing touch controls.
export default defineConfig({
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
});
