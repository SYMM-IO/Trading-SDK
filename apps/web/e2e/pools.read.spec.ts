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
test("each protocol aggregate card settles against its own service", async ({ page }) => {
  await page.goto(POOLS_URL);

  /**
   * One assertion per card, because each is a different vendor: a single
   * combined check would pass while two of the three services were down.
   *
   * Each card must *settle* — a dollar figure or a rendered error — rather than
   * necessarily showing a figure. These are live third-party services, and one
   * of them genuinely degrades: the inventory service's system-TVL aggregate
   * 404s whenever it cannot price a single constituent token, which is a real
   * state the SDK surfaces as an error and the page must render as one. Asserting
   * a figure here would make the suite fail on someone else's outage.
   */
  const cards = [
    { card: "pools-tvl", value: "pools-tvl-value", error: "pools-tvl-error" },
    { card: "pools-volume", value: "pools-volume-24h", error: "pools-volume-error" },
    { card: "pools-open-interest", value: "pools-open-interest-used", error: "pools-open-interest-error" },
  ];

  for (const { card, value, error } of cards) {
    await expect(page.getByTestId(card)).toBeVisible();

    await expect
      .poll(
        async () => {
          if ((await page.getByTestId(error).count()) > 0) return "error";
          const figure = page.getByTestId(value);
          if ((await figure.count()) === 0) return "pending";
          return /\$[\d,.]/.test(await figure.innerText()) ? "figure" : "pending";
        },
        { timeout: 45_000 },
      )
      .not.toBe("pending");
  }
});

test("a pool's revenue settles against the solver, and names its shares", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(POOLS_URL);

  /** Idle until a pool is picked — the hook gates on the pool's solver market id. */
  await expect(page.getByTestId("pool-revenue-idle")).toBeVisible({ timeout: 30_000 });

  await pickSeriesPool(page);

  /**
   * Settled means a dollar figure, the unlisted note, or a rendered error —
   * live third-party service, same policy as the aggregate cards above.
   */
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId("pool-revenue-error").count()) > 0) return "error";
        if ((await page.getByTestId("pool-revenue-unlisted").count()) > 0) return "unlisted";
        const figure = page.getByTestId("pool-revenue-lifetime");
        if ((await figure.count()) === 0) return "pending";
        return /\$[\d,.]/.test(await figure.innerText()) ? "figure" : "pending";
      },
      { timeout: 45_000 },
    )
    .not.toBe("pending");

  /** When the figure lands, the hint names both shares and the row count behind them. */
  const lifetime = page.getByTestId("pool-revenue-lifetime");
  if ((await lifetime.count()) > 0 && /\$[\d,.]/.test(await lifetime.innerText())) {
    await expect(lifetime).toContainText("fees");
    await expect(lifetime).toContainText("funding");
    await expect(lifetime).toContainText("records");
  }
});

/**
 * A pool with a long realized history, addressed by contract so the pick is
 * deterministic — see the note in pool-detail.read.spec.ts.
 */
const SERIES_POOL = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const SERIES_POOL_LABEL = "SYMM";

/**
 * Pick a pool in the Pool detail section's shared picker, waiting out
 * `PoolSelect`'s debounce. One pick feeds every series card in the section.
 *
 * The first wait is for hydration, not data: the trigger is in the server HTML
 * from the start, but Radix re-renders it once its anchor mounts on the client,
 * and an action that grabs the server-rendered button gets "not attached to the
 * DOM" when that swap lands. The idle placeholder only appears after the
 * client-side catalog read, so it is a reliable "hydrated and settled" signal.
 */
async function pickSeriesPool(page: Page, idPrefix = "pool-detail") {
  const trigger = page.getByTestId(`${idPrefix}-trigger`);
  await expect(trigger).toContainText("Select a pool", { timeout: 30_000 });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.getByTestId(`${idPrefix}-search`).fill(SERIES_POOL);

  const firstOption = page.getByTestId(`${idPrefix}-select`).first();
  await expect(firstOption).toContainText(SERIES_POOL_LABEL, { timeout: 30_000 });
  await firstOption.click();

  await expect(page.getByTestId(`${idPrefix}-trigger`)).toContainText(SERIES_POOL_LABEL);
}

test("the per-pool TVL history settles against the inventory service", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(POOLS_URL);

  /** Idle until a pool is picked — the hook gates on the address. */
  await expect(page.getByTestId("pool-tvl-history-idle")).toBeVisible({ timeout: 30_000 });

  await pickSeriesPool(page);

  /**
   * Settled means rows, the empty note, **or** a rendered error: `tvl-history`
   * is not deployed on every environment and 404s where it is missing, which is
   * a real state the page must show rather than a reason to fail the suite.
   */
  await expect
    .poll(
      async () =>
        (await page.getByTestId("pool-tvl-history-data").count()) +
        (await page.getByTestId("pool-tvl-history-empty").count()) +
        (await page.getByTestId("pool-tvl-history-error").count()),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
});

test("a pool's rewards series and its trailing total both resolve, and the window is switchable", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(POOLS_URL);

  await expect(page.getByTestId("pool-rewards-idle")).toBeVisible({ timeout: 30_000 });

  await pickSeriesPool(page);

  /** The headline and the daily rows come from two different reads on one pool. */
  await expect
    .poll(
      async () =>
        (await page.getByTestId("pool-rewards-data").count()) +
        (await page.getByTestId("pool-rewards-empty").count()) +
        (await page.getByTestId("pool-rewards-error").count()),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);

  /** Switching the window is a new request, not a client-side re-slice. */
  if ((await page.getByTestId("pool-rewards-error").count()) === 0) {
    await expect(page.getByTestId("pool-rewards")).toContainText("last 30 days");
    await page.getByRole("tab", { name: "7 days" }).click();
    await expect(page.getByTestId("pool-rewards")).toContainText("last 7 days");
  }
});

test("a pool's volume series resolves against the solver by its market id", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(POOLS_URL);

  await expect(page.getByTestId("pool-volume-idle")).toBeVisible({ timeout: 30_000 });

  await pickSeriesPool(page);

  /** A listed pool has a `symbolId`; the solver may still answer 400 for one it does not know. */
  await expect
    .poll(
      async () =>
        (await page.getByTestId("pool-volume-data").count()) +
        (await page.getByTestId("pool-volume-empty").count()) +
        (await page.getByTestId("pool-volume-error").count()),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
});
