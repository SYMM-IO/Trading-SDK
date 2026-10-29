import { expect, test, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  getAbiItem,
  keccak256,
  multicall3Abi,
  toFunctionSelector,
  zeroAddress,
  type Abi,
  type AbiParameter,
  type Hex,
} from "viem";

const OWNER = "0x0AF32c77e9431c8a618E821a719A5cdA9D703F67";
const ROOT = "0x1111111111111111111111111111111111111111";
const VA = "0x2222222222222222222222222222222222222222";
const UNLOCKER = "0x3333333333333333333333333333333333333333";

/** Deterministic read fixtures: every external HTTP request is intercepted; no real writes are possible. */
async function mockDeployment(
  page: Page,
  options: {
    configured?: boolean;
    unavailable?: boolean;
    unsupported?: boolean;
    mockSignature?: boolean;
    mockWriteSuccess?: boolean;
    locked?: readonly string[];
    isolationType?: number;
  } = {},
) {
  const { accountLayerAbi, getChainConfig, INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS, INSTANT_OPEN_TIMELOCK_SELECTORS } =
    await import("@symmio/trading-core");
  const lockedSelectors = options.locked?.map(
    (name) => INSTANT_OPEN_TIMELOCK_SELECTORS[INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.findIndex((item) => item === name)],
  );
  const outerSelector = toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name: "_call" }));
  const reads: string[] = [];
  const writes: string[] = [];
  const state = { minimum: 300, now: 1_800_000_000n, scheduledAt: 0n };
  function empty(parameter: AbiParameter): unknown {
    if (parameter.type.endsWith("[]")) return [];
    if (parameter.type === "tuple" && "components" in parameter)
      return Object.fromEntries(parameter.components.map((item) => [item.name, empty(item)]));
    if (parameter.type === "address") return zeroAddress;
    if (parameter.type === "bool") return false;
    if (parameter.type === "string") return "";
    if (parameter.type === "bytes") return "0x";
    if (parameter.type.startsWith("bytes")) return `0x${"00".repeat(Number(parameter.type.slice(5)))}`;
    return 0n;
  }
  function call(data: Hex): Hex {
    const abi = [...accountLayerAbi, ...multicall3Abi] as Abi;
    const decoded = decodeFunctionData({ abi, data });
    const name = decoded.functionName;
    const item = abi.find((entry) => entry.type === "function" && entry.name === name);
    if (!item || item.type !== "function") throw new Error("Unknown read");
    let result: unknown = item.outputs.length === 1 ? empty(item.outputs[0]!) : item.outputs.map(empty);
    if (name === "aggregate3")
      result = (decoded.args![0] as { callData: Hex }[]).map((entry) => {
        try {
          return { success: true, returnData: call(entry.callData) };
        } catch {
          return { success: false, returnData: "0x" };
        }
      });
    if (name === "getVirtualAccount")
      result = { ...(result as object), accountAddress: VA, parentAccount: ROOT, isExists: decoded.args![0] === VA };
    if (name === "getSubAccount")
      result = {
        ...(result as object),
        accountAddress: ROOT,
        owner: OWNER,
        isExists: true,
        isolationType: options.isolationType ?? 1,
      };
    if (name === "minTimelockDelay") result = 120n;
    if (name === "getSelectorTimelock") {
      reads.push(String(decoded.args![0]));
      const locked =
        decoded.args![1] !== outerSelector &&
        (options.configured || lockedSelectors?.includes(decoded.args![1] as Hex));
      result = { unlocker: locked ? UNLOCKER : zeroAddress, delay: locked ? 300n : 0n };
    }
    if (name === "getSchedule") result = { scheduledAt: state.scheduledAt, nonce: 0 };
    if (name === "scheduleGracePeriod") result = 120n;
    return encodeFunctionResult({ abi, functionName: name, result });
  }
  await page.route("https://**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith("/info")) {
      await route.fulfill({
        status: options.unavailable ? 503 : 200,
        json:
          options.unavailable || options.unsupported
            ? {}
            : {
                timelock_approval: {
                  unlocker: UNLOCKER,
                  min_timelock_delay_seconds: state.minimum,
                  validity_seconds: 300,
                  request_domain: {
                    name: "SymmioTimelockApprovalRequest",
                    version: "1",
                    chainId: "42161",
                    verifyingContract: getChainConfig(42161).addresses.accountLayerAddress,
                  },
                },
              },
      });
      return;
    }
    if (request.url().includes("timelock-approval")) {
      writes.push("approval");
      if (options.mockWriteSuccess) {
        const payload = request.postDataJSON();
        await route.fulfill({
          json: {
            account: ROOT,
            unlocker: UNLOCKER,
            call_data_hash: keccak256(payload.signedOperation.callData as Hex),
            deadline: Number(state.now + 120n),
            salt: `0x${"44".repeat(32)}`,
            signature: `0x${"11".repeat(65)}`,
            approval_hash: `0x${"55".repeat(32)}`,
            remaining_approvals: 2,
          },
        });
        return;
      }
      await route.abort();
      return;
    }
    let body;
    try {
      body = request.postDataJSON();
    } catch {
      await route.abort();
      return;
    }
    if (!body) {
      await route.abort();
      return;
    }
    function rpc(entry: { id: number; method: string; params?: [{ data?: Hex }] }) {
      try {
        let result: unknown = "0x0";
        if (entry.method.startsWith("eth_sign") && options.mockSignature) {
          writes.push(entry.method);
          return { jsonrpc: "2.0", id: entry.id, result: `0x${"11".repeat(64)}1b` };
        }
        if (entry.method.startsWith("eth_send") && options.mockWriteSuccess) {
          writes.push(entry.method);
          return { jsonrpc: "2.0", id: entry.id, result: `0x${"ab".repeat(32)}` };
        }
        if (entry.method.startsWith("eth_send") || entry.method.startsWith("eth_sign")) {
          writes.push(entry.method);
          throw new Error("Writes disabled");
        }
        if (entry.method === "eth_chainId") result = "0xa4b1";
        if (entry.method === "eth_getBlockByNumber")
          result = {
            timestamp: `0x${state.now.toString(16)}`,
            number: "0x1",
            transactions: [],
            hash: `0x${"ab".repeat(32)}`,
          };
        if (entry.method === "eth_call") result = call(entry.params![0].data!);
        if (entry.method === "eth_getTransactionReceipt" && options.mockWriteSuccess)
          result = {
            transactionHash: `0x${"ab".repeat(32)}`,
            transactionIndex: "0x0",
            blockHash: `0x${"cd".repeat(32)}`,
            blockNumber: "0x1",
            from: OWNER,
            to: getChainConfig(42161).addresses.accountLayerAddress,
            cumulativeGasUsed: "0x5208",
            gasUsed: "0x5208",
            contractAddress: null,
            logs: [],
            logsBloom: `0x${"00".repeat(256)}`,
            status: "0x1",
            effectiveGasPrice: "0x1",
            type: "0x2",
          };
        return { jsonrpc: "2.0", id: entry.id, result };
      } catch {
        return { jsonrpc: "2.0", id: entry.id, error: { code: -32000, message: "Unsupported mock request" } };
      }
    }
    await route.fulfill({ json: Array.isArray(body) ? body.map(rpc) : rpc(body) });
  });
  await page.routeWebSocket("wss://**/*", (socket) => socket.close());
  return { reads, writes, state };
}

