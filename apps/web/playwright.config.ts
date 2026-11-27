import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for `apps/web`.
 *
 * `read` project drives the Inspector page against live Arbitrum RPC with
 * the `mock` connector "connected" to the repo's well-known test EOA. No
 * credentials needed in env — the address is public.
 *
 * Mock writes use the separate `test:e2e:mocker` command and its disposable backend.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    /** Must match the port in the `dev` script (`next dev -p 3001`). */
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E_MODE: "1",
      NEXT_PUBLIC_MOCKER_CONFIG: "",
    },
  },
  projects: [
    {
      name: "read",
      testMatch: /.*\.read\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
