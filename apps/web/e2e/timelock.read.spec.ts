import { expect, test, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeErrorResult,
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
import { getSessionKeyBlockedReason } from "../src/features/gasless/session-key-write-policy";
import { withSelectedApprovalSigner } from "../src/features/timelock/approval-signer";
import { readScheduledRecovery } from "../src/features/timelock/timelock-recovery-codec";

const OWNER = "0x0AF32c77e9431c8a618E821a719A5cdA9D703F67";
const ROOT = "0x1111111111111111111111111111111111111111";
const VA = "0x2222222222222222222222222222222222222222";
const UNLOCKER = "0x3333333333333333333333333333333333333333";

test("protected approval uses the selected session key only for delegated gasless writes", () => {
  const onApproval = () => undefined;
  const authorization = Object.freeze({ capability: {} as never, provider: {} as never, deadline: 1n, onApproval });
  const signed = { approval: {} as never };
  expect(withSelectedApprovalSigner(authorization, { gasless: true, from: VA })).toEqual({
    ...authorization,
    approvalSigner: VA,
  });
  expect(withSelectedApprovalSigner(authorization, { gasless: true })).toBe(authorization);
  expect(withSelectedApprovalSigner(authorization, { gasless: undefined, from: VA })).toBe(authorization);
  expect(withSelectedApprovalSigner(authorization, { gasless: false, from: VA })).toBe(authorization);
  expect(withSelectedApprovalSigner(signed, { gasless: true, from: VA })).toBe(signed);
  expect(withSelectedApprovalSigner(undefined, { gasless: true, from: VA })).toBeUndefined();
});

test("standard session-key grants do not expose unsupported timelock writes", () => {
  for (const method of [
    "setupTimelocks",
    "clearTimelocks",
    "earlyWithdraw",
    "timelockScheduleRecovery",
    "timelockProtectedCall",
    "timelockProtectedBatch",
    "timelockAccount:allocate",
    "timelockAccount:deleteSubAccount",
    "timelockNamed:withdraw",
  ])
    expect(getSessionKeyBlockedReason(method), method).toBeTruthy();
  expect(getSessionKeyBlockedReason("timelockAccount:addMargin")).toBeUndefined();
  expect(getSessionKeyBlockedReason("timelockNamed:removeMargin")).toBeUndefined();
});

test("schedule recovery preserves the original account and accepts legacy records", () => {
  const legacy = { kind: "scheduled-operation", confirmed: true, callData: "0x12345678", innerCallData: "0x12345678" };
  expect(readScheduledRecovery(JSON.stringify(legacy))).toEqual(legacy);
  expect(readScheduledRecovery(JSON.stringify({ ...legacy, originalAccount: VA }))).toEqual({
    ...legacy,
    originalAccount: VA,
  });
  expect(readScheduledRecovery(JSON.stringify({ ...legacy, originalAccount: "not-an-account" }))).toBeUndefined();
});

test("only a definite unsubmitted simulation rejection clears the recovery guard", async () => {
  const { SymmApiError, isDefiniteGaslessSimulationRejection } = await import("@symmio/trading-react");
  const rejection = new SymmApiError({
    code: "GASLESS_RELAY_SUBMIT_FAILED",
    message: "Simulation rejected",
    status: 400,
    statusText: "Bad Request",
    url: "https://gasless.test",
    method: "POST",
    responseData: { detail: { code: "SIMULATION_REVERTED", message: "reverted" } },
  });
  expect(isDefiniteGaslessSimulationRejection({ cause: rejection })).toBe(true);
  expect(isDefiniteGaslessSimulationRejection({ hash: `0x${"12".repeat(32)}`, cause: rejection })).toBe(false);
  expect(isDefiniteGaslessSimulationRejection({ status: 0 })).toBe(false);
  expect(isDefiniteGaslessSimulationRejection({ status: 400, responseData: { detail: { code: "OTHER" } } })).toBe(
    false,
  );
});

test("wallet rejection is not considered unsubmitted when a transaction hash is present", async () => {
  const { isUnsubmittedTimelockWalletRejection } = await import("@symmio/trading-react");
  expect(isUnsubmittedTimelockWalletRejection({ kind: "user-rejected" })).toBe(true);
  expect(isUnsubmittedTimelockWalletRejection({ kind: "user-rejected", cause: { hash: `0x${"12".repeat(32)}` } })).toBe(
    false,
  );
  expect(
    isUnsubmittedTimelockWalletRejection({
      kind: "user-rejected",
      cause: { code: "GASLESS_SUBMIT_UNCONFIRMED" },
    }),
  ).toBe(false);
  expect(isUnsubmittedTimelockWalletRejection({ kind: "user-rejected", responseData: { request_id: "pending" } })).toBe(
    false,
  );
  expect(
    isUnsubmittedTimelockWalletRejection({
      kind: "user-rejected",
      cause: { transactionHash: `0x${"12".repeat(32)}` },
    }),
  ).toBe(false);
  expect(isUnsubmittedTimelockWalletRejection({ kind: "unknown" })).toBe(false);
});

/** Deterministic read fixtures: every external HTTP request is intercepted; no real writes are possible. */
async function mockDeployment(
  page: Page,
  options: {
    configured?: boolean;
    unavailable?: boolean;
    unsupported?: boolean;
    mockSignature?: boolean;
    simulateMarginTimelock?: boolean;
    rejectSignature?: boolean;
    mockWriteSuccess?: boolean;
    rejectWrites?: boolean;
    rejectApproval?: boolean;
    rejectApprovalCode?: number;
    approvalUnavailable?: boolean;
    locked?: readonly string[];
    isolationType?: number;
    delegatedSelectors?: "all" | readonly Hex[];
    rejectDelegation?: boolean | "after-approval";
    failDelegationRead?: boolean;
    independentAccounts?: boolean;
    delegationAccount?: string;
    delegationExpiry?: bigint;
  } = {},
) {
  const {
    accountLayerAbi,
    instantLayerAbi,
    gaslessLayerAbi,
    getChainConfig,
    INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
    INSTANT_OPEN_TIMELOCK_SELECTORS,
  } = await import("@symmio/trading-core");
  const lockedSelectors = options.locked?.map(
    (name) => INSTANT_OPEN_TIMELOCK_SELECTORS[INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.findIndex((item) => item === name)],
  );
  const outerSelector = toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name: "_call" }));
  const reads: string[] = [];
  const writes: string[] = [];
  const writeData: Hex[] = [];
  const approvalSigners: string[] = [];
  let infoReads = 0;
  const state = { minimum: 300, now: 1_800_000_000n, scheduledAt: 0n, delegationRevoked: false };
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
    const abi = [...accountLayerAbi, ...instantLayerAbi, ...gaslessLayerAbi, ...multicall3Abi] as Abi;
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
    if (name === "getUserSubAccounts") {
      const components = (item.outputs[0] as AbiParameter & { components: readonly AbiParameter[] }).components;
      result = [ROOT, VA].map((address) => ({
        ...Object.fromEntries(components.map((component) => [component.name, empty(component)])),
        accountAddress: address,
        owner: OWNER,
        isExists: true,
        isolationType: options.isolationType ?? 1,
      }));
    }
    if (name === "getVirtualAccount")
      result = {
        ...(result as object),
        accountAddress: VA,
        parentAccount: options.independentAccounts ? zeroAddress : ROOT,
        isExists: !options.independentAccounts && decoded.args![0] === VA,
      };
    if (name === "getSubAccount")
      result = {
        ...(result as object),
        accountAddress: options.independentAccounts ? decoded.args![0] : ROOT,
        owner: OWNER,
        isExists: true,
        isolationType: options.isolationType ?? 1,
      };
    if (name === "getActiveDelegations") {
      if (options.failDelegationRead) throw new Error("Delegation read unavailable");
      const delegates = decoded.args![1] as readonly string[];
      const wanted = decoded.args![2] as readonly (readonly Hex[])[];
      result = delegates.map((delegate, index) => ({
        account: decoded.args![0],
        delegatedSigner: delegate,
        selectors: wanted[index]!.filter(
          (selector) =>
            !state.delegationRevoked &&
            (!options.delegationAccount ||
              (decoded.args![0] as { addr: string }).addr.toLowerCase() === options.delegationAccount.toLowerCase()) &&
            (options.delegatedSelectors === "all" || options.delegatedSelectors?.includes(selector)),
        ),
        expiryTimestamp: options.delegationExpiry ?? 2_000_000_000n,
      }));
    }
    if (name === "isDelegationActive") {
      result = options.rejectDelegation === "after-approval" ? !writes.includes("approval") : !options.rejectDelegation;
      if (!result) state.delegationRevoked = true;
    }
    if (name === "instantLayer") result = getChainConfig(42161).addresses.instantLayerAddress;
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
      infoReads++;
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
      approvalSigners.push(request.postDataJSON().signedOperation.signer);
      if (options.approvalUnavailable) {
        await route.fulfill({ status: 503, json: {} });
        return;
      }
      if (options.rejectApprovalCode) {
        await route.fulfill({
          status: 400,
          json: {
            code: options.rejectApprovalCode,
            error_category: "account_state",
            error_message: "Policy not ready",
          },
        });
        return;
      }
      if (options.rejectApproval) {
        await route.fulfill({
          status: 400,
          json: { code: 3703, error_category: "account_state", error_message: "Pending open" },
        });
        return;
      }
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
        if (entry.method.startsWith("eth_sign") && options.rejectSignature) {
          writes.push(entry.method);
          return { jsonrpc: "2.0", id: entry.id, error: { code: 4001, message: "User rejected the request" } };
        }
        if (entry.method.startsWith("eth_sign") && options.mockSignature) {
          writes.push(entry.method);
          return { jsonrpc: "2.0", id: entry.id, result: `0x${"11".repeat(64)}1b` };
        }
        if (entry.method.startsWith("eth_send") && options.rejectWrites) {
          writes.push(entry.method);
          return { jsonrpc: "2.0", id: entry.id, error: { code: 4001, message: "User rejected the request" } };
        }
        if (entry.method.startsWith("eth_send") && options.mockWriteSuccess) {
          writes.push(entry.method);
          if (entry.params?.[0]?.data) writeData.push(entry.params[0].data);
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
        if (entry.method === "eth_call") {
          const data = entry.params![0].data!;
          if (
            options.simulateMarginTimelock &&
            data.startsWith(toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name: "addMargin" })))
          )
            return {
              jsonrpc: "2.0",
              id: entry.id,
              error: {
                code: 3,
                message: "execution reverted",
                data: encodeErrorResult({
                  abi: accountLayerAbi,
                  errorName: "TimelockOpNotApprovedOrScheduled",
                  args: [ROOT, `0x${"00".repeat(32)}`],
                }),
              },
            };
          result = call(data);
        }
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
  return {
    reads,
    writes,
    writeData,
    approvalSigners,
    state,
    get infoReads() {
      return infoReads;
    },
  };
}

