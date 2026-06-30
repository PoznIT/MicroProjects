import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy /api to the FastAPI backend. In production the gateway nginx
// handles /api routing, so this proxy is dev-only.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
