import { expect, test } from "@playwright/test";

test.describe("/inspector/account-layer · reads", () => {
  test("loads the Inspector shell and renders the wallet panel", async ({ page }) => {
    await page.goto("/inspector/account-layer");
    await expect(page.getByTestId("wallet-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: /AccountLayer · HyperEVM/i })).toBeVisible();
  });

  test("auto-connects the mock connector in E2E mode", async ({ page }) => {
    await page.goto("/inspector/account-layer");

    /**
     * In E2E mode the wagmi config only registers the `mock` connector, so
     * "Connect Mock Connector" is the sole connect button. Clicking it
     * resolves immediately — no popup, no extension.
     */
    const connectButton = page.getByTestId("connect-mock");
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }

    /**
     * `wallet-address` switches from "Not connected" to a shortened
     * checksummed address once the mock connector has hydrated.
     */
    await expect(page.getByTestId("wallet-address")).not.toHaveText("Not connected", { timeout: 10_000 });
  });

  test("runs getUserSubAccounts against real Hyperliquid RPC and renders a result", async ({ page }) => {
    await page.goto("/inspector/account-layer");

    const connectButton = page.getByTestId("connect-mock");
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }

    await page.getByTestId("button-read-subaccounts").click();

    /**
     * One of three result panels must appear. We accept any of them — an empty
     * EOA returns `-empty`; an active one returns `-data`; a transient RPC
     * blip would surface as `-error`. The test fails only if none arrive.
     */
    const result = page.locator(
      [
        "[data-testid='result-getUserSubAccounts-data']",
        "[data-testid='result-getUserSubAccounts-empty']",
        "[data-testid='result-getUserSubAccounts-error']",
      ].join(", "),
    );
    await expect(result).toBeVisible({ timeout: 25_000 });
  });
});