async function openTimelock(page: Page, account = ROOT, expandSections = true) {
  await page.goto("/contracts/timelock", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await page.getByTestId("timelock-account").fill(account);
  if (!expandSections) return;
  const policy = page.getByTestId("timelock-policy");
  await expect(policy).toBeVisible();
  await expect
    .poll(async () => {
      const text = await policy.innerText();
      return (
        text.includes("selectors configured") ||
        text.includes("does not advertise") ||
        (await policy.getByRole("alert").count()) > 0
      );
    })
    .toBe(true);
  const operations = page.getByRole("button", { name: /^Protected operations/ });
  if (await operations.count()) {
    if ((await operations.getAttribute("aria-expanded")) === "false") await operations.click();
  }
  const recovery = page.getByRole("button", { name: /^Delayed recovery/ });
  await expect(recovery).toBeVisible();
  if ((await recovery.getAttribute("aria-expanded")) === "false") await recovery.click();
}

async function openWithdrawal(page: Page) {
  const account = await page.getByTestId("timelock-account").inputValue();
  await page.goto("/integration?flow=withdraw", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await page.getByTestId(`subaccount-${account}`).click();
}

async function continueToWithdrawal(page: Page) {
  const button = page.getByRole("button", { name: "Continue to withdrawal" });
  const amount = page.getByTestId("integration-withdraw-amount");
  await expect(button.or(amount)).toBeVisible();
  if (await button.isVisible()) {
    try {
      // Setup can auto-advance between the visibility read and the click.
      await button.click({ timeout: 1000 });
    } catch (error) {
      if (!(await amount.isVisible())) throw error;
    }
  }
  await expect(amount).toBeVisible();
}

async function connectMockWallet(page: Page) {
  const connect = page.getByTestId("connect-wallet");
  if (await connect.isVisible()) {
    // Let the client hydrate before clicking; otherwise the layout can move
    // between hit-testing and the click during a fresh Next.js navigation.
    await page.waitForLoadState("networkidle");
    await connect.click();
    await page.getByTestId("connect-mock").click();
  }
}

async function enableTimelockSolver(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("symmio.config.overrides.v4") !== null) return;
    localStorage.setItem(
      "symmio.config.overrides.v4",
      JSON.stringify({
        42161: {
          addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
          solvers: { enigma: { capabilities: { timelockApproval: true } } },
        },
      }),
    );
  });
}

test("setup includes a protection step in each track without a separate integration tab", async ({ page }) => {
  await mockDeployment(page);
  await enableTimelockSolver(page);
  await page.goto("/integration", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await expect(page.getByTestId("tab-timelock")).toHaveCount(0);
  await page.getByTestId("setup-track-wallet").click();
  await expect(page.getByTestId("step-3")).toContainText("Setup timelock");
  await page.getByTestId("setup-track-gasless").click();
  await expect(page.getByTestId("step-4")).toContainText("Setup timelock");
  await page.getByTestId("setup-track-session-key").click();
  await expect(page.getByTestId("step-5")).toContainText("Delegation");
  await expect(page.getByTestId("step-6")).toContainText("Setup timelock");
});

test("setup keeps the optional protection step when the solver has no timelock capability", async ({ page }) => {
  await mockDeployment(page, { unsupported: true });
  await enableTimelockSolver(page);
  await page.goto("/integration", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await page.getByTestId("setup-track-wallet").click();
  await expect(page.getByTestId("step-3")).toContainText("Setup timelock");
  await page.getByTestId("setup-track-session-key").click();
  await expect(page.getByTestId("step-6")).toContainText("Setup timelock");
});

test("timelock contract groups preserve entered recovery data when collapsed", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page, ROOT, false);
  await expect(page.getByTestId("wallet-address")).toBeVisible();
  const policy = page.getByRole("button", { name: /^Policy/ });
  const operations = page.getByRole("button", { name: /^Protected operations/ });
  const recovery = page.getByRole("button", { name: /^Delayed recovery/ });
  await expect(policy).toHaveAttribute("aria-expanded", "true");
  await expect(operations).toHaveAttribute("aria-expanded", "false");
  await expect(recovery).toHaveAttribute("aria-expanded", "false");
  await operations.click();
  await expect(operations).toHaveAttribute("aria-expanded", "true");
  await recovery.click();
  const raw = page.locator("#timelock-raw");
  await raw.fill("0x12345678");
  await recovery.click();
  await expect(recovery).toHaveAttribute("aria-expanded", "false");
  await recovery.click();
  await expect(raw).toHaveValue("0x12345678");
  expect(mock.writes).toEqual([]);
});

