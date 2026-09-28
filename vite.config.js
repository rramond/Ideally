import { defineConfig } from 'vite';

// Saved data lives in localStorage, which is tied to the exact origin
// (host + port). Pin one port for dev and preview so data doesn't
// seem to vanish when Vite picks a different port.
export default defineConfig({
  base: './', // relative asset paths, so the build also works from a GitHub Pages subpath
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
