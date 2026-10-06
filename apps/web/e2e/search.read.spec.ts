import { expect, test, type Page } from "@playwright/test";
import { GASLESS_METHODS } from "../src/features/gasless/gasless-methods";
import { navLinks } from "../src/features/layout/nav";
import { MUON_METHODS } from "../src/features/muon/muon-registry";
import { CARD_CATALOG } from "../src/features/search/card-catalog";
import { SOLVER_METHODS } from "../src/features/solvers/solver-methods";

/** See the note in pools.read.spec.ts on why this is not the config's `127.0.0.1` baseURL. */
const ORIGIN = "http://localhost:3001";

/** Where a card's top rests after a landing: below the fixed header, at its `scroll-mt-24` margin. */
const RESTING_TOP = { min: 64, max: 140 };

/**
 * The cards each pure-data list says a page renders, minus any that render only
 * in some states. Contracts is absent: its pages render from `METHOD_REGISTRY`,
 * so a listed card that does not render cannot happen there.
 */
const LISTED: Record<string, readonly string[]> = {
  ...Object.fromEntries(
    Object.entries(CARD_CATALOG).map(([href, cards]) => [
      href,
      cards.filter((card) => !card.gate).map((card) => card.id),
    ]),
  ),
  "/muon": MUON_METHODS.map((method) => method.id),
  "/solvers": SOLVER_METHODS.map((method) => method.id),
  "/gasless": GASLESS_METHODS.map((method) => method.id),
};

interface RenderedCard {
  id: string;
  title: string;
}

/** Open the palette with ⌘K / Ctrl+K, retrying until hydration has attached the shortcut. */
async function openPalette(page: Page) {
  const listbox = page.getByRole("listbox");
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(listbox).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
}

/** Every design-system card on the page that search could land on. */
function renderedCards(page: Page): Promise<RenderedCard[]> {
  return page.$$eval('[data-slot="card"][id]', (cards) =>
    cards.map((card) => ({
      id: card.id,
      title: card.querySelector('[data-slot="card-title"]')?.textContent?.trim() ?? "",
    })),
  );
}

/** The palette's "On this page" rows: where each leads, and the title it shows. */
function onThisPageRows(page: Page): Promise<{ anchor: string; title: string }[]> {
  return page.$$eval('[data-command-item^="here@"] [data-search-href]', (rows) =>
    rows.map((row) => ({
      anchor: decodeURIComponent(new URL(row.getAttribute("data-search-href") ?? "", location.origin).hash.slice(1)),
      title: row.querySelector(":scope > div:first-of-type > span:first-child")?.textContent?.trim() ?? "",
    })),
  );
}

test.describe("command-palette search", () => {
  test("lists every card of every page under its own title, and every listed card renders", async ({ page }) => {
    test.setTimeout(900_000);

    await page.goto(`${ORIGIN}/contracts`);
    const contractPages = await page.$$eval('a[href^="/contracts/"]', (links) =>
      [...new Set(links.map((link) => link.getAttribute("href") ?? ""))].filter(Boolean),
    );
    expect(contractPages.length).toBeGreaterThan(0);

    for (const path of [...navLinks.map((link) => link.href), ...contractPages]) {
      await test.step(path, async () => {
        await page.goto(`${ORIGIN}${path}`);
        await openPalette(page);

        const cards = await renderedCards(page);
        const rows = await onThisPageRows(page);
        await page.keyboard.press("Escape");

        for (const card of cards) {
          const listed = rows.filter((row) => row.anchor === card.id);
          expect.soft(listed.length, `${path}: card #${card.id} ("${card.title}") is not in search`).toBeGreaterThan(0);
          if (card.title && listed.length > 0) {
            expect
              .soft(
                listed.map((row) => row.title),
                `${path}: card #${card.id} is searchable under another title`,
              )
              .toContain(card.title);
          }
        }

        const renderedIds = new Set(cards.map((card) => card.id));
        for (const id of LISTED[path] ?? []) {
          expect.soft(renderedIds.has(id), `${path}: listed card #${id} does not render`).toBe(true);
        }
      });
    }
  });

  test("lands directly on a card on another page", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${ORIGIN}/muon`);
    await openPalette(page);
    await page.keyboard.type("cancelWithdraw");
    await expect(page.locator('[data-search-href="/pools#method-cancelWithdraw"]')).toBeVisible();
    await page.keyboard.press("Enter");

    await page.waitForURL(`${ORIGIN}/pools#method-cancelWithdraw`, { timeout: 120_000 });
    const card = page.locator('[data-slot="card"]#method-cancelWithdraw');
    await expect(card).toHaveAttribute("data-arrived", "", { timeout: 15_000 });
    await expect(card).toBeFocused();
    await expect(async () => {
      const top = (await card.boundingBox())?.y ?? Number.NaN;
      expect(top).toBeGreaterThanOrEqual(RESTING_TOP.min);
      expect(top).toBeLessThanOrEqual(RESTING_TOP.max);
    }).toPass({ timeout: 10_000 });
  });

  test("glides to a card on the same page", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${ORIGIN}/pools`);
    await openPalette(page);
    await page.keyboard.type("retryListing");
    await expect(page.locator('[data-search-href="/pools#method-retryListing"]')).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(`${ORIGIN}/pools#method-retryListing`);
    const card = page.locator('[data-slot="card"]#method-retryListing');
    await expect(card).toHaveAttribute("data-arrived", "", { timeout: 15_000 });
    await expect(card).toBeInViewport();
  });

  test("opens the integration console on a searched flow", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${ORIGIN}/pools`);
    await openPalette(page);
    await page.keyboard.type("close all");
    /** The exact flow outranks every card that merely mentions closing, so it is the row Enter takes. */
    await expect(
      page.locator('[aria-selected="true"] [data-search-href^="/integration?flow=close-all"]'),
    ).toBeVisible();
    await page.keyboard.press("Enter");

    await page.waitForURL(`${ORIGIN}/integration?flow=close-all#integration-console`, { timeout: 120_000 });
    await expect(page.getByTestId("tab-close-all")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-slot="card"]#integration-console')).toHaveAttribute("data-arrived", "", {
      timeout: 15_000,
    });
  });

  test("lands a shared card link on its card", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${ORIGIN}/pools#method-claimProfit`);

    const card = page.locator('[data-slot="card"]#method-claimProfit');
    await expect(card).toHaveAttribute("data-arrived", "", { timeout: 60_000 });
    await expect(async () => {
      const top = (await card.boundingBox())?.y ?? Number.NaN;
      expect(top).toBeGreaterThanOrEqual(RESTING_TOP.min);
      expect(top).toBeLessThanOrEqual(RESTING_TOP.max);
    }).toPass({ timeout: 10_000 });
  });
});
