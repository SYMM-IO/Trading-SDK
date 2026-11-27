import { defineConfig, devices } from "@playwright/test";

const port = 3117;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.mocker.spec.ts",
  workers: 1,
  timeout: 90_000,
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E_MODE: "0",
      NEXT_PUBLIC_MOCKER_ACCOUNT: "",
      NEXT_PUBLIC_MOCKER_URL: process.env.NEXT_PUBLIC_MOCKER_URL || "http://localhost:4600",
    },
  },
});
