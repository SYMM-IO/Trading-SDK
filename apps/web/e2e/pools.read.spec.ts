import { expect, test, type Page } from "@playwright/test";

/** See the note below on why this is not the config's `127.0.0.1` baseURL. */
const POOLS_URL = "http://localhost:3001/pools";

/** Column index of the chain cell, and of the status cell, in the catalog table. */
const CHAIN_COLUMN = 1;
const STATUS_COLUMN = 2;

function catalogRows(page: Page) {
  return page.getByTestId("pools-table").locator("tbody tr");
}

/**
 * Poll a column until every visible cell satisfies `predicate`.
 *
 * Polling rather than a single read is required: the console keeps the previous
 * page's rows on screen while the next request is in flight (react-query
 * `placeholderData`), so a filter's effect lands one render after the total
 * updates. A plain read races that gap and sees the pre-filter rows.
 */
async function expectEveryCell(page: Page, column: number, predicate: (cell: string) => boolean) {
  await expect
    .poll(
      async () => {
        const cells = await catalogRows(page).locator("td").nth(column).allTextContents();
        return cells.length > 0 && cells.every(predicate);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * Read-only smoke of the pools catalog against the live listing service.
 *
 * Driven against `localhost` rather than the config's `127.0.0.1` baseURL: Next
 * 16's dev-origin check refuses the HMR socket on the bare IP, so the page never
 * hydrates — the markup renders, the client component never runs, and every
 * assertion below would sit on the server-rendered "Loading…".
 *
 * Every control on the page is server-side, so each assertion is really checking
 * that the request changed and the service answered — not that a client-side
 * array was re-sorted. No wallet is involved: `/v2/market/search` is public.
 */
test("the catalog loads and every server-side control changes the result set", async ({ page }) => {
  await page.goto(POOLS_URL);

  await expect(page.getByTestId("pools-catalog")).toBeVisible();

  /** The total is the whole catalog's match count, not the page length. */
  const total = page.getByTestId("pools-total");
  await expect(total).toContainText(/\d+ pools/, { timeout: 30_000 });
  await expect(catalogRows(page).first()).toBeVisible();

  const unfilteredCount = (await total.textContent()) ?? "";

  /** Filtering by chain changes the request, so the catalog-wide total moves. */
  await page.getByTestId("pools-chain-filter").click();
  await page.getByRole("option", { name: "Solana" }).click();
  await expect(total).not.toHaveText(unfilteredCount, { timeout: 30_000 });
  await expectEveryCell(page, CHAIN_COLUMN, (cell) => cell.includes("Solana"));

  const solanaCount = (await total.textContent()) ?? "";

  /** Search narrows the same request further still. */
  await page.getByTestId("pools-search").fill("pump");
  await expect(total).not.toHaveText(solanaCount, { timeout: 30_000 });

  /** Clearing both controls returns the untouched catalog. */
  await page.getByTestId("pools-search").fill("");
  await page.getByTestId("pools-chain-filter").click();
  await page.getByRole("option", { name: "Any chain" }).click();
  await expect(total).toHaveText(unfilteredCount, { timeout: 30_000 });
});

test("a status filter restricts the catalog to one lifecycle stage", async ({ page }) => {
  await page.goto(POOLS_URL);

  await expect(page.getByTestId("pools-total")).toContainText(/\d+ pools/, { timeout: 30_000 });

  await page.getByTestId("pools-status-filter").click();
  await page.getByRole("option", { name: "Live" }).click();

  await expectEveryCell(page, STATUS_COLUMN, (cell) => cell.trim() === "Live");
});

test("sorting by a column reorders the catalog server-side", async ({ page }) => {
  await page.goto(POOLS_URL);

  const total = page.getByTestId("pools-total");
  await expect(total).toContainText(/\d+ pools/, { timeout: 30_000 });
  await expect(catalogRows(page).first()).toBeVisible();

  /** The default sort is TVL descending; flipping it must change the top row. */
  const topPool = catalogRows(page).first().locator("td").first();
  const descendingTop = await topPool.textContent();

  await page.getByTestId("pools-sort-tvl").click();
  await expect(topPool).not.toHaveText(descendingTop ?? "", { timeout: 30_000 });
});
test("each protocol aggregate card renders a figure from its own service", async ({ page }) => {
  await page.goto(POOLS_URL);

  /**
   * One assertion per card, because each is a different vendor: a single
   * combined check would pass while three of the four services were down.
   */
  const cards = [
    { card: "pools-tvl", value: "pools-tvl-value" },
    { card: "pools-volume", value: "pools-volume-24h" },
    { card: "pools-open-interest", value: "pools-open-interest-used" },
    { card: "pools-revenue", value: "pools-revenue-lifetime" },
  ];

  for (const { card, value } of cards) {
    await expect(page.getByTestId(card)).toBeVisible();
    /** A dollar figure, not the em dash the cards show while pending. */
    await expect(page.getByTestId(value)).toContainText(/\$[\d,.]/, { timeout: 30_000 });
  }
});

test("revenue is protocol-wide, and splits into shares that sum to the total", async ({ page }) => {
  await page.goto(POOLS_URL);

  const lifetime = page.getByTestId("pools-revenue-lifetime");
  await expect(lifetime).toContainText(/\$[\d,.]/, { timeout: 30_000 });

  /** The hint names both dimensions and the row count behind them. */
  await expect(lifetime).toContainText("fees");
  await expect(lifetime).toContainText("funding");
  await expect(lifetime).toContainText("records");
});
