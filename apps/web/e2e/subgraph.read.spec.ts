import { expect, test, type Locator, type Page } from "@playwright/test";

/** See the note in pools.read.spec.ts on why this is not the config's `127.0.0.1` baseURL. */
const ORIGIN = "http://localhost:3001";

/** Funding-index checkpoints are indexed for every market, so a live read always has rows to page through. */
const CARD_ID = "subgraph-getFundingIndexCheckpoints";

/** The page's sections, in the order the SDK docs group the reads. */
const GROUPS = ["Balance", "Margin & liquidation", "Quotes", "Funding"];

/** Add a param from the card's menu and type its value. The menu renders outside the card, in a portal. */
async function addParam(page: Page, card: Locator, key: string, value: string) {
  await card.getByTestId("subgraph-add-param").click();
  await page.getByTestId(`subgraph-add-${key}`).click();
  await card.getByTestId(`${CARD_ID}-field-${key}-input`).fill(value);
}

async function openRequest(card: Locator) {
  await card.getByTestId("subgraph-request").locator("summary").click();
  return card.getByTestId("subgraph-request-json");
}

test.describe("subgraph page", () => {
  test("lists every read under its group, and builds a card's request from its form", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${ORIGIN}/subgraph`);

    const card = page.getByTestId(CARD_ID);
    await expect(card).toBeVisible({ timeout: 60_000 });
    for (const group of GROUPS) {
      await expect(page.getByRole("button", { name: new RegExp(`^${group}`) })).toBeVisible();
    }
    await expect(page.locator('[data-slot="card"][id^="subgraph-"]')).toHaveCount(10);
    await expect(card.getByTestId("subgraph-endpoint")).toContainText("analytics");

    const request = await openRequest(card);
    await expect(request).toContainText("source");

    await addParam(page, card, "first", "2");
    await expect(request).toContainText("first");

    await card.getByTestId(`${CARD_ID}-field-source-remove`).click();
    await expect(request).not.toContainText("source");
  });

  test("runs a live read, pages by skip, and reopens on its card from its link", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${ORIGIN}/subgraph`);
    const card = page.getByTestId(CARD_ID);
    await expect(card).toBeVisible({ timeout: 60_000 });

    await addParam(page, card, "first", "2");
    await card.getByTestId("subgraph-run").click();

    await expect(card.getByTestId("subgraph-result-count")).toHaveText("2 rows", { timeout: 60_000 });
    await expect(card.getByTestId("subgraph-page-status")).toContainText("Request page 1");

    await card.getByTestId("subgraph-page-next").click();
    await expect(card.getByTestId("subgraph-page-status")).toContainText("Request page 2", { timeout: 60_000 });
    await expect(card.getByTestId(`${CARD_ID}-field-skip-input`)).toHaveValue("2");

    await expect(page).toHaveURL(new RegExp(`[?&]q=.*#${CARD_ID}$`));
    await page.goto(page.url());
    await expect(card.getByTestId(`${CARD_ID}-field-skip-input`)).toHaveValue("2", { timeout: 60_000 });
    await expect(card.getByTestId("subgraph-result-count")).toHaveText("2 rows", { timeout: 60_000 });
    await expect(card).toBeInViewport();
  });
});
