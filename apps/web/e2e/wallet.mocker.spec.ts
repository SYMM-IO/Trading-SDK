import { expect, test, type Page } from "@playwright/test";

const instance = process.env.NEXT_PUBLIC_MOCKER_URL || "http://localhost:4600";
const configUrl = new URL("/admin/config/sdk", instance).href;
const regularAccount = "0x1111111111111111111111111111111111111111";
const regularAnalytics = "https://regular.example.test/subgraph";
const regularKey = "symmio.config.overrides.v4";

async function installWallets(page: Page) {
  await page.addInitScript(
    ({ regularKey, regularAnalytics, regularAccount }) => {
      if (!localStorage.getItem(regularKey))
        localStorage.setItem(
          regularKey,
          JSON.stringify({
            42161: { addresses: { affiliatesAddress: regularAccount }, subgraphs: { analytics: regularAnalytics } },
          }),
        );

      for (const [name, rdns] of [
        ["Rabby Wallet", "io.rabby"],
        ["Phantom", "app.phantom"],
      ] as const) {
        const listeners = new EventTarget();
        const info = {
          uuid: crypto.randomUUID(),
          name,
          rdns,
          icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
        };
        let authorized = false;
        const provider = {
          on: listeners.addEventListener.bind(listeners),
          removeListener: listeners.removeEventListener.bind(listeners),
          async request({ method }: { method: string }) {
            if (method === "eth_chainId") return "0xa4b1";
            if (method === "eth_requestAccounts") authorized = true;
            if (method === "eth_accounts" || method === "eth_requestAccounts")
              return authorized ? [regularAccount] : [];
            throw Object.assign(new Error("Unsupported test wallet method"), { code: 4200 });
          },
        };
        const announce = () =>
          window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info, provider } }));
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
      }
    },
    { regularKey, regularAnalytics, regularAccount },
  );
}

test.beforeEach(async ({ page }) => {
  await installWallets(page);
});

/** Both environments can render normally, but external services are never contacted by the test browser. */
async function guardNetwork(page: Page) {
  const remote: string[] = [];
  const local = (url: string) =>
    ["localhost", "127.0.0.1", "[::1]", new URL(instance).hostname].includes(new URL(url).hostname);
  await page.route(/^https?:/, (route) => {
    const url = route.request().url();
    if (local(url)) return route.continue();
    remote.push(url);
    return route.abort();
  });
  await page.routeWebSocket(/^wss?:/, (socket) => {
    if (local(socket.url())) socket.connectToServer();
    else {
      remote.push(socket.url());
      socket.close();
    }
  });
  return remote;
}

async function pickWallet(page: Page) {
  await page.getByTestId("wallet-launcher").click();
  await expect(page.getByRole("button", { name: /Rabby Wallet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Phantom/ })).toBeVisible();
  await expect(page.getByTestId("connect-mocker")).toBeVisible();
}