test("saved scheduled recovery opens its section automatically", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  mock.state.scheduledAt = mock.state.now;
  const key = `symm:timelock-attempt:v2:42161:${getChainConfig(42161).addresses.accountLayerAddress.toLowerCase()}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const recovery = JSON.stringify({
    kind: "scheduled-operation",
    confirmed: true,
    callData: "0x12345678",
    innerCallData: "0x12345678",
    originalAccount: ROOT,
  });
  await page.addInitScript(({ key, recovery }) => localStorage.setItem(key, recovery), { key, recovery });
  await openTimelock(page, ROOT, false);
  const section = page.getByRole("button", { name: /^Delayed recovery/ });
  await expect(section).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
  expect(mock.writes).toEqual([]);
});

test("direct policy configuration is available without solver metadata", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-manual-setup");
  await expect(page.getByTestId("timelock-policy")).toContainText("22 selectors");
  await expect(page.getByTestId("timelock-policy")).toContainText("does not advertise timelock approvals");
  await expect(
    page.getByTestId("timelock-policy").getByRole("link", { name: "configure protection directly in Contracts" }),
  ).toHaveAttribute("href", `/contracts/timelock?account=${ROOT}`);
  await expect(card).toContainText("22 protected selectors");
  await expect(card.getByRole("button", { name: "Configure protection" })).toBeDisabled();
  await card.locator("#timelock-manual-unlocker").fill(UNLOCKER);
  await card.locator("#timelock-manual-delay").fill("300");
  await expect(card.getByRole("button", { name: "Configure protection" })).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

test("direct setup sends one owner transaction without solver metadata", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true, mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-manual-setup");
  await card.locator("#timelock-manual-unlocker").fill(UNLOCKER);
  await card.locator("#timelock-manual-delay").fill("300");
  const submit = card.getByRole("button", { name: "Configure protection" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => mock.writes.filter((method) => method.startsWith("eth_send")).length).toBe(1);
  await expect(card.getByRole("link", { name: "View transaction on block explorer" })).toBeVisible();
  await expect(submit).toBeDisabled();
});

test("scheduled execution is available without a solver when no earlier request is pending", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true, configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const panel = page.getByTestId("timelock-schedule");
  await panel.locator("#timelock-raw").fill("0x12345678");
  await panel.locator("#timelock-inner").fill("0x12345678");
  const start = panel.getByRole("button", { name: "Start cooldown" });
  await expect(start).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

test("direct setup blocks replacing an existing policy without solver metadata", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true, configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-manual-setup");
  await card.locator("#timelock-manual-unlocker").fill(UNLOCKER);
  await card.locator("#timelock-manual-delay").fill("300");
  await expect(card.getByText(/Existing policies are preserved/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Configure protection" })).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("direct setup adds missing policies without replacing existing ones", async ({ page }) => {
  const { accountLayerAbi, INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS, INSTANT_OPEN_TIMELOCK_SELECTORS } =
    await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { unsupported: true, locked: ["initiateWithdraw"], mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-manual-setup");
  await card.locator("#timelock-manual-unlocker").fill(UNLOCKER);
  await card.locator("#timelock-manual-delay").fill("300");
  const submit = card.getByRole("button", { name: "Configure protection" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => mock.writeData.length).toBe(1);
  const transaction = decodeFunctionData({ abi: accountLayerAbi, data: mock.writeData[0]! });
  expect(transaction.functionName).toBe("setupTimelocks");
  if (transaction.functionName !== "setupTimelocks") throw new Error("Unexpected transaction");
  const protectedSelector =
    INSTANT_OPEN_TIMELOCK_SELECTORS[INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.indexOf("initiateWithdraw")];
  expect(transaction.args[3]).toHaveLength(21);
  expect(transaction.args[3]).not.toContain(protectedSelector);
});

test("selector policy can be inspected without solver metadata", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true, configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-selector-field").fill("0x12345678");
  await expect(page.getByTestId("timelock-selector")).toContainText("delay: 300 seconds");
  expect(mock.writes).toEqual([]);
});

test("virtual-account policy reads the root and reports all 22 missing selectors without signing", async ({ page }) => {
  const mock = await mockDeployment(page);
  await enableTimelockSolver(page);
  await openTimelock(page, VA);
  await expect(page.getByTestId("timelock-policy")).toContainText("0 / 22 selectors configured");
  await expect(page.getByTestId("timelock-setup")).toBeEnabled();
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.reads.length).toBeGreaterThanOrEqual(22);
  expect(mock.reads.every((account) => account.toLowerCase() === ROOT)).toBe(true);
  expect(mock.writes).toEqual([]);
});

test("a rejected setup can be retried without a refresh", async ({ page }) => {
  const mock = await mockDeployment(page, { rejectWrites: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const button = page.getByRole("button", { name: "Configure trading protection" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByTestId("timelock-policy").getByRole("alert")).toBeVisible();
  await expect(button).toBeEnabled();
  expect(mock.writes.filter((method) => method.startsWith("eth_send"))).toHaveLength(1);
  await button.click();
  await expect.poll(() => mock.writes.filter((method) => method.startsWith("eth_send")).length).toBe(2);
});

test("policy card uses its gasless control for the setup transaction", async ({ page }) => {
  const { accountLayerAbi } = await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-policy-card");
  const relay = card.getByTestId("gasless-toggle-setupTimelocks");
  await expect(relay).toBeVisible();
  if ((await relay.getAttribute("aria-checked")) === "true") await relay.click();
  await expect(relay).toHaveAttribute("aria-checked", "false");
  await card.getByTestId("timelock-setup").click();
  await expect.poll(() => mock.writeData.length).toBe(1);
  expect(decodeFunctionData({ abi: accountLayerAbi, data: mock.writeData[0]! }).functionName).toBe("setupTimelocks");
});

test("timelock write controls follow the selected operation", async ({ page }) => {
  await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await expect(
    page.getByTestId("timelock-direct-setup-card").getByTestId("gasless-toggle-setupTimelocks"),
  ).toBeVisible();
  await expect(
    page.getByTestId("timelock-selector-policy-card").getByTestId("gasless-toggle-clearTimelocks"),
  ).toBeVisible();
  await expect(page.getByTestId("timelock-withdrawal-card").getByTestId("gasless-toggle-earlyWithdraw")).toBeVisible();
  await expect(
    page.getByTestId("timelock-protected-call-card").getByTestId("gasless-toggle-timelockProtectedCall"),
  ).toBeVisible();
  await expect(
    page.getByTestId("timelock-batch-card").getByTestId("gasless-toggle-timelockProtectedBatch"),
  ).toBeVisible();
  await expect(
    page.getByTestId("timelock-delayed-recovery-card").getByTestId("gasless-toggle-timelockScheduleRecovery"),
  ).toBeVisible();
  await expect(page.getByTestId("timelock-approval-card").getByTestId(/gasless-toggle-/)).toHaveCount(0);
  const actions = page.getByTestId("timelock-account-actions-card");
  await expect(actions.getByTestId("gasless-toggle-timelockAccount:addMargin")).toBeVisible();
  await actions.getByRole("combobox", { name: "Protected action" }).click();
  await page.getByRole("option", { name: "removeMargin" }).click();
  await expect(actions.getByTestId("gasless-toggle-timelockAccount:removeMargin")).toBeVisible();
  const named = page.getByTestId("timelock-function-card");
  await expect(named.getByTestId("gasless-toggle-timelockNamed:withdraw")).toBeVisible();
  await named.getByRole("combobox", { name: "Protected function" }).click();
  await page.getByRole("option", { name: "core · allocate" }).click();
  await expect(named.getByTestId("gasless-toggle-timelockNamed:allocate")).toBeVisible();
});

test("a selector policy can be inspected without signing", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-selector-field").fill("0x12345678");
  await expect(page.getByTestId("timelock-selector")).toContainText("delay: 300 seconds");
  expect(mock.writes).toEqual([]);
});

test("timelock selector picker preserves manual selector inspection", async ({ page }) => {
  const { INSTANT_OPEN_TIMELOCK_SELECTORS } = await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const selector = page.getByTestId("timelock-selector");
  await selector.getByRole("button", { name: "Browse timelock selectors" }).click();
  const choices = page.getByTestId("timelock-selector-list-select");
  await expect(choices).toHaveCount(22);
  await choices.filter({ hasText: "withdrawTo" }).click();
  await expect(selector.getByTestId("timelock-selector-field")).toHaveValue(INSTANT_OPEN_TIMELOCK_SELECTORS[1]!);
  await expect(selector).toContainText("delay: 300 seconds");
  await selector.getByTestId("timelock-selector-field").fill("0x12345678");
  await expect(selector.getByTestId("timelock-selector-field")).toHaveValue("0x12345678");
  await expect(selector).toContainText("delay: 300 seconds");
  expect(mock.writes).toEqual([]);
});

test("clearing a protected selector schedules its exact calldata", async ({ page }) => {
  const { accountLayerAbi, INSTANT_OPEN_TIMELOCK_SELECTORS } = await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { configured: true, mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const card = page.getByTestId("timelock-selector-policy-card");
  const relay = card.getByTestId("gasless-toggle-clearTimelocks");
  if ((await relay.getAttribute("aria-checked")) === "true") await relay.click();
  await card.getByRole("button", { name: "Browse timelock selectors" }).click();
  await page.getByTestId("timelock-selector-list-select").filter({ hasText: "withdrawTo" }).click();
  const panel = card.getByTestId("timelock-schedule");
  await expect(panel.getByRole("button", { name: "Execute", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Start cooldown" }).click();
  await expect.poll(() => mock.writeData.length).toBe(1);
  const transaction = decodeFunctionData({ abi: accountLayerAbi, data: mock.writeData[0]! });
  expect(transaction.functionName).toBe("scheduleTimelockOp");
  if (transaction.functionName !== "scheduleTimelockOp") throw new Error("Unexpected transaction");
  const { encodeFunctionData, keccak256 } = await import("viem");
  const raw = encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "clearTimelocks",
    args: [ROOT, [INSTANT_OPEN_TIMELOCK_SELECTORS[1]!]],
  });
  expect(transaction.args[1]).toBe(keccak256(raw));
  await expect(panel.getByText("Schedule confirmed.")).toBeVisible();
  mock.state.scheduledAt = mock.state.now;
  await openTimelock(page);
  const restored = page.getByTestId("timelock-selector-policy-card").getByTestId("timelock-schedule");
  await expect(restored).toBeVisible();
  await expect(restored.getByRole("button", { name: /^Cooldown ·/ })).toBeDisabled();
  mock.state.now += 301n;
  await expect(restored.getByRole("button", { name: "Execute", exact: true })).toBeEnabled({ timeout: 15_000 });
  await restored.getByRole("button", { name: "Execute", exact: true }).click();
  await expect.poll(() => mock.writeData.length).toBe(2);
  const execution = decodeFunctionData({ abi: accountLayerAbi, data: mock.writeData[1]! });
  expect(execution.functionName).toBe("executeTimelockOp");
  if (execution.functionName !== "executeTimelockOp") throw new Error("Unexpected execution");
  expect(execution.args[1]).toBe(raw);
  const resetCard = page.getByTestId("timelock-selector-policy-card");
  await expect(resetCard.getByTestId("timelock-selector-field")).toHaveValue("");
  await expect(resetCard.getByRole("button", { name: "Start cooldown" })).toBeDisabled();
});

test("a saved selector removal schedule can be cancelled", async ({ page }) => {
  const { accountLayerAbi, getChainConfig, INSTANT_OPEN_TIMELOCK_SELECTORS } = await import("@symmio/trading-core");
  const { encodeFunctionData, keccak256 } = await import("viem");
  const mock = await mockDeployment(page, { configured: true, mockWriteSuccess: true });
  await enableTimelockSolver(page);
  mock.state.scheduledAt = mock.state.now;
  const raw = encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "clearTimelocks",
    args: [ROOT, [INSTANT_OPEN_TIMELOCK_SELECTORS[1]!]],
  });
  const key = `symm:timelock-attempt:v2:42161:${getChainConfig(42161).addresses.accountLayerAddress.toLowerCase()}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const saved = JSON.stringify({
    kind: "scheduled-operation",
    confirmed: true,
    callData: raw,
    innerCallData: raw,
    originalAccount: ROOT,
  });
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key, saved });
  await openTimelock(page);
  const card = page.getByTestId("timelock-selector-policy-card");
  const relay = card.getByTestId("gasless-toggle-clearTimelocks");
  if ((await relay.getAttribute("aria-checked")) === "true") await relay.click();
  const panel = card.getByTestId("timelock-schedule");
  await panel.getByRole("button", { name: "Cancel cooldown" }).click();
  await expect.poll(() => mock.writeData.length).toBe(1);
  const tx = decodeFunctionData({ abi: accountLayerAbi, data: mock.writeData[0]! });
  expect(tx.functionName).toBe("cancelTimelockOp");
  if (tx.functionName !== "cancelTimelockOp") throw new Error("Unexpected transaction");
  expect(tx.args[1]).toBe(keccak256(raw));
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
});

