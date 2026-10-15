import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { defaultCommandTimeout: 10000, baseUrl: 'http://localhost:5173', video: false, supportFile: 'cypress/support/e2e.js', viewportWidth: 1400, viewportHeight: 900 },
});
