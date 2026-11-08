import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://localhost:3001";
const STORAGE_KEY = "symmio.config.overrides.v4";
const STAGING_WS = "wss://lowcap-price-staging.enigma.bz/ws";
const CUSTOM_WS = "wss://custom-prices.example/ws";

async function openConfig(page: Page) {
  await page.getByRole("button", { name: /SDK config/ }).click();
}

async function applyStaging(page: Page) {
  await openConfig(page);
  await page.getByRole("button", { name: "Use staging", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  // These configuration regressions do not depend on a live vendor or wallet.
  await page.route(/^https:\/\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.routeWebSocket(/wss:\/\//, (socket) => {
    const name =
      socket.url() === STAGING_WS ? "STAGING_ONLY" : socket.url() === CUSTOM_WS ? "CUSTOM_ONLY" : "PRODUCTION_ONLY";
    socket.send(JSON.stringify([{ name, markPrice: "0.000000123456789" }]));
  });
  await page.goto(`${ORIGIN}/price-service`);
});

test("migrates a saved legacy staging socket without discarding other settings", async ({ page }) => {
  await applyStaging(page);
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved["42161"].priceService.wsUrl = "wss://lowcap-price.rasa.capital/ws";
    saved["42161"].solvers.enigma.name = "Saved staging name";
    localStorage.setItem(key, JSON.stringify(saved));
  }, STORAGE_KEY);
  const sockets: string[] = [];
  await page.routeWebSocket("wss://lowcap-price.rasa.capital/ws", (socket) => sockets.push(socket.url()));
  await page.reload();
  await page.getByTestId("button-watch-enigma-prices").click();
  await expect(page.getByTestId("result-watchEnigmaPrices-data")).toContainText("STAGING_ONLY");
  expect(sockets).toEqual([]);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(saved["42161"].priceService.wsUrl).toBe(STAGING_WS);
  expect(saved["42161"].solvers.enigma.name).toBe("Saved staging name");
});

test("preserves hidden staging and custom settings when applying and resetting an edited field", async ({ page }) => {
  await applyStaging(page);
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved["42161"].priceService = {
      type: "enigma",
      url: "https://custom-prices.example",
      wsUrl: "wss://custom-prices.example/ws",
    };
    saved["42161"].solvers.enigma.priceService = saved["42161"].priceService;
    saved["42161"].solvers.enigma.notifications.searchUrl = "https://custom-notifications.example";
    localStorage.setItem(key, JSON.stringify(saved));
  }, STORAGE_KEY);
  await page.reload();
  await openConfig(page);
  await expect(page.getByRole("button", { name: "Use staging", exact: true })).toBeEnabled();
  await page.locator("#cfg-42161-solver-name").fill("Review staging");
  await page.getByRole("button", { name: "Apply 1", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(saved["42161"].priceService.wsUrl).toBe(CUSTOM_WS);
  expect(saved["42161"].solvers.enigma.priceService.wsUrl).toBe(CUSTOM_WS);
  expect(saved["42161"].solvers.enigma.notifications.searchUrl).toBe("https://custom-notifications.example");
  expect(saved["42161"].solvers.enigma.tpsl).toBeDefined();
  expect(saved["42161"].addresses.symmioAddress).toBe("0x573310dB6d160B26026B8706EBe9831c7dEF1D09");
  await openConfig(page);
  await page.locator("#cfg-42161-solver-name").fill("Enigma");
  await page.getByRole("button", { name: "Apply 1", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const reset = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(reset["42161"].solvers.enigma.name).toBeUndefined();
  expect(reset["42161"].priceService.wsUrl).toBe(CUSTOM_WS);
});

test("keeps staging prices when editing and clears them when switching to production", async ({ page }) => {
  await applyStaging(page);
  await page.getByTestId("button-watch-enigma-prices").click();
  const data = page.getByTestId("result-watchEnigmaPrices-data");
  await expect(data).toContainText("STAGING_ONLY");
  await openConfig(page);
  await page.locator("#cfg-42161-solver-name").fill("Review staging");
  await page.getByRole("button", { name: "Apply 1", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)["42161"].priceService.wsUrl, STORAGE_KEY),
  ).toBe(STAGING_WS);
  await expect(data).toContainText("STAGING_ONLY");
  await expect(data).not.toContainText("PRODUCTION_ONLY");
  await openConfig(page);
  await page.getByRole("button", { name: "Reset to default", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(data).toContainText("PRODUCTION_ONLY");
  await expect(data).not.toContainText("STAGING_ONLY");
});

for (const scenario of ["custom socket", "custom REST host", "different deployment"] as const) {
  test(`keeps deliberate saved settings: ${scenario}`, async ({ page }) => {
    await applyStaging(page);
    const expected = await page.evaluate(
      ({ key, scenario }) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        const chain = saved["42161"];
        chain.priceService.wsUrl = "wss://lowcap-price.rasa.capital/ws";
        if (scenario === "custom socket") chain.priceService.wsUrl = "wss://custom-prices.example/ws";
        if (scenario === "custom REST host") chain.priceService.url = "https://custom-prices.example";
        if (scenario === "different deployment") delete chain.addresses.instantLayerAddress;
        localStorage.setItem(key, JSON.stringify(saved));
        return chain.priceService;
      },
      { key: STORAGE_KEY, scenario },
    );
    await page.reload();
    await openConfig(page);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
    expect(saved["42161"].priceService).toEqual(expected);
  });
}