test("a saved selector removal missing on chain cannot be executed", async ({ page }) => {
  const { accountLayerAbi, getChainConfig, INSTANT_OPEN_TIMELOCK_SELECTORS } = await import("@symmio/trading-core");
  const { encodeFunctionData } = await import("viem");
  const mock = await mockDeployment(page, { configured: false });
  await enableTimelockSolver(page);
  const raw = encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "clearTimelocks",
    args: [ROOT, [INSTANT_OPEN_TIMELOCK_SELECTORS[1]!]],
  });
  const key = `symm:timelock-attempt:v2:42161:${getChainConfig(42161).addresses.accountLayerAddress.toLowerCase()}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const saved = JSON.stringify({
    kind: "scheduled-operation",
    confirmed: true,
    callData: raw,
    innerCallData: raw,
    originalAccount: ROOT,
  });
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key, saved });
  await openTimelock(page);
  const panel = page.getByTestId("timelock-selector-policy-card").getByTestId("timelock-schedule");
  await expect(panel.getByText("The saved schedule was not found on chain.", { exact: false })).toBeVisible();
  await expect(panel.getByText("This policy change does not require a schedule.")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Execute", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Start cooldown" })).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("on-chain policy enables withdrawal, and a raised minimum disables it again", async ({ page }, testInfo) => {
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await expect(page.getByTestId("timelock-policy")).toContainText("22 / 22 selectors configured");
  await page.locator("#timelock-amount").fill("1");
  await page.locator("#timelock-receiver").fill(OWNER);
  await expect(page.getByTestId("timelock-indexing")).toHaveCount(0);
  await expect(page.getByTestId("timelock-early-withdraw")).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("timelock.png"), fullPage: true });
  mock.state.minimum = 600;
  await page.getByRole("button", { name: "Refresh policy", exact: true }).click();
  await expect(page.getByTestId("timelock-policy")).toContainText("600 seconds");
  await expect(page.getByTestId("timelock-early-withdraw")).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("expanded policy shows selector cards with SDK functions and targets", async ({ page }) => {
  const { INSTANT_OPEN_TIMELOCK_SELECTORS } = await import("@symmio/trading-core");
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  const policy = page.getByTestId("timelock-policy");
  await policy.getByText("22 / 22 selectors configured").click();
  const cards = policy.getByTestId("policy-selector-card");
  await expect(cards).toHaveCount(22);
  await expect(cards.filter({ hasText: "withdrawTo" })).toContainText(INSTANT_OPEN_TIMELOCK_SELECTORS[1]!);
  await expect(cards.filter({ hasText: "withdrawTo" })).toContainText("core");
  await expect(cards.filter({ hasText: "addMarginToNextVA" })).toContainText("account-layer");
  expect(mock.writes).toEqual([]);
});

test("refresh policy retries a failed solver info read without sending a transaction", async ({ page }) => {
  const deployment = { unavailable: true, configured: true };
  const mock = await mockDeployment(page, deployment);
  await enableTimelockSolver(page);
  await openTimelock(page);
  const policy = page.getByTestId("timelock-policy");
  await expect(policy.getByRole("alert")).toBeVisible();
  deployment.unavailable = false;
  await policy.getByRole("button", { name: "Refresh policy" }).click();
  await expect(policy).toContainText("22 / 22 selectors configured");
  expect(mock.infoReads).toBeGreaterThanOrEqual(2);
  expect(mock.writes).toEqual([]);
});

test("metadata errors do not become unsupported-deployment success", async ({ page }) => {
  const mock = await mockDeployment(page, { unavailable: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await expect(page.getByTestId("timelock-policy").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("timelock-early-withdraw")).toHaveCount(0);
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
  await expect(page.getByText("This solver does not advertise timelock approvals.")).toHaveCount(0);
  expect(mock.writes).toEqual([]);
});

test("delayed recovery remains accessible when solver metadata is unavailable", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, unavailable: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await expect(page.getByTestId("timelock-policy").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
  expect(mock.writes).toEqual([]);
});

test("protected action does not show a policy card or read the zero account", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  const card = page.getByTestId("method-addMargin");
  await card.locator("#add-margin-va-account").fill("0x0000000000000000000000000000000000000000");
  await card.getByTestId("input-add-margin-amount").fill("1");
  await expect(card.getByTestId("timelock-policy")).toHaveCount(0);
  await expect(card.getByTestId("button-send-add-margin")).toBeDisabled();
  expect(mock.reads).not.toContain("0x0000000000000000000000000000000000000000");
});

test("a timelock-enabled solver exposes delayed recovery from a protected margin action when offline", async ({
  page,
}) => {
  await mockDeployment(page, { configured: true, unavailable: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await page.getByTestId("add-margin-va-account").fill(VA);
  await page.getByTestId("input-add-margin-amount").fill("1");
  const panel = page.getByTestId("timelock-schedule");
  await expect(panel).toBeVisible();
  await expect(panel.locator("#timelock-raw")).toHaveValue(/^0x[0-9a-f]+$/i);
  await expect(panel.locator("#timelock-inner")).toHaveValue(await panel.locator("#timelock-raw").inputValue());
  await expect(panel.locator("#timelock-raw")).toBeDisabled();
});

test("an older saved staging configuration restores timelock routing", async ({ page }) => {
  await mockDeployment(page, { configured: true, unavailable: true });
  await page.addInitScript(() => {
    localStorage.setItem(
      "symmio.config.overrides.v4",
      JSON.stringify({
        42161: {
          addresses: {
            affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
            accountLayerAddress: "0x5733107211B2801Acd39933a54d482FE303c4907",
            instantLayerAddress: "0x89d1e2a9d2429722f756edffad149d7947b672ff",
          },
          solvers: { enigma: { url: "https://arb-staging.enigma.bz/api" } },
        },
      }),
    );
  });
  await openTimelock(page);
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  await page.getByTestId("add-margin-va-account").fill(VA);
  await page.getByTestId("input-add-margin-amount").fill("1");
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
});

test("delayed execution uses chain time and cannot execute before cooldown or after expiry", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  mock.state.scheduledAt = mock.state.now;
  await openTimelock(page);
  await page.locator("#timelock-raw").fill("0x12345678");
  await page.locator("#timelock-inner").fill("0x12345678");
  await expect(page.getByTestId("timelock-schedule")).toContainText("Waiting for the on-chain cooldown.");
  await expect(page.getByRole("button", { name: /^Cooldown ·/ })).toBeDisabled();
  mock.state.now += 300n;
  await expect(page.getByRole("button", { name: "Execute", exact: true })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Cancel cooldown" })).toBeEnabled();
  mock.state.now += 121n;
  await expect(page.getByTestId("timelock-schedule")).toContainText("Schedule expired.", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Execute", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel cooldown" })).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

for (const action of ["Execute", "Cancel cooldown"]) {
  test(`a rejected ${action} preserves the confirmed schedule and allows manual retry`, async ({ page }) => {
    const { getChainConfig } = await import("@symmio/trading-core");
    const mock = await mockDeployment(page, { configured: true, rejectWrites: true });
    await enableTimelockSolver(page);
    mock.state.scheduledAt = mock.state.now - 300n;
    const key = `symm:timelock-attempt:v2:42161:${getChainConfig(42161).addresses.accountLayerAddress.toLowerCase()}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
    const recovery = JSON.stringify({
      kind: "scheduled-operation",
      confirmed: true,
      callData: "0x12345678",
      innerCallData: "0x12345678",
    });
    await page.addInitScript(({ key, recovery }) => localStorage.setItem(key, recovery), { key, recovery });
    await openTimelock(page);
    const button = page.getByRole("button", { name: action, exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByTestId("timelock-schedule").getByRole("alert")).toBeVisible();
    await expect(button).toBeEnabled();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBe(recovery);
    expect(mock.writes.filter((method) => method.startsWith("eth_send"))).toHaveLength(1);
    await button.click();
    await expect.poll(() => mock.writes.filter((method) => method.startsWith("eth_send")).length).toBe(2);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBe(recovery);
  });
}