async function openTimelock(page: Page, account = ROOT) {
  await page.goto("/integration?flow=timelock");
  await page.getByTestId("tab-timelock").click();
  await expect(page.getByTestId("tab-timelock")).toHaveAttribute("aria-selected", "true");
  const connect = page.getByTestId("connect-wallet");
  if (await connect.isVisible()) {
    await connect.click();
    await page.getByTestId("connect-mock").click();
  }
  await page.getByTestId("timelock-account").fill(account);
}

test("virtual-account policy reads the root and reports all 22 missing selectors without signing", async ({ page }) => {
  const mock = await mockDeployment(page);
  await openTimelock(page, VA);
  await expect(page.getByTestId("timelock-policy")).toContainText("0 / 22 selectors configured");
  await expect(page.getByTestId("timelock-setup")).toBeEnabled();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.reads.length).toBeGreaterThanOrEqual(22);
  expect(mock.reads.every((account) => account.toLowerCase() === ROOT)).toBe(true);
  expect(mock.writes).toEqual([]);
});

test("a selector policy can be inspected without signing", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  await openTimelock(page);
  await page.locator("#timelock-selector-input").fill("0x12345678");
  await expect(page.getByTestId("timelock-selector")).toContainText("delay: 300 seconds");
  expect(mock.writes).toEqual([]);
});

