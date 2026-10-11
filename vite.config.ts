import { defineConfig } from 'vite';

// Minimal Vite config. `host: true` lets you open the dev server from a
// phone on the same network, which is handy for testing touch controls.
// `preview.allowedHosts` lets `vite preview` be served from a deployed host
// (e.g. Render), whose domain isn't known ahead of time.
export default defineConfig({
  server: {
    host: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
  },
});