test("an unknown approval response is not retried, including after reload", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page, ROOT);
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
  await enableTimelockSolver(page);
  await openTimelock(page, ROOT);
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
          solvers: { enigma: { capabilities: { timelockApproval: true } } },
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
  await enableTimelockSolver(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page, VA);
  await page.locator("#timelock-action-amount").fill("1");
  const card = page.getByTestId("timelock-account-actions");
  await card.getByRole("button", { name: "Request approval and execute" }).click();
  await expect(card.getByText("Transaction:", { exact: false })).toBeVisible({ timeout: 20_000 });
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.filter((entry) => entry.startsWith("eth_send"))).toHaveLength(1);
});

test("a protected margin action can be retried after the wallet rejects its transaction", async ({ page }) => {
  const mock = await mockDeployment(page, {
    configured: true,
    mockSignature: true,
    mockWriteSuccess: true,
    rejectWrites: true,
  });
  await enableTimelockSolver(page);
  await openTimelock(page, VA);
  const outer = page.getByTestId("timelock-account-actions-card");
  const relay = outer.getByTestId("gasless-toggle-timelockAccount:addMargin");
  if ((await relay.getAttribute("aria-checked")) === "true") await relay.click();
  await page.locator("#timelock-action-amount").fill("1");
  const button = page
    .getByTestId("timelock-account-actions")
    .getByRole("button", { name: "Request approval and execute" });
  await button.click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
});

test("clearing an ambiguous approval in another tab restores the inspector without refreshing", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await enableTimelockSolver(page);
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  const connect = page.getByTestId("connect-wallet");
  if (await connect.isVisible()) {
    await connect.click();
    await page.getByTestId("connect-mock").click();
  }
  const card = page.getByTestId("method-addMargin");
  await card.locator("#add-margin-va-account").fill(VA);
  await card.getByTestId("input-add-margin-amount").fill("1");
  await expect(card.getByTestId("timelock-policy")).toHaveCount(0);
  const button = card.getByTestId("button-send-add-margin");
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  await expect(button).toBeDisabled();

  const second = await page.context().newPage();
  await mockDeployment(second, { configured: true });
  await openTimelock(second, ROOT);
  await expect(second.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  second.on("dialog", (dialog) => void dialog.accept());
  await second.getByRole("button", { name: "Clear after external reconciliation" }).click();
  await expect(button).toBeEnabled();
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(1);
  expect(mock.writes.some((item) => item.startsWith("eth_send"))).toBe(false);
  await second.close();
});

test("margin simulation timelock error links to settings for the selected account", async ({ page }) => {
  await mockDeployment(page, { configured: true, simulateMarginTimelock: true });
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  const card = page.getByTestId("method-addMargin");
  await card.locator("#add-margin-va-account").fill(VA);
  await card.getByTestId("input-add-margin-amount").fill("1");
  await card.getByTestId("button-simulate-add-margin").click();
  await expect(
    card.getByTestId("result-simulate-addMargin-error").getByRole("link", { name: "Open timelock settings" }),
  ).toHaveAttribute("href", `/contracts/timelock?account=${VA}`);
  await card.locator("#add-margin-va-account").fill(ROOT);
  await expect(
    card.getByTestId("result-simulate-addMargin-error").getByRole("link", { name: "Open timelock settings" }),
  ).toHaveAttribute("href", `/contracts/timelock?account=${VA}`);
});

test("rejecting the wallet transaction after approval permits a new manual attempt", async ({ page }) => {
  const mock = await mockDeployment(page, {
    configured: true,
    mockSignature: true,
    mockWriteSuccess: true,
    rejectWrites: true,
  });
  await enableTimelockSolver(page);
  await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
  await connectMockWallet(page);
  const card = page.getByTestId("method-addMargin");
  const relay = card.getByTestId("gasless-toggle-addMargin");
  if ((await relay.getAttribute("aria-checked")) === "true") await relay.click();
  await card.locator("#add-margin-va-account").fill(VA);
  await card.getByTestId("input-add-margin-amount").fill("1");
  const button = card.getByTestId("button-send-add-margin");
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  await expect(card.getByTestId("result-addMargin-error")).toBeVisible();
  await expect(card.getByRole("alert")).toHaveCount(1);
  await card.getByTestId("input-add-margin-amount").fill("2");
  await expect(card.getByRole("alert")).toHaveCount(0);
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("timelock-recovery-notices")).toHaveCount(0);
  await button.click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(2);
});