test("policy readiness does not assume indexing, and a raised minimum disables withdrawal again", async ({
  page,
}, testInfo) => {
  const mock = await mockDeployment(page, { configured: true });
  await openTimelock(page);
  await expect(page.getByTestId("timelock-policy")).toContainText("22 / 22 selectors configured");
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  await page.getByTestId("timelock-indexing").click();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("timelock.png"), fullPage: true });
  mock.state.minimum = 600;
  await page.getByRole("button", { name: "Refresh policy", exact: true }).click();
  await expect(page.getByTestId("timelock-policy")).toContainText("600 seconds");
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("metadata errors do not become unsupported-deployment success", async ({ page }) => {
  const mock = await mockDeployment(page, { unavailable: true });
  await openTimelock(page);
  await expect(page.getByTestId("timelock-policy").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toHaveCount(0);
  await expect(page.getByText("This deployment does not advertise timelock approvals.")).toHaveCount(0);
  expect(mock.writes).toEqual([]);
});

test("delayed execution uses chain time and cannot execute before cooldown or after expiry", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  mock.state.scheduledAt = mock.state.now;
  await openTimelock(page);
  await page.locator("#timelock-raw").fill("0x12345678");
  await page.locator("#timelock-inner").fill("0x12345678");
  await expect(page.getByTestId("timelock-schedule")).toContainText("Waiting for the on-chain cooldown.");
  await expect(page.getByRole("button", { name: "Execute after cooldown" })).toBeDisabled();
  mock.state.now += 300n;
  await expect(page.getByRole("button", { name: "Execute after cooldown" })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Cancel cooldown" })).toBeEnabled();
  mock.state.now += 121n;
  await expect(page.getByTestId("timelock-schedule")).toContainText("Schedule expired.", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Execute after cooldown" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel cooldown" })).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

test("an unknown approval response is not retried, including after reload", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await page.getByTestId("timelock-early-withdraw").click();
  await expect.poll(() => mock.writes.filter((entry) => entry === "approval").length).toBe(1);
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  await openTimelock(page);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Start cooldown" })).toBeDisabled();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.some((entry) => entry.startsWith("eth_send"))).toBe(false);
});

test("root and virtual accounts share the same unresolved approval journal", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await openTimelock(page, ROOT);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await page.getByTestId("timelock-early-withdraw").click();
  await expect.poll(() => mock.writes.filter((entry) => entry === "approval").length).toBe(1);
  await openTimelock(page, VA);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
});

test("unresolved recovery survives unrelated deployment configuration changes", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await openTimelock(page, ROOT);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await page.getByTestId("timelock-early-withdraw").click();
  await expect.poll(() => mock.writes.filter((entry) => entry === "approval").length).toBe(1);
  await page.evaluate(() => {
    localStorage.setItem(
      "symmio.config.overrides.v4",
      JSON.stringify({
        42161: {
          addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
          priceService: { url: "https://changed-price.example" },
        },
      }),
    );
  });
  await openTimelock(page, ROOT);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
});

