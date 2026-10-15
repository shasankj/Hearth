import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, API calls are proxied to HAProxy (docker compose publishes it on :8080).
// Override with:  API_URL=http://localhost:3000 npm run dev   (to hit a bare Koa process)
const API = process.env.API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  // Pre-bundle libraries that only lazy-loaded pages import. Otherwise Vite discovers them mid-session,
  // re-optimizes and reloads the page, which breaks in-flight requests (and Cypress runs).
  optimizeDeps: { include: ['react-router-dom', 'leaflet', 'react-leaflet'] },
  server: { port: 5173, proxy: { '/api': API, '/inspections': API } },
});