test("a rejected normal withdrawal shows one error and clears it when edited", async ({ page }) => {
  await mockDeployment(page, { unsupported: true, mockSignature: true, mockWriteSuccess: true, rejectWrites: true });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  const amount = page.getByTestId("integration-withdraw-amount");
  await amount.fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await page.getByTestId("button-initiate-withdraw").click();
  const status = page.getByTestId("integration-withdraw-status");
  await expect(status).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(1);
  await amount.fill("2");
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("inspector shows one account recovery notice only after an in-flight request becomes unknown", async ({
  page,
}) => {
  await mockDeployment(page, { configured: true, mockSignature: true });
  await enableTimelockSolver(page);
  let received = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/timelock-approval", async (route) => {
    received = true;
    await gate;
    await route.abort();
  });
  try {
    await page.goto("/contracts/account-layer", { waitUntil: "domcontentloaded" });
    await connectMockWallet(page);
    const add = page.getByTestId("method-addMargin");
    const remove = page.getByTestId("method-removeMargin");
    await add.locator("#add-margin-va-account").fill(VA);
    await add.getByTestId("input-add-margin-amount").fill("1");
    await remove.locator("#remove-margin-va-account").fill(VA);
    await remove.getByTestId("input-remove-margin-amount").fill("1");
    const send = add.getByTestId("button-send-add-margin");
    await expect(send).toBeEnabled();
    await send.click();
    await expect.poll(() => received).toBe(true);
    await expect(page.getByTestId("timelock-recovery-notices")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear after reconciliation" })).toHaveCount(0);
    release();
    const banner = page.getByTestId("timelock-recovery-notices");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Clear after reconciliation" })).toHaveCount(1);
    await expect(add.getByText("Review the earlier operation for this account in the notice above.")).toBeVisible();
    await expect(remove.getByText("Review the earlier operation for this account in the notice above.")).toBeVisible();
    await expect(send).toBeDisabled();
    page.once("dialog", (dialog) => void dialog.accept());
    await banner.getByRole("button", { name: "Clear after reconciliation" }).click();
    await expect(banner).toHaveCount(0);
    await expect(send).toBeEnabled();
  } finally {
    release();
  }
});

test("an approval can be requested without sending a transaction", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-request-data").fill("0x12345678");
  const card = page.getByTestId("timelock-request-approval");
  await card.getByRole("button", { name: "Request approval", exact: true }).click();
  await expect(card.getByText("Approval issued and saved for reconciliation.")).toBeVisible();
  expect(mock.writes.filter((entry) => entry === "approval")).toHaveLength(1);
  expect(mock.writes.some((entry) => entry.startsWith("eth_send"))).toBe(false);
});

test("the timelock page does not show reconciliation while its approval is in flight", async ({ page }) => {
  await mockDeployment(page, { configured: true, mockSignature: true });
  await enableTimelockSolver(page);
  let received = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/timelock-approval", async (route) => {
    received = true;
    await gate;
    await route.abort();
  });
  try {
    await openTimelock(page);
    await page.locator("#timelock-request-data").fill("0x12345678");
    await page
      .getByTestId("timelock-request-approval")
      .getByRole("button", { name: "Request approval", exact: true })
      .click();
    await expect.poll(() => received).toBe(true);
    await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
    release();
    await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  } finally {
    release();
  }
});

test("a definite approval rejection clears only its pending record", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, rejectApprovalCode: 3700 });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-request-data").fill("0x12345678");
  const card = page.getByTestId("timelock-request-approval");
  const button = card.getByRole("button", { name: "Request approval", exact: true });
  await button.click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
  await expect(button).toBeEnabled();
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(1);
});

test("an unknown standalone approval outcome remains blocked after reload", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-request-data").fill("0x12345678");
  await page
    .getByTestId("timelock-request-approval")
    .getByRole("button", { name: "Request approval", exact: true })
    .click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  await openTimelock(page);
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toBeVisible();
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(1);
});

test("rejecting the approval signature clears the pending request", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, rejectSignature: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await page.locator("#timelock-request-data").fill("0x12345678");
  const card = page.getByTestId("timelock-request-approval");
  const button = card.getByRole("button", { name: "Request approval", exact: true });
  await button.click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(page.getByText("An earlier attempt needs reconciliation.", { exact: false })).toHaveCount(0);
  await expect(button).toBeEnabled();
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(0);
});

test("a protected named batch sends both calls in one transaction", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page);
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
  await enableTimelockSolver(page);
  await openTimelock(page);
  await expect(page.getByText("This solver does not advertise timelock approvals.")).toBeVisible();
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  expect(mock.infoReads).toBeGreaterThan(0);
  expect(mock.writes).toEqual([]);
});

test("an explicitly opted-out deployment keeps the legacy path without solver discovery", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true });
  await page.addInitScript(() =>
    localStorage.setItem(
      "symmio.config.overrides.v4",
      JSON.stringify({
        42161: {
          addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
          solvers: { enigma: { capabilities: { timelockApproval: false } } },
        },
      }),
    ),
  );
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  expect(mock.infoReads).toBe(0);
  expect(mock.writes).toEqual([]);
});

test("disabling timelock does not bypass an unresolved root journal", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const layer = getChainConfig(42161).addresses.accountLayerAddress.toLowerCase();
  const key = `symm:timelock-attempt:v2:42161:${layer}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const mock = await mockDeployment(page, { unsupported: true });
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(key, "An unresolved approval.");
      localStorage.setItem(
        "symmio.config.overrides.v4",
        JSON.stringify({
          42161: {
            addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
            solvers: { enigma: { capabilities: { timelockApproval: false } } },
          },
        }),
      );
    },
    { key },
  );
  await openTimelock(page, VA);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(
    page.getByText("An earlier protected operation needs reconciliation before a new attempt."),
  ).toBeVisible();
  await expect(page.getByTestId("button-initiate-withdraw")).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("the contract inspector also blocks an unresolved journal after timelock is disabled", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const layer = getChainConfig(42161).addresses.accountLayerAddress.toLowerCase();
  const key = `symm:timelock-attempt:v2:42161:${layer}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const mock = await mockDeployment(page, { unsupported: true });
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(key, "An unresolved approval.");
      localStorage.setItem(
        "symmio.config.overrides.v4",
        JSON.stringify({
          42161: {
            addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
            solvers: { enigma: { capabilities: { timelockApproval: false } } },
          },
        }),
      );
    },
    { key },
  );
  await page.goto("/contracts/symmio-core", { waitUntil: "domcontentloaded" });
  const connect = page.getByTestId("connect-wallet");
  if (await connect.isVisible()) {
    await connect.click();
    await page.getByTestId("connect-mock").click();
  }
  const card = page.getByTestId("method-initiateWithdraw");
  await card.locator("#withdraw-account-account").fill(VA);
  await card.getByTestId("input-withdraw-amount").fill("1");
  await card.getByTestId("input-withdraw-receiver").fill(OWNER);
  await expect(card.getByText("Review the earlier operation for this account in the notice above.")).toBeVisible();
  await expect(page.getByTestId("timelock-recovery-notices")).toBeVisible();
  await expect(card.getByTestId("button-send-initiate-withdraw")).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("legacy withdrawal remains available when browser storage is unavailable", async ({ page }) => {
  await mockDeployment(page, { unsupported: true });
  await openTimelock(page);
  await openWithdrawal(page);
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "length", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  await expect(page.getByText(/Browser storage is unavailable/)).toHaveCount(0);
});

test("production opt-out with no history sends a normal withdrawal without requesting a lock", async ({ page }) => {
  const mock = await mockDeployment(page, { unsupported: true, mockSignature: true, mockWriteSuccess: true });
  await page.addInitScript(() =>
    localStorage.setItem(
      "symmio.config.overrides.v4",
      JSON.stringify({
        42161: {
          addresses: { affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D" },
          solvers: { enigma: { capabilities: { timelockApproval: false } } },
        },
      }),
    ),
  );
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const button = page.getByTestId("button-initiate-withdraw");
  await expect(button).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator.locks, "request", {
      configurable: true,
      value: () => {
        throw new Error("unexpected lock request");
      },
    });
  });
  await button.click();
  await expect.poll(() => mock.writes.some((method) => method.startsWith("eth_send"))).toBe(true);
  await expect(page.getByText("unexpected lock request")).toHaveCount(0);
});

test("staging opt-out still takes a shared owner lock for a normal withdrawal", async ({ page }) => {
  const layer = "0x5733107211B2801Acd39933a54d482FE303c4907";
  const mock = await mockDeployment(page, { unsupported: true, mockSignature: true, mockWriteSuccess: true });
  await page.addInitScript(
    ({ layer }) =>
      localStorage.setItem(
        "symmio.config.overrides.v4",
        JSON.stringify({
          42161: {
            addresses: {
              affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
              accountLayerAddress: layer,
              instantLayerAddress: "0x89d1e2a9d2429722f756edffad149d7947b672ff",
            },
            solvers: { enigma: { capabilities: { timelockApproval: false } } },
          },
        }),
      ),
    { layer },
  );
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const button = page.getByTestId("button-initiate-withdraw");
  await expect(button).toBeEnabled();
  await page.evaluate(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    const calls: { name: string; mode?: string }[] = [];
    (window as Window & { observedLocks?: typeof calls }).observedLocks = calls;
    Object.defineProperty(navigator.locks, "request", {
      configurable: true,
      value: (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
        calls.push({ name, mode: options.mode });
        return original(name, options, callback);
      },
    });
  });
  await button.click();
  const expected = `symm:timelock-owner-lock:symm:timelock-history:v1:42161:${layer.toLowerCase()}:${OWNER.toLowerCase()}`;
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { observedLocks?: { name: string; mode?: string }[] }).observedLocks),
    )
    .toContainEqual({ name: expected, mode: "shared" });
  await expect.poll(() => mock.writes.some((method) => method.startsWith("eth_send"))).toBe(true);
});