test("an unresolved journal from the previous key format is preserved", async ({ page }) => {
  await mockDeployment(page, { configured: true });
  await openTimelock(page, ROOT);
  await page.evaluate(
    ({ root, owner }) => {
      localStorage.setItem(
        `symm:timelock-attempt:old-config:https://old-solver:${root.toLowerCase()}:${owner.toLowerCase()}`,
        "previous pending operation",
      );
    },
    { root: ROOT, owner: OWNER },
  );
  await openTimelock(page, ROOT);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  const legacyKey = `symm:timelock-attempt:old-config:https://old-solver:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  expect(await page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe("previous pending operation");
  await page.evaluate(async (key) => {
    await new Promise<void>((acquired) => {
      void navigator.locks.request(`symm:timelock-lock:${key}`, async () => {
        await new Promise<void>((release) => {
          (window as Window & { releaseLegacyLock?: () => void }).releaseLegacyLock = release;
          acquired();
        });
      });
    });
  }, legacyKey);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear after external reconciliation" }).click();
  await expect(page.getByText("An older tab is processing a protected operation", { exact: false })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe("previous pending operation");
  await page.evaluate(() => (window as Window & { releaseLegacyLock?: () => void }).releaseLegacyLock?.());
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear after external reconciliation" }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBeNull();
});

test("a protected withdrawal confirms one approval and clears its journal", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await page.getByTestId("timelock-early-withdraw").click();
  await expect(page.getByText("Withdrawal initiation confirmed; finalize after the Core cooldown.")).toBeVisible({
    timeout: 20_000,
  });
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.filter((entry) => entry.startsWith("eth_send"))).toHaveLength(1);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
});

test("a protected margin action executes through the SDK and confirms its receipt", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await openTimelock(page, VA);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-action-amount").fill("1");
  const card = page.getByTestId("timelock-account-actions");
  await card.getByRole("button", { name: "Request approval and execute" }).click();
  await expect(card.getByText("Transaction:", { exact: false })).toBeVisible({ timeout: 20_000 });
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.filter((entry) => entry.startsWith("eth_send"))).toHaveLength(1);
});

test("an approval can be requested without sending a transaction", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-request-data").fill("0x12345678");
  const card = page.getByTestId("timelock-request-approval");
  await card.getByRole("button", { name: "Request approval", exact: true }).click();
  await expect(card.getByText("Approval issued and saved for reconciliation.")).toBeVisible();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.some((entry) => entry.startsWith("eth_send"))).toBe(false);
});

test("a protected named batch sends both calls in one transaction", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  await page.locator("#timelock-batch-first").fill("1");
  await page.locator("#timelock-batch-second").fill("2");
  const card = page.getByTestId("timelock-batch");
  await card.getByRole("button", { name: "Authorize and execute batch" }).click();
  await expect(card.getByText("Transaction:", { exact: false })).toBeVisible({ timeout: 20_000 });
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(2);
  expect(mock.writes.filter((entry) => entry.startsWith("eth_send"))).toHaveLength(1);
});

test("the named protected-function inspector exposes all 22 functions and executes one", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  const card = page.getByTestId("timelock-named-function");
  await card.getByRole("combobox", { name: "Protected function" }).click();
  await expect(page.getByRole("option")).toHaveCount(22);
  await page.getByRole("option", { name: "core · allocate", exact: true }).click();
  await card.locator("#timelock-named-arguments").fill('["1000000000000000000"]');
  await card.getByRole("button", { name: "Request approval and execute" }).click();
  await expect(card.getByText("Transaction:", { exact: false })).toBeVisible();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.filter((entry) => entry.startsWith("eth_send"))).toHaveLength(1);
});

test("invalid named-function arguments do not create an approval or recovery record", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await openTimelock(page);
  await page.getByTestId("timelock-indexing").click();
  const card = page.getByTestId("timelock-named-function");
  await card.getByRole("combobox", { name: "Protected function" }).click();
  await page.getByRole("option", { name: "core · allocate", exact: true }).click();
  await card.locator("#timelock-named-arguments").fill('["-1"]');
  await card.getByRole("button", { name: "Request approval and execute" }).click();
  await expect(card.getByRole("button", { name: "Request approval and execute" })).toBeEnabled();
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
  expect(mock.writes).toEqual([]);
});

test("a deployment without metadata retains the legacy withdrawal form", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true });
  await openTimelock(page);
  await expect(page.getByText("This deployment does not advertise timelock approvals.")).toBeVisible();
  await page.getByTestId("tab-withdraw").click();
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

test("an unlocked account can withdraw even when the solver advertises timelocks", async ({ page }) => {
  await mockDeployment(page, { configured: false });
  await openTimelock(page);
  await page.getByTestId("tab-withdraw").click();
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
});

test("a partially locked withdrawal requires indexing acknowledgement only for its protected leg", async ({ page }) => {
  await mockDeployment(page, { locked: ["initiateWithdraw"] });
  await openTimelock(page);
  await page.getByTestId("tab-withdraw").click();
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeDisabled();
  await page.getByTestId("timelock-indexing").click();
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
});
