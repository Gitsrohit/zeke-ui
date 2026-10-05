import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/zeke_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "playwright/.auth/maya.json" },
      dependencies: ["setup"],
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: "playwright/.auth/maya.json" },
      dependencies: ["setup"],
      testMatch: /responsive\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATABASE_URL: E2E_DATABASE_URL, NODE_ENV: "production", APP_URL: `http://localhost:${PORT}` },
  },
});
