import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Trade flow against the fresh, in-memory instance managed by `test:e2e:mocker`.
 */
const SESSION_FLOW = "/integration?flow=instant-open";

async function connectMockWallet(page: Page) {
  const trigger = page.getByTestId("connect-wallet");
  if (!(await trigger.isVisible())) return;
  await trigger.click();
  await page.getByTestId("connect-mock").click();
  await expect(page.getByTestId("connect-wallet")).toBeHidden();
}

/** Accept the next pending request of `kind` through MOCKER's admin API. */
async function acceptNext(request: APIRequestContext, mockerUrl: string, kind: "open" | "close") {
  let key = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mockerUrl}/admin/requests`);
        await expect(response).toBeOK();
        const rows = (await response.json()) as { key: string; kind: string; status: string }[];
        key = rows.find((row) => row.kind === kind && row.status === "pending")?.key ?? "";
        return key;
      },
      { message: `a pending ${kind} request in MOCKER`, timeout: 30_000 },
    )
    .not.toBe("");
  const accepted = await request.post(`${mockerUrl}/admin/requests/${encodeURIComponent(key)}/accept`, { data: {} });
  await expect(accepted).toBeOK();
}

/** The Main sub-account's free balance, as the app prints it in the sub-account list. */
async function subAccountBalance(page: Page): Promise<number> {
  const label = page.locator('[data-testid^="subaccount-0x"][data-testid$="-balance-data"]').first();
  await expect(label).toBeVisible();
  return Number((await label.innerText()).replaceAll(",", ""));
}

test.describe("MOCKER trade flow", () => {
  test("deposit, instant open, accept, instant close, accept", async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const mockerUrl: unknown = testInfo.config.metadata.mockerUrl;
    if (typeof mockerUrl !== "string") throw new Error("Run this spec with test:e2e:mocker.");

    await page.goto(SESSION_FLOW);
    await connectMockWallet(page);

    // Sub-account.
    await page.getByTestId("subaccount-step-create-name").fill("Main");
    await page.getByTestId("subaccount-step-create-submit").click();
    await expect(page.getByText("Main", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText("Main", { exact: true }).first().click();

    // Deposit: approve, then deposit.
    await page.getByTestId("instant-open-fund-amount").fill("1000");
    const fund = page.getByTestId("instant-open-fund-primary");
    await expect(fund).toHaveText(/Approve USDC/);
    await fund.click();
    await expect(page.getByTestId("instant-open-fund-status")).toContainText("Approved", { timeout: 30_000 });
    await expect(fund).toHaveText(/Deposit/);
    await fund.click();

    // The disposable instance grants the browser's session-key delegation on first use.
    await expect(page.getByRole("button", { name: "Delegation Granted" })).toBeVisible({ timeout: 30_000 });

    // Open a small VVV long.
    await page.getByText("Select a market…").click();
    await page.getByPlaceholder("Search symbol, name, or ID…").fill("VVV");
    await page.getByText("VVV", { exact: true }).first().click();
    await page.getByTestId("instant-open-margin").fill("100");
    const submit = page.getByTestId("instant-open-submit");
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();
    await expect(page.getByText("Submitted to hedger.")).toBeVisible({ timeout: 30_000 });
    await acceptNext(request, mockerUrl, "open");

    // Instant close: the VA holds the position now.
    await page.goto("/integration?flow=instant-close");
    await connectMockWallet(page);
    const heldBalance = await subAccountBalance(page);
    expect(heldBalance).toBeLessThan(1000);
    await page.getByText("Main", { exact: true }).first().click();
    await page.getByText("VVV::").first().click();
    await page.getByTestId(/^instant-close-position-\d+$/).click();
    await page.getByTestId("integration-instant-close-max").click();
    const close = page.getByTestId("integration-instant-close-submit");
    await expect(close).toBeEnabled({ timeout: 30_000 });
    await close.click();
    await acceptNext(request, mockerUrl, "close");

    // The VA is gone and the money is back, less fees and spread.
    await page.goto("/integration?flow=instant-close");
    await connectMockWallet(page);
    await expect.poll(async () => subAccountBalance(page), { timeout: 30_000 }).toBeGreaterThan(heldBalance + 90);
    expect(await subAccountBalance(page)).toBeGreaterThan(990);
  });
});
