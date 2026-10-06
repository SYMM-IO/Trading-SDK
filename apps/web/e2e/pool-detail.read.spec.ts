import { expect, test, type Page } from "@playwright/test";

/** See the note in pools.read.spec.ts on why this is not the config's `127.0.0.1` baseURL. */
const POOLS_URL = "http://localhost:3001/pools";

/** Each tab, with the backend its label strip must name. */
const TABS = [
  { label: "Positions", source: "listing backend" },
  { label: "Open quotes", source: "analytics subgraph" },
  { label: "Limit orders", source: "TP/SL handler" },
  { label: "Trade history", source: "analytics subgraph" },
  { label: "Deposits & withdrawals", source: "listing backend" },
] as const;

/**
 * A pool with a long realized history, addressed by contract so the pick is
 * deterministic. Searching a ticker is not: several pools match `SYM`, the
 * backend's ordering among them varies, and the test would assert history
 * against whichever quiet pool came back first.
 */
const ACTIVE_POOL = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

/** The ticker that address must resolve to — asserted, so a mis-pick fails loudly. */
const ACTIVE_POOL_LABEL = "SYMM";

/**
 * Pick a pool by contract address, waiting for the picker to actually reflect
 * the search.
 *
 * The wait is the whole point: `PoolSelect` debounces its query, so the option
 * list still holds the unfiltered catalog for a moment after the box is filled.
 * Clicking the first option immediately picks whatever pool happened to be top
 * of that stale list, which is how this test previously "passed" against a
 * different pool than the one it names.
 */
async function pickPool(page: Page, contractAddress: string, expectedLabel: string) {
  /** Hydration guard — see `pickSeriesPool` in pools.read.spec.ts. */
  await expect(page.getByTestId("pool-detail-trigger")).toContainText("Select a pool", { timeout: 30_000 });
  await page.getByTestId("pool-detail").scrollIntoViewIfNeeded();
  await page.getByTestId("pool-detail-trigger").click();
  await page.getByTestId("pool-detail-search").fill(contractAddress);

  const firstOption = page.getByTestId("pool-detail-select").first();
  await expect(firstOption).toContainText(expectedLabel, { timeout: 30_000 });
  await firstOption.click();

  await expect(page.getByTestId("pool-detail-trigger")).toContainText(expectedLabel);
}

test("every detail tab resolves against its own backend", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(POOLS_URL);
  await pickPool(page, ACTIVE_POOL, ACTIVE_POOL_LABEL);

  for (const { label, source } of TABS) {
    await page.getByRole("tab", { name: label }).click();

    /** The strip names which of the three backends filled the open tab. */
    await expect(page.getByTestId("pool-detail-source")).toContainText(source);

    /**
     * Every tab must reach a settled state — rows, or its own empty message.
     * Polling on "not still loading" is the point: a query that never fires sits
     * in `pending` forever and would otherwise read as a passing empty table.
     */
    const table = page.getByTestId("pool-detail").locator("table");
    await expect.poll(async () => (await table.innerText()).includes("Loading"), { timeout: 45_000 }).toBe(false);
  }
});

test("trade history and transactions carry real rows for an active pool", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(POOLS_URL);
  await pickPool(page, ACTIVE_POOL, ACTIVE_POOL_LABEL);

  const rows = page.getByTestId("pool-trade-history-table").locator("tbody tr");
  await page.getByRole("tab", { name: "Trade history" }).click();
  await expect(rows.first()).toBeVisible({ timeout: 45_000 });

  /** One row per close *event*, so a quote closed in parts appears more than once. */
  await expect(rows.first()).toContainText("#");

  await page.getByRole("tab", { name: "Deposits & withdrawals" }).click();
  const cashRows = page.getByTestId("pool-transactions-table").locator("tbody tr");
  await expect(cashRows.first()).toBeVisible({ timeout: 45_000 });
});

test("deposits & withdrawals page through the backend's whole history", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(POOLS_URL);
  await pickPool(page, ACTIVE_POOL, ACTIVE_POOL_LABEL);

  /**
   * The footer must count the backend's `count` — the pool's whole history — not
   * the rows one request returned. The table once fetched a single page and paged
   * through it on the client, so a pool with hundreds of transactions read
   * "of 50" and everything older was unreachable.
   */
  const firstPage = page.waitForResponse((response) => response.url().includes("/transaction-history/0/10?"), {
    timeout: 45_000,
  });
  await page.getByRole("tab", { name: "Deposits & withdrawals" }).click();
  const { count } = (await (await firstPage).json()) as { count: number };
  expect(count).toBeGreaterThan(10);

  const pagination = page.getByTestId("pool-transactions-table-pagination");
  await expect(page.getByTestId("pool-transactions-table-pagination-range")).toContainText(`of ${count}`);

  /** `start` counts rows, not pages: page 2 at 10 a page asks for row 10 onwards. */
  const secondPage = page.waitForRequest((request) => request.url().includes("/transaction-history/10/10?"));
  await pagination.getByRole("button", { name: "Next page" }).click();
  await secondPage;
  await expect(page.getByTestId("pool-transactions-table-pagination-page-indicator")).toContainText("Page 2");
});
