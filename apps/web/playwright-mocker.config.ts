import { defineConfig, devices } from "@playwright/test";

// eslint-disable-next-line turbo/no-undeclared-env-vars -- Playwright's probes and admin requests stay on loopback
const proxyBypass = process.env.no_proxy ?? process.env.NO_PROXY;
// eslint-disable-next-line turbo/no-undeclared-env-vars -- inherited by Playwright workers
process.env.no_proxy = [proxyBypass, "localhost", "127.0.0.1"].filter(Boolean).join(",");

const mockerPort = 14600;
const webPort = 13001;
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.mocker\.spec\.ts$/,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  metadata: { mockerUrl: `http://localhost:${mockerPort}` },
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "pnpm --workspace-root run dev:mocker --e2e",
    url: `${baseURL}/integration`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 12_000 },
    env: { MOCKER_BASE_PORT: String(mockerPort), MOCKER_WEB_PORT: String(webPort) },
  },
});
