export const IS_TEST_ENVIRONMENT = process.env.NEXT_PUBLIC_IS_TEST_ENVIRONMENT === "true";

/**
 * Whether the app is running in Playwright E2E mode. When `true`, the wagmi
 * config swaps the wallet connector list for the deterministic `mock`
 * connector. Never set in production.
 */
export const IS_E2E_MODE = process.env.NEXT_PUBLIC_E2E_MODE === "1";

/**
 * EOA address the E2E mock connector reports as the "connected" wallet.
 *
 * Defaults to the public address derived from the repo's well-known test
 * mnemonic in `<repo-root>/.env` (see the env file for details). The seed
 * phrase itself is **not** exposed to the browser bundle — only this
 * address is, which is harmless public data.
 *
 * The mock connector cannot actually sign transactions (it forwards
 * `eth_sendTransaction` straight to the RPC), so the Inspector's write
 * button will error in E2E mode. Real-broadcast write coverage lives in the
 * `packages/trading-react` Vitest write integration test, which uses the seed
 * phrase server-side via `viem/accounts`.
 */
export const E2E_ACCOUNT_ADDRESS = (process.env.NEXT_PUBLIC_E2E_ACCOUNT_ADDRESS ??
  "0x0AF32c77e9431c8a618E821a719A5cdA9D703F67") as `0x${string}`;
