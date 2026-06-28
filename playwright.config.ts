import { defineConfig, devices } from '@playwright/test';

/**
 * Visual snapshot tests for the admin "Nueva cotización" dialog.
 * Run with: bun run test:visual
 *
 * Requires the dev server on http://localhost:8080 and a managed Supabase
 * session injected via LOVABLE_BROWSER_SUPABASE_* env vars. Without those the
 * spec marks itself skipped instead of failing.
 */
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Allow tiny anti-aliasing diffs across runs/machines.
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: 'mobile-390',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