test("a temporary journal read failure recovers without refreshing", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const layer = getChainConfig(42161).addresses.accountLayerAddress.toLowerCase();
  const key = `symm:timelock-attempt:v2:42161:${layer}:${ROOT.toLowerCase()}:${OWNER.toLowerCase()}`;
  const mock = await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page, ROOT);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const button = page.getByTestId("button-initiate-withdraw");
  await expect(button).toBeEnabled();
  await page.evaluate((key) => {
    const previous = Storage.prototype.getItem;
    (window as Window & { restoreJournalRead?: () => void }).restoreJournalRead = () => {
      Storage.prototype.getItem = previous;
      window.dispatchEvent(new Event("symm:timelock-recovery-changed"));
    };
    Storage.prototype.getItem = function (name: string) {
      if (name === key) throw new Error("temporary read failure");
      return previous.call(this, name);
    };
    window.dispatchEvent(new Event("symm:timelock-recovery-changed"));
  }, key);
  await expect(page.getByText("Browser storage is unavailable; protected actions are disabled.")).toBeVisible();
  await expect(button).toBeDisabled();
  await page.evaluate(() => (window as Window & { restoreJournalRead?: () => void }).restoreJournalRead?.());
  await expect(page.getByText("Browser storage is unavailable; protected actions are disabled.")).toHaveCount(0);
  await expect(button).toBeEnabled();
  expect(mock.writes).toEqual([]);
});

test("a second tab cannot send a normal withdrawal while the owner timelock lock is held", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const layer = getChainConfig(42161).addresses.accountLayerAddress.toLowerCase();
  const historyKey = `symm:timelock-history:v1:42161:${layer}:${OWNER.toLowerCase()}`;
  const mock = await mockDeployment(page, { unsupported: true });
  await page.addInitScript(({ historyKey }) => localStorage.setItem(historyKey, "1"), { historyKey });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  const second = await page.context().newPage();
  await mockDeployment(second, { unsupported: true });
  await second.goto("/contracts/timelock", { waitUntil: "domcontentloaded" });
  await second.evaluate(async (historyKey) => {
    let acquired!: () => void;
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    void navigator.locks.request(`symm:timelock-owner-lock:${historyKey}`, () => {
      acquired();
      return new Promise<void>((resolve) => {
        (window as Window & { releaseTestLock?: () => void }).releaseTestLock = resolve;
      });
    });
    await ready;
  }, historyKey);
  await page.getByTestId("button-initiate-withdraw").click();
  await expect(
    page.getByText("Another tab is already processing an operation for this owner and deployment."),
  ).toBeVisible();
  expect(mock.writes).toEqual([]);
  await second.evaluate(() => (window as Window & { releaseTestLock?: () => void }).releaseTestLock?.());
  await second.close();
});

test("a normal withdrawal is not blocked by another normal shared lock", async ({ page }) => {
  const { getChainConfig } = await import("@symmio/trading-core");
  const layer = getChainConfig(42161).addresses.accountLayerAddress.toLowerCase();
  const historyKey = `symm:timelock-history:v1:42161:${layer}:${OWNER.toLowerCase()}`;
  const mock = await mockDeployment(page, { unsupported: true, mockSignature: true, mockWriteSuccess: true });
  await page.addInitScript(({ historyKey }) => localStorage.setItem(historyKey, "1"), { historyKey });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const second = await page.context().newPage();
  await mockDeployment(second, { unsupported: true });
  await second.goto("/contracts/timelock", { waitUntil: "domcontentloaded" });
  await second.evaluate(async (historyKey) => {
    let acquired!: () => void;
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    void navigator.locks.request(`symm:timelock-owner-lock:${historyKey}`, { mode: "shared" }, () => {
      acquired();
      return new Promise<void>((resolve) => {
        (window as Window & { releaseTestLock?: () => void }).releaseTestLock = resolve;
      });
    });
    await ready;
  }, historyKey);
  await page.getByTestId("button-initiate-withdraw").click();
  await expect.poll(() => mock.writes.some((method) => method.startsWith("eth_send"))).toBe(true);
  await expect(
    page.getByText("Another tab is already processing an operation for this owner and deployment."),
  ).toHaveCount(0);
  await second.evaluate(() => (window as Window & { releaseTestLock?: () => void }).releaseTestLock?.());
  await second.close();
});

for (const configured of [false, true]) {
  test(`withdrawal uses the owner when session authority is missing (timelock=${configured})`, async ({ page }) => {
    await enableTimelockSolver(page);
    await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
    const mock = await mockDeployment(page, { configured, mockSignature: true, mockWriteSuccess: true });
    await openTimelock(page);
    await openWithdrawal(page);
    await continueToWithdrawal(page);
    await page.getByTestId("integration-withdraw-amount").fill("1");
    await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
    await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
    await expect(page.getByTestId("session-key-signer-note")).toHaveCount(0);
    await page.getByTestId("button-initiate-withdraw").click();
    await expect.poll(() => mock.writes.filter((method) => method.startsWith("eth_send")).length).toBe(1);
    expect(mock.writes.filter((method) => method === "approval")).toHaveLength(configured ? 1 : 0);
    await expect(
      page.getByText("An earlier protected operation needs reconciliation before a new attempt."),
    ).toHaveCount(0);
  });

  test(`withdrawal retains a fully delegated session signer (timelock=${configured})`, async ({ page }) => {
    await enableTimelockSolver(page);
    await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
    await mockDeployment(page, { configured, delegatedSelectors: "all" });
    await openTimelock(page);
    await openWithdrawal(page);
    await continueToWithdrawal(page);
    await page.getByTestId("integration-withdraw-amount").fill("1");
    await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
    await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
    await expect(page.getByTestId("withdrawal-owner-signer-note")).toHaveCount(0);
    await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
  });
}

test("withdrawal owner fallback preserves configured gasless dispatch", async ({ page }) => {
  await enableTimelockSolver(page);
  await page.addInitScript(() => {
    localStorage.setItem("symm:gasless:session-key-default", "on");
    const overrides = JSON.parse(localStorage.getItem("symmio.config.overrides.v4")!);
    overrides[42161].gasless = { execution: { mode: "gasless" } };
    localStorage.setItem("symmio.config.overrides.v4", JSON.stringify(overrides));
  });
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, mockWriteSuccess: true });
  const relayPayloads: string[] = [];
  await page.route("**/operations/**", async (route) => {
    relayPayloads.push(route.request().postData() ?? "");
    await route.fulfill({ status: 400, json: { detail: { code: "SIMULATION_REVERTED", message: "Mock rejection" } } });
  });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await page.getByTestId("button-initiate-withdraw").click();
  await expect.poll(() => relayPayloads.length).toBe(1);
  expect(relayPayloads[0]!.toLowerCase()).toContain(OWNER.toLowerCase());
  expect(mock.approvalSigners.map((signer) => signer.toLowerCase())).toEqual([OWNER.toLowerCase()]);
  expect(mock.writes.filter((method) => method.startsWith("eth_send"))).toEqual([]);
});

for (const granted of ["initiateWithdraw", "deallocate", "both"] as const) {
  test(`normal CUSTOM withdrawal requires both session permissions (granted=${granted})`, async ({ page }) => {
    const { symmioAbi } = await import("@symmio/trading-core");
    const selectors = (granted === "both" ? ["initiateWithdraw", "deallocate"] : [granted]).map((name) =>
      toFunctionSelector(getAbiItem({ abi: symmioAbi, name: name as "initiateWithdraw" | "deallocate" })),
    );
    await enableTimelockSolver(page);
    await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
    const mock = await mockDeployment(page, { isolationType: 3, delegatedSelectors: selectors });
    await openTimelock(page);
    await openWithdrawal(page);
    await continueToWithdrawal(page);
    if (granted === "both") {
      await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
      await expect(page.getByTestId("withdrawal-owner-signer-note")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
      await expect(page.getByTestId("session-key-signer-note")).toHaveCount(0);
    }
    expect(mock.writes).toEqual([]);
  });
}

test("withdrawal stops using a locally expired key even while delegation remains active", async ({ page }) => {
  await page.clock.install();
  await enableTimelockSolver(page);
  await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
  await mockDeployment(page, { delegatedSelectors: "all" });
  await openTimelock(page);
  const storageKey = `session-key:${OWNER.toLowerCase()}`;
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).not.toBeNull();
  await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.expiresAt = Date.now() + 90_000;
    localStorage.setItem(key, JSON.stringify(stored));
  }, storageKey);
  // A new document loads the same encrypted key with its shorter local lifetime.
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
  await page.clock.fastForward(91_000);
  await expect(page.getByTestId("session-key-signer-note")).toHaveCount(0);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
});

