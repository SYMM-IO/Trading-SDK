import { expect, test, type Page } from "@playwright/test";

/** Connect the deterministic mock wallet when the page starts disconnected. */
async function connectMockWallet(page: Page) {
  const trigger = page.getByTestId("connect-wallet");
  if (!(await trigger.isVisible())) return;
  await trigger.click();
  await page.getByTestId("connect-mock").click();
}

test.describe("supported-chain controls", () => {
  test("names and switches to Arbitrum from the Solvers page", async ({ page }) => {
    await page.goto("/solvers");
    await connectMockWallet(page);

    await expect(page.getByTestId("chain-switcher-42161")).toHaveText("Arbitrum");

    const arbitrumButton = page.getByTestId("button-solvers-chain-42161");
    await expect(arbitrumButton).toHaveText("Arbitrum (Enigma)");
    await arbitrumButton.click();

    await expect(page.getByRole("heading", { name: "Solvers · Arbitrum", exact: true })).toBeVisible();
    await expect(page.getByTestId("wallet-panel")).toContainText("Connected · Arbitrum");
    await expect(page.getByTestId("select-markets-solver-enigma-arbitrum")).toHaveAttribute("aria-pressed", "true");
  });
});
