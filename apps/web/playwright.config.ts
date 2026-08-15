import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for `apps/web`.
 *
 * `read` project drives the Inspector page against live Hyperliquid RPC with
 * the `mock` connector "connected" to the repo's well-known test EOA. No
 * credentials needed in env — the address is public.
 *
 * A `write` E2E layer is **not** included here. The wagmi `mock` connector
 * forwards `eth_sendTransaction` straight to the RPC without signing, so a
 * public RPC will reject the call. Real-broadcast write coverage lives in
 * `packages/trading-react`'s Vitest write integration test, which uses `viem/accounts`
 * + the seed phrase server-side.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    /** Must match the port in the `dev` script (`next dev -p 3001`). */
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E_MODE: "1",
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
