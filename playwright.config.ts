import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * Pruebas de punta a punta en modo demostración: sin las llaves de Supabase (variables vacías
 * ganan sobre .env.local), así son deterministas y no tocan ninguna base de datos real.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // En CI ya existe el build (hecho sin llaves de Supabase); en local se usa el servidor de desarrollo
    command: process.env.CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', NEXT_PUBLIC_ENABLE_DEMO_ACCESS: '' },
  },
});