test("switches the wallet, contracts and services together and restores the regular configuration on exit", async ({
  page,
  request,
}) => {
  const response = await request.get(configUrl);
  expect(response.ok(), "Start a local MOCKER before running these checks").toBe(true);
  const manifest = await response.json();
  const chain = manifest.symmioConfig[manifest.chainId];
  const remote = await guardNetwork(page);
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/config");
  await expect(page.locator("#config-subgraphs")).toContainText(regularAnalytics);
  await pickWallet(page);
  expect(urls).not.toContain(configUrl);
  const previous = await page.evaluate((key) => localStorage.getItem(key), regularKey);
  await page.evaluate(() => localStorage.setItem("symmio.magic.value.v1:markets", "regular history"));
  await page.getByTestId("connect-mocker").click();
  await expect(page.getByTestId("wallet-launcher")).toHaveText("MOCKER");
  await expect(page.locator("#config-subgraphs")).toContainText(chain.subgraphs.analytics);
  await expect(page.locator("#config-notifications")).toContainText(chain.solvers.enigma.notifications.url);
  const wallet = await page.getByTestId("wallet-launcher").getAttribute("title");
  remote.length = 0;
  await page.reload();
  await expect(page.getByTestId("wallet-launcher")).toHaveAttribute("title", wallet!);
  await expect(page.locator("#config-subgraphs")).toContainText(chain.subgraphs.analytics);

  await page.goto("/contracts/subaccounts");
  await expect(
    page.getByTestId("result-getUserSubAccounts-data").or(page.getByTestId("result-getUserSubAccounts-empty")),
  ).toBeVisible();
  expect(urls).toContain(new URL(manifest.rpcUrl).href);
  await page.goto("/solvers");
  await expect.poll(() => urls.some((url) => url.startsWith(chain.solvers.enigma.url))).toBe(true);
  await expect(page.getByTestId("button-solvers-chain-8453")).toHaveCount(0);
  await page
    .locator("#method-watchNotifications")
    .getByRole("textbox", { name: "subAccount (address)" })
    .fill(regularAccount);
  await page.getByTestId("notifications-subscribe").click();
  await expect(page.locator("#method-watchNotifications").getByText("Connected", { exact: true })).toBeVisible();
  await page.getByTestId("notifications-unsubscribe").click();
  await page.getByTestId("input-notif-search-quote-id").fill("1");
  const notificationSearch = page.waitForResponse((response) =>
    response.url().startsWith(chain.solvers.enigma.notifications.searchUrl),
  );
  await page.getByTestId("notif-search-run").click();
  expect((await notificationSearch).ok()).toBe(true);
  await page.goto("/orderbook");
  await expect(page.getByText(/MOCKER serves lowcap markets/)).toBeVisible();
  expect(remote).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("symmio.magic.value.v1:markets"))).toBe("regular history");

  await page.goto("/config");
  await page.getByTestId("wallet-launcher").click();
  await expect(page.getByTestId("chain-switcher-8453")).toHaveCount(0);
  await page.getByTestId("wallet-disconnect").click();
  await expect(page.locator("#config-subgraphs")).toContainText(regularAnalytics);
  expect(await page.evaluate((key) => localStorage.getItem(key), regularKey)).toBe(previous);
  await pickWallet(page);
  await expect(page.getByTestId("chain-switcher-8453")).toBeVisible();
  await page.getByRole("button", { name: /Rabby Wallet/ }).click();
  await expect(page.getByTestId("wallet-launcher")).toHaveAttribute("title", regularAccount);
  await expect(page.locator("#config-subgraphs")).toContainText(regularAnalytics);
});

test("keeps ordinary wallets usable on a failed selection and lets a saved wallet retry or exit", async ({ page }) => {
  const remote = await guardNetwork(page);
  await page.route(configUrl, (route) => route.abort());
  await page.goto("/config");
  await pickWallet(page);
  await page.getByTestId("connect-mocker").click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not connect to MOCKER" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rabby Wallet/ })).toBeEnabled();
  await page.unroute(configUrl);
  await page.getByTestId("connect-mocker").click();
  await expect(page.getByTestId("wallet-launcher")).toHaveText("MOCKER");
  await page.route(configUrl, (route) => route.abort());
  remote.length = 0;
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Could not connect to MOCKER" })).toBeVisible();
  expect(remote).toEqual([]);
  await page.unroute(configUrl);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("wallet-launcher")).toHaveText("MOCKER");

  await page.route(configUrl, (route) => route.abort());
  await page.reload();
  await page.getByRole("button", { name: "Use regular wallets" }).click();
  await expect(page.locator("#config-subgraphs")).toContainText(regularAnalytics);
  await pickWallet(page);
});

test("rejects a manifest that would inherit or contact a public solver price service", async ({ page, request }) => {
  const manifest = await (await request.get(configUrl)).json();
  const solver = manifest.symmioConfig[manifest.chainId].solvers.enigma;
  const valid = solver.priceService;
  const remote = await guardNetwork(page);
  await page.route(configUrl, (route) => route.fulfill({ json: manifest }));
  await page.goto("/config");
  await pickWallet(page);
  delete solver.priceService;
  await page.getByTestId("connect-mocker").click();
  const alert = page.getByRole("dialog").getByRole("alert");
  await expect(alert).toContainText("incomplete Arbitrum configuration");
  solver.priceService = { ...valid, wsUrl: "wss://unexpected.example.test/prices" };
  await page.getByTestId("connect-mocker").click();
  await expect(alert).toContainText("must supply local endpoints");
  await expect(page.getByRole("button", { name: /Rabby Wallet/ })).toBeEnabled();
  expect(remote).not.toContain(solver.priceService.wsUrl);
});
