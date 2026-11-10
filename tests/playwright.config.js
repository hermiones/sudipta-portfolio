import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,   // every page software-renders WebGL in headless browsers; keep local runs close to CI
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.SITE_URL || 'https://sudipta.site', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
