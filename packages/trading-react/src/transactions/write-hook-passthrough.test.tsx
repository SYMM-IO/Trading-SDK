import {
  SubAccountIsolationType,
  type GaslessWriteOptions,
  type SingleUpnlSig,
  type WithdrawReceiverPart,
} from "@symmio/trading-core";
import type { UseMutationResult } from "@tanstack/react-query";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import type { WriteResult } from "./write-types";

/**
 * Every core mutation-options factory a write hook consumes, replaced by one
 * shared spy. The factory is the seam: the hook builds the core action's
 * parameters and hands them here, so the spy sees exactly what the hook chose
 * to forward — which is the whole subject of this suite.
 */
const { relayed, FACTORY_NAMES } = vi.hoisted(() => ({
  relayed: vi.fn(),
  FACTORY_NAMES: [
    "addMarginMutationOptions",
    "allocateMutationOptions",
    "approveCollateralMutationOptions",
    "approveOperationalFeeMutationOptions",
    "cancelRegistrationMutationOptions",
    "createSubAccountsMutationOptions",
    "deallocateAndInitiateWithdrawMutationOptions",
    "deallocateMutationOptions",
    "deleteSubAccountMutationOptions",
    "depositAndAllocateForAccountMutationOptions",
    "depositForAccountMutationOptions",
    "editAccountNameMutationOptions",
    "finalizeWithdrawRequestMutationOptions",
    "forceCancelCloseRequestMutationOptions",
    "forceCancelQuoteMutationOptions",
    "forceCloseAutoMutationOptions",
    "grantDelegationMutationOptions",
    "initiateWithdrawMutationOptions",
    "removeMarginMutationOptions",
    "requestCancelWithdrawMutationOptions",
    "requestToCancelCloseRequestMutationOptions",
    "requestToCancelQuoteMutationOptions",
    "requestToRegisterAffiliateMutationOptions",
    "withdrawAutoMutationOptions",
  ],
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  const stubs = Object.fromEntries(
    FACTORY_NAMES.map((name) => [name, () => ({ mutationKey: [name] as const, mutationFn: relayed })]),
  );
  return { ...actual, ...stubs };
});

import { useAddMargin } from "../account-layer/use-add-margin";
import { useAllocate } from "../account-layer/use-allocate";
import { useCancelRegistration } from "../account-layer/use-cancel-registration";
import { useCreateSubAccounts } from "../account-layer/use-create-sub-accounts";
import { useDeallocate } from "../account-layer/use-deallocate";
import { useDeallocateAndInitiateWithdraw } from "../account-layer/use-deallocate-and-initiate-withdraw";
import { useDeleteSubAccount } from "../account-layer/use-delete-sub-account";
import { useDeposit } from "../account-layer/use-deposit";
import { useDepositAndAllocate } from "../account-layer/use-deposit-and-allocate";
import { useEditAccountName } from "../account-layer/use-edit-account-name";
import { useRemoveMargin } from "../account-layer/use-remove-margin";
import { useRequestToRegisterAffiliate } from "../account-layer/use-request-to-register-affiliate";
import { useApproveCollateral } from "../collateral/use-approve-collateral";
import { useApproveOperationalFee } from "../gasless/use-approve-operational-fee";
import { useGrantDelegation } from "../instant-layer/use-grant-delegation";
import { useForceCancelCloseRequest } from "../quotes/use-force-cancel-close-request";
import { useForceCancelQuote } from "../quotes/use-force-cancel-quote";
import { useForceClose } from "../quotes/use-force-close";
import { useRequestToCancelCloseRequest } from "../quotes/use-request-to-cancel-close-request";
import { useRequestToCancelQuote } from "../quotes/use-request-to-cancel-quote";
import { useFinalizeWithdrawRequest } from "../withdraw/use-finalize-withdraw-request";
import { useInitiateWithdraw } from "../withdraw/use-initiate-withdraw";
import { useRequestCancelWithdraw } from "../withdraw/use-request-cancel-withdraw";
import { useWithdraw } from "../withdraw/use-withdraw";

const ACCOUNT: Address = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const VIRTUAL_ACCOUNT: Address = "0xdbe2Cd3ED29bb7bd26F25044C08E9F3Ad0a94B5B";
const AFFILIATE: Address = "0x000000000000000000000000000000000000aFF1";

/**
 * The sentinels. `from` is an address no other fixture uses, so it can only
 * arrive by being forwarded. `gasless` is a full {@link GaslessWriteOptions}
 * bag rather than `true`: a hook that forwarded only a boolean would still drop
 * `fallback` / `account` / `idempotencyKey`, and the per-call bag is the half
 * consumers actually reach for.
 */
const SENTINEL_FROM: Address = "0x000000000000000000000000000000000000F00D";
const SENTINEL_GASLESS: GaslessWriteOptions = {
  enabled: true,
  fallback: "wallet",
  idempotencyKey: "passthrough-probe",
  account: ACCOUNT,
  broadcastTimeoutMs: 5_000,
};

const UPNL_SIG: SingleUpnlSig = {
  reqId: "0x01",
  timestamp: 1n,
  upnl: 0n,
  gatewaySignature: "0x02",
  sigs: { signature: 1n, owner: ACCOUNT, nonce: ACCOUNT },
};

const WITHDRAW_PART: WithdrawReceiverPart = {
  id: 1n,
  amount: 1n,
  chainId: 999n,
  receiver: ACCOUNT,
  virtualProvider: "0x0000000000000000000000000000000000000000",
  expressProvider: "0x0000000000000000000000000000000000000000",
};

/**
 * One row per write hook. `useWrite` returns the mutation so the row owns its
 * hook-level parameters (only `useWithdraw` needs any), and `variables` is
 * typed against that mutation — so a row cannot drift from the hook's real
 * variables type without failing `check-types`.
 */
interface Probe<TVariables> {
  /** Path relative to `src/`, cross-checked against the discovery scan below. */
  file: string;
  name: string;
  /** Whether the core action behind this hook accepts the `gasless` parameter. */
  acceptsGasless: boolean;
  useWrite: (
    config: ReturnType<typeof createMockSymmioConfig>["config"],
  ) => UseMutationResult<WriteResult, SymmioRequestError, TVariables>;
  variables: TVariables;
}

function probe<TVariables>(row: Probe<TVariables>): Probe<never> {
  return row as unknown as Probe<never>;
}

const PROBES: Probe<never>[] = [
  probe({
    file: "account-layer/use-add-margin.ts",
    name: "useAddMargin",
    acceptsGasless: true,
    useWrite: (config) => useAddMargin({ config, waitForReceipt: false }),
    variables: { virtualAccount: VIRTUAL_ACCOUNT, amount: 1n },
  }),
  probe({
    file: "account-layer/use-allocate.ts",
    name: "useAllocate",
    acceptsGasless: true,
    useWrite: (config) => useAllocate({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amount: 1n },
  }),
  probe({
    file: "account-layer/use-cancel-registration.ts",
    name: "useCancelRegistration",
    acceptsGasless: false,
    useWrite: (config) => useCancelRegistration({ config, waitForReceipt: false }),
    variables: { affiliate: AFFILIATE },
  }),
  probe({
    file: "account-layer/use-create-sub-accounts.ts",
    name: "useCreateSubAccounts",
    acceptsGasless: true,
    useWrite: (config) => useCreateSubAccounts({ config, waitForReceipt: false }),
    variables: {
      affiliate: AFFILIATE,
      accountsData: [
        {
          name: "probe",
          metadata: "0x" as Hex,
          symmioCore: ACCOUNT,
          isolationType: SubAccountIsolationType.CUSTOM,
          singleVAMode: false,
        },
      ],
    },
  }),
  probe({
    file: "account-layer/use-deallocate.ts",
    name: "useDeallocate",
    acceptsGasless: true,
    useWrite: (config) => useDeallocate({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amount: 1n, upnlSig: UPNL_SIG },
  }),
  probe({
    file: "account-layer/use-deallocate-and-initiate-withdraw.ts",
    name: "useDeallocateAndInitiateWithdraw",
    acceptsGasless: true,
    useWrite: (config) => useDeallocateAndInitiateWithdraw({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amount: 1n, parts: [WITHDRAW_PART], upnlSig: UPNL_SIG },
  }),
  probe({
    file: "account-layer/use-delete-sub-account.ts",
    name: "useDeleteSubAccount",
    acceptsGasless: true,
    useWrite: (config) => useDeleteSubAccount({ config, waitForReceipt: false }),
    variables: { subAccount: ACCOUNT },
  }),
  probe({
    file: "account-layer/use-deposit.ts",
    name: "useDeposit",
    acceptsGasless: true,
    useWrite: (config) => useDeposit({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amount: 1n },
  }),
  probe({
    file: "account-layer/use-deposit-and-allocate.ts",
    name: "useDepositAndAllocate",
    acceptsGasless: true,
    useWrite: (config) => useDepositAndAllocate({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amount: 1n },
  }),
  probe({
    file: "account-layer/use-edit-account-name.ts",
    name: "useEditAccountName",
    acceptsGasless: true,
    useWrite: (config) => useEditAccountName({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, name: "probe" },
  }),
  probe({
    file: "account-layer/use-remove-margin.ts",
    name: "useRemoveMargin",
    acceptsGasless: true,
    useWrite: (config) => useRemoveMargin({ config, waitForReceipt: false }),
    variables: { virtualAccount: VIRTUAL_ACCOUNT, amount: 1n, upnlSig: UPNL_SIG },
  }),
  probe({
    file: "account-layer/use-request-to-register-affiliate.ts",
    name: "useRequestToRegisterAffiliate",
    acceptsGasless: false,
    useWrite: (config) => useRequestToRegisterAffiliate({ config, waitForReceipt: false }),
    variables: {
      registration: {
        name: "probe",
        brandColor: "#000000",
        admin: ACCOUNT,
        stakeholders: [],
        symmioShare: 0n,
        metadata: "0x" as Hex,
        legacyMultiAccounts: [],
        symmioCores: [],
      },
    },
  }),
  probe({
    file: "collateral/use-approve-collateral.ts",
    name: "useApproveCollateral",
    acceptsGasless: false,
    useWrite: (config) => useApproveCollateral({ config, waitForReceipt: false }),
    variables: { amount: 1n },
  }),
  probe({
    file: "gasless/use-approve-operational-fee.ts",
    name: "useApproveOperationalFee",
    acceptsGasless: true,
    useWrite: (config) => useApproveOperationalFee({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, amounts: [1n] },
  }),
  probe({
    file: "instant-layer/use-grant-delegation.ts",
    name: "useGrantDelegation",
    acceptsGasless: true,
    useWrite: (config) => useGrantDelegation({ config, waitForReceipt: false }),
    variables: {
      account: { addr: ACCOUNT, isPartyB: false },
      delegatedSigner: VIRTUAL_ACCOUNT,
      selectors: ["0xa6d66852" as Hex],
      expiryTimestamp: 1n,
    },
  }),
  probe({
    file: "quotes/use-force-cancel-close-request.ts",
    name: "useForceCancelCloseRequest",
    acceptsGasless: true,
    useWrite: (config) => useForceCancelCloseRequest({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, quoteId: 1n },
  }),
  probe({
    file: "quotes/use-force-cancel-quote.ts",
    name: "useForceCancelQuote",
    acceptsGasless: true,
    useWrite: (config) => useForceCancelQuote({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, quoteId: 1n },
  }),
  probe({
    file: "quotes/use-force-close.ts",
    name: "useForceClose",
    acceptsGasless: true,
    useWrite: (config) => useForceClose({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, quoteId: 1n },
  }),
  probe({
    file: "quotes/use-request-to-cancel-close-request.ts",
    name: "useRequestToCancelCloseRequest",
    acceptsGasless: true,
    useWrite: (config) => useRequestToCancelCloseRequest({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, quoteId: 1n },
  }),
  probe({
    file: "quotes/use-request-to-cancel-quote.ts",
    name: "useRequestToCancelQuote",
    acceptsGasless: true,
    useWrite: (config) => useRequestToCancelQuote({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, quoteId: 1n },
  }),
  probe({
    file: "withdraw/use-finalize-withdraw-request.ts",
    name: "useFinalizeWithdrawRequest",
    acceptsGasless: true,
    useWrite: (config) => useFinalizeWithdrawRequest({ config, waitForReceipt: false }),
    variables: { user: ACCOUNT, requestId: 1n },
  }),
  probe({
    file: "withdraw/use-initiate-withdraw.ts",
    name: "useInitiateWithdraw",
    acceptsGasless: true,
    useWrite: (config) => useInitiateWithdraw({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, parts: [WITHDRAW_PART] },
  }),
  probe({
    file: "withdraw/use-request-cancel-withdraw.ts",
    name: "useRequestCancelWithdraw",
    acceptsGasless: true,
    useWrite: (config) => useRequestCancelWithdraw({ config, waitForReceipt: false }),
    variables: { account: ACCOUNT, requestId: 1n },
  }),
  probe({
    file: "withdraw/use-withdraw.ts",
    name: "useWithdraw",
    acceptsGasless: true,
    useWrite: (config) => useWithdraw({ config, account: ACCOUNT, waitForReceipt: false }),
    variables: { amount: 1n, receiver: ACCOUNT, upnlSig: UPNL_SIG },
  }),
];

describe("write hooks forward their mutation variables to the core action", () => {
  beforeEach(() => {
    relayed.mockReset();
    relayed.mockResolvedValue(TEST_TX_HASH);
  });

  for (const row of PROBES) {
    it(`${row.name} forwards \`from\`${row.acceptsGasless ? " and `gasless`" : ""} untouched`, async () => {
      const { config } = createMockSymmioConfig();
      const { result } = renderHookWithProviders(() => row.useWrite(config));

      await result.current.mutateAsync({
        ...(row.variables as object),
        from: SENTINEL_FROM,
        ...(row.acceptsGasless ? { gasless: SENTINEL_GASLESS } : {}),
      } as never);

      const expected: Record<string, unknown> = { from: SENTINEL_FROM };
      if (row.acceptsGasless) expected.gasless = SENTINEL_GASLESS;

      expect(relayed).toHaveBeenCalledWith(expect.objectContaining(expected));
    });
  }
});

/**
 * `resolveWriteResult(` is an exact marker for a write hook: every one calls it
 * and nothing else in `src/` does (the orchestrators that compose several
 * writes go through the hooks, not the helper). So the scan needs no allowlist,
 * and a hook added without a probe row turns this red.
 */
const SOURCE_ROOT = join(import.meta.dirname, "..");

function discoverWriteHooks(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .filter((entry) => !entry.includes(".test.") && !entry.startsWith("transactions/resolve-write-result"))
    .filter((entry) => readFileSync(join(SOURCE_ROOT, entry), "utf8").includes("resolveWriteResult("))
    .map((entry) => entry.split("\\").join("/"))
    .sort();
}

describe("the probe table covers every write hook", () => {
  it("has a row for each hook that resolves a write result", () => {
    expect(discoverWriteHooks()).toEqual(PROBES.map((row) => row.file).sort());
  });

  /**
   * The spread has to come first. `{ chainId: resolvedChainId, ...variables }`
   * type-checks identically but lets an undefined `variables.chainId` clobber
   * the resolved default — a bug no type can catch, so it is asserted here.
   */
  it("builds the core parameters by spreading variables first", () => {
    const offenders: string[] = [];

    for (const file of discoverWriteHooks()) {
      const source = readFileSync(join(SOURCE_ROOT, file), "utf8");
      for (const match of source.matchAll(/base\.mutationFn\((.*?)\)[,;]/gs)) {
        const argument = (match[1] ?? "").trim();
        const forwarded = argument === "variables" || /^\{\s*\.\.\.variables\b/.test(argument);
        if (!forwarded) offenders.push(`${file}: base.mutationFn(${argument})`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
