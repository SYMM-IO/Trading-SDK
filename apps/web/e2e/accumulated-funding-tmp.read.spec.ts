import { expect, test, type Page } from "@playwright/test";

/**
 * TEMPORARY verification spec for the accumulated-funding slice. Delete after use.
 *
 * Driven against `localhost` (not the config's `127.0.0.1` baseURL) so Next's
 * dev-origin check lets the page hydrate, with an injected EIP-1193 stub so the
 * app lands on Arbitrum — the only chain running accumulated funding.
 */
const POSITIONS_URL = "http://localhost:3001/contracts/positions";
const SHOTS = "/tmp/claude-1000/-home-seyyed-dev-symmio-SYMM-Frontier/a35ea1a5-c332-44e4-bf26-f083f4cf9273/scratchpad";
const TEST_EOA = "0x0AF32c77e9431c8a618E821a719A5cdA9D703F67";
/** Arbitrum One, the chain the live accumulated-funding facts were taken on. */
const ARBITRUM_HEX = "0xa4b1";

async function installArbitrumWallet(page: Page) {
  await page.addInitScript(
    ({ account, chainIdHex }) => {
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      const provider = {
        isMetaMask: true,
        async request({ method }: { method: string }) {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [account];
            case "eth_chainId":
              return chainIdHex;
            case "net_version":
              return String(parseInt(chainIdHex, 16));
            case "wallet_switchEthereumChain":
              return null;
            default:
              return null;
          }
        },
        on(event: string, handler: (...args: unknown[]) => void) {
          const set = listeners.get(event) ?? new Set();
          set.add(handler);
          listeners.set(event, set);
        },
        removeListener(event: string, handler: (...args: unknown[]) => void) {
          listeners.get(event)?.delete(handler);
        },
      };
      Object.defineProperty(window, "ethereum", { value: provider, writable: true, configurable: true });
    },
    { account: TEST_EOA, chainIdHex: ARBITRUM_HEX },
  );
}

function attachConsole(page: Page, sink: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      sink.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => sink.push(`[pageerror] ${error.message}`));
}

async function connect(page: Page) {
  const trigger = page.getByTestId("connect-wallet");
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
    await page.getByTestId("connect-injected").click();
  }
  await expect(page.getByTestId("chain-switcher-42161")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
}

test("getFundingFeesOfPartyB card reads the SYMM pair state on Arbitrum", async ({ page }) => {
  const logs: string[] = [];
  attachConsole(page, logs);
  await installArbitrumWallet(page);
  await page.goto(POSITIONS_URL);
  await connect(page);

  const card = page.getByTestId("method-getFundingFeesOfPartyB");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();

  /** Idle copy before the read. */
  await expect(card.getByTestId("result-getFundingFeesOfPartyB-idle")).toBeVisible();
  console.log("PARTYB_HINT:", await card.locator("text=Leave empty to use").first().innerText());
  await page.screenshot({ path: `${SHOTS}/funding-fees-card-idle.png`, fullPage: false });

  /** Pick the SYMM market (symbol id 1) from the combobox. */
  await card.getByTestId("input-funding-fees-market-trigger").click();
  await page.getByTestId("input-funding-fees-market-search").fill("SYMM");
  const options = page.getByTestId("input-funding-fees-market-select");
  await expect(options.first()).toBeVisible({ timeout: 30_000 });
  const labels = await options.allInnerTexts();
  console.log("MARKET_OPTIONS:", JSON.stringify(labels));
  const symmOption = options.filter({ hasText: /(^|\n)ID 1$/ }).first();
  await symmOption.click();
  await expect(card.getByTestId("input-funding-fees-market-trigger")).toContainText("SYMM");

  /** partyB left empty → the chain's default solver. */
  await card.getByTestId("button-read-funding-fees-of-party-b").click();

  const data = card.getByTestId("result-getFundingFeesOfPartyB-data");
  const error = card.getByTestId("result-getFundingFeesOfPartyB-error");
  await expect(data.or(error)).toBeVisible({ timeout: 45_000 });
  console.log("FUNDING_FEES_RESULT_START");
  console.log(await data.or(error).innerText());
  console.log("FUNDING_FEES_RESULT_END");

  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.screenshot({ path: `${SHOTS}/funding-fees-card-result.png` });
  await page.screenshot({ path: `${SHOTS}/funding-fees-page.png`, fullPage: false });
  console.log("CONSOLE_LOGS:", JSON.stringify(logs, null, 2));
});

test("getQuote card shows the Pending funding section for quote 153", async ({ page }) => {
  const logs: string[] = [];
  attachConsole(page, logs);
  await installArbitrumWallet(page);
  await page.goto(POSITIONS_URL);
  await connect(page);

  const card = page.getByTestId("method-getQuote");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();

  await card.getByTestId("input-quote-id").fill("153");
  await card.getByTestId("button-read-quote").click();

  const data = card.getByTestId("result-getQuote-data");
  const error = card.getByTestId("result-getQuote-error");
  await expect(data.or(error)).toBeVisible({ timeout: 45_000 });

  /** Give the nested pending-funding read time to resolve. */
  await expect(card.locator("text=Pending funding")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(6_000);

  console.log("GET_QUOTE_RESULT_START");
  console.log(await data.or(error).innerText());
  console.log("GET_QUOTE_RESULT_END");

  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/get-quote-153-card.png` });
  console.log("CONSOLE_LOGS:", JSON.stringify(logs, null, 2));
});