for (const configured of [false, true]) {
  test(`withdrawal does not retain a recovery record when delegation is revoked before submission (timelock=${configured})`, async ({
    page,
  }) => {
    await enableTimelockSolver(page);
    await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
    const mock = await mockDeployment(page, { configured, delegatedSelectors: "all", rejectDelegation: true });
    await openTimelock(page);
    await openWithdrawal(page);
    await continueToWithdrawal(page);
    await page.getByTestId("integration-withdraw-amount").fill("1");
    await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
    await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
    await page.getByTestId("button-initiate-withdraw").click();
    await expect(page.getByTestId("integration-withdraw-status")).toContainText(
      configured ? "lacks delegation" : "holds no active InstantLayer delegation",
    );
    await expect(
      page.getByText("An earlier protected operation needs reconciliation before a new attempt."),
    ).toHaveCount(0);
    await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
    expect(mock.writes).toEqual([]);
    const records = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("symm:timelock-attempt:")),
    );
    expect(records).toEqual([]);
    await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
  });
}

test("an issued approval remains recoverable when delegation fails later", async ({ page }) => {
  await enableTimelockSolver(page);
  await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
  const mock = await mockDeployment(page, {
    configured: true,
    delegatedSelectors: "all",
    rejectDelegation: "after-approval",
    mockWriteSuccess: true,
  });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
  await page.getByTestId("button-initiate-withdraw").click();
  await expect(
    page.getByText("An earlier protected operation needs reconciliation before a new attempt."),
  ).toBeVisible();
  await expect(page.getByTestId("button-initiate-withdraw")).toBeDisabled();
  await expect.poll(() => mock.writes, { timeout: 15_000 }).toEqual(["approval"]);
  await expect(page.getByTestId("integration-withdraw-status")).toContainText(
    "holds no active InstantLayer delegation",
  );
  const sessionSigner = await page.evaluate((owner) => {
    const stored = localStorage.getItem(`session-key:${owner.toLowerCase()}`);
    if (!stored) throw new Error("Session key was not persisted");
    return JSON.parse(stored).publicAddress as string;
  }, OWNER);
  expect(mock.approvalSigners.map((signer) => signer.toLowerCase())).toEqual([sessionSigner.toLowerCase()]);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeDisabled();
});

test("an idle withdrawal switches to the owner when its delegation expires", async ({ page }) => {
  await page.clock.install();
  await enableTimelockSolver(page);
  await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
  await mockDeployment(page, {
    delegatedSelectors: "all",
    delegationExpiry: BigInt(Math.floor(Date.now() / 1000) + 90),
  });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
  await page.clock.fastForward(91_000);
  await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
  await expect(page.getByTestId("session-key-signer-note")).toHaveCount(0);
});

test("withdrawal does not reuse delegation from another root account", async ({ page }) => {
  await enableTimelockSolver(page);
  await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
  await mockDeployment(page, { delegatedSelectors: "all", independentAccounts: true, delegationAccount: ROOT });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await expect(page.getByTestId("session-key-signer-note")).toBeVisible();
  await page.getByTestId("step-1").click();
  await page.getByTestId(`subaccount-${VA}`).click();
  await continueToWithdrawal(page);
  await expect(page.getByTestId("withdrawal-owner-signer-note")).toBeVisible();
  await expect(page.getByTestId("session-key-signer-note")).toHaveCount(0);
});

test("a withdrawal permission read failure selects the owner before submission", async ({ page }) => {
  await enableTimelockSolver(page);
  await page.addInitScript(() => localStorage.setItem("symm:gasless:session-key-default", "on"));
  const mock = await mockDeployment(page, { failDelegationRead: true });
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await expect(page.getByTestId("withdrawal-owner-signer-note")).toContainText("could not be verified");
  expect(mock.writes).toEqual([]);
});

test("a solver outage prepares the exact delayed withdrawal without sending an approval", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, unavailable: true, isolationType: 1 });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const panel = page.getByTestId("timelock-schedule");
  await expect(panel).toBeVisible();
  const raw = await panel.locator("#timelock-raw").inputValue();
  const inner = await panel.locator("#timelock-inner").inputValue();
  expect(raw).toMatch(/^0x[0-9a-f]+$/i);
  expect(inner).not.toBe(raw);
  await expect(panel.locator("#timelock-raw")).toBeDisabled();
  expect(mock.writes).toEqual([]);
});

test("a solver outage does not offer an expiring signed deallocation as a delayed withdrawal", async ({ page }) => {
  await mockDeployment(page, { configured: true, unavailable: true, isolationType: 3 });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByText(/deallocation signature may expire during the waiting period/)).toBeVisible();
  await expect(page.getByTestId("timelock-schedule")).toHaveCount(0);
});

test("a configured withdrawal skips setup again after reselecting its account", async ({ page }) => {
  await mockDeployment(page, { configured: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await expect(page.getByTestId("integration-withdraw-amount")).toBeVisible();
  await page.getByTestId("step-1").click();
  await page.getByTestId(`subaccount-${ROOT}`).click();
  await expect(page.getByTestId("integration-withdraw-amount")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to withdrawal" })).toHaveCount(0);
});

test("an unconfigured withdrawal keeps the setup step on reselect", async ({ page }) => {
  await mockDeployment(page, { configured: false });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await expect(page.getByTestId("timelock-policy")).toContainText("0 / 22 configured");
  await page.getByTestId("step-1").click();
  await page.getByTestId(`subaccount-${ROOT}`).click();
  await expect(page.getByTestId("timelock-policy")).toContainText("0 / 22 configured");
  await expect(page.getByRole("button", { name: "Continue to withdrawal" })).toBeVisible();
});

test("an unlocked account can withdraw even when the solver advertises timelocks", async ({ page }) => {
  await mockDeployment(page, { configured: false });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
});

test("a partially locked withdrawal is available when its protected leg is configured", async ({ page }) => {
  await mockDeployment(page, { locked: ["initiateWithdraw"] });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await expect(page.getByTestId("button-initiate-withdraw")).toBeEnabled();
});

test("withdrawal policy errors link to timelock settings for the same account", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, rejectApprovalCode: 3702 });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await page.getByTestId("button-initiate-withdraw").click();
  const link = page.getByTestId("integration-withdraw-status").getByRole("link", { name: "Open timelock settings" });
  await expect(link).toHaveAttribute("href", `/contracts/timelock?account=${ROOT}`);
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(1);
  expect(mock.writes.some((item) => item.startsWith("eth_send"))).toBe(false);
});

test("a definite solver rejection permits a later main-path withdrawal without scheduling", async ({ page }) => {
  const mock = await mockDeployment(page, { configured: true, mockSignature: true, rejectApproval: true });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  const button = page.getByTestId("button-initiate-withdraw");
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  await expect(button).toBeEnabled();
  expect(mock.writes.some((item) => item.startsWith("eth_send"))).toBe(false);
});

test("approval outage offers delayed withdrawal only after reconciliation", async ({ page }) => {
  const mock = await mockDeployment(page, {
    configured: true,
    mockSignature: true,
    approvalUnavailable: true,
    isolationType: 1,
  });
  await enableTimelockSolver(page);
  await openTimelock(page);
  await openWithdrawal(page);
  await continueToWithdrawal(page);
  await page.getByTestId("integration-withdraw-amount").fill("1");
  await page.getByTestId("integration-withdraw-receiver").fill(OWNER);
  await page.getByTestId("button-initiate-withdraw").click();
  await expect.poll(() => mock.writes.filter((item) => item === "approval").length).toBe(1);
  const button = page.getByRole("button", { name: "Use delayed recovery" });
  await expect(button).toBeVisible();
  await expect(page.getByTestId("timelock-schedule")).toHaveCount(0);
  page.on("dialog", (dialog) => void dialog.accept());
  await button.click();
  await expect(page.getByTestId("timelock-schedule")).toBeVisible();
  expect(mock.writes.filter((item) => item === "approval")).toHaveLength(1);
  expect(mock.writes.some((item) => item.startsWith("eth_send"))).toBe(false);
});
