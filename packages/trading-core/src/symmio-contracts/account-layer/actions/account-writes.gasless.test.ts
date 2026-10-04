import { decodeFunctionData, type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { SubAccountIsolationType } from "../types";

const maybeRelayAsGasless = vi.hoisted(() => vi.fn());

vi.mock("../../../gasless/dispatch/maybe-relay-as-gasless", () => ({ maybeRelayAsGasless }));

import { createSubAccounts } from "./create-sub-accounts";
import { deleteSubAccount } from "./delete-sub-account";
import { depositAndAllocateForAccount } from "./deposit-and-allocate-for-account";
import { depositForAccount } from "./deposit-for-account";
import { editAccountName } from "./edit-account-name";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;

/**
 * Each case is one AccountLayer write that gained the transparent seam: how it
 * is invoked, the function its calldata must encode, and the billing account the
 * dispatcher is asked to relay under. `signerAccount` is `undefined` for
 * `createSubAccounts` alone — it has no account of its own, so the caller must
 * name one via `gasless.account`.
 */
const CASES = [
  {
    name: "deleteSubAccount",
    functionName: "deleteSubAccount",
    signerAccount: SUB_ACCOUNT,
    accountMaybeVirtual: undefined,
    call: (config: ReturnType<typeof mockConfig>["config"], gasless?: true) =>
      deleteSubAccount(config, { chainId: CHAIN, subAccount: SUB_ACCOUNT, gasless, simulateBeforeWrite: false }),
  },
  {
    name: "editAccountName",
    functionName: "editAccountName",
    signerAccount: SUB_ACCOUNT,
    accountMaybeVirtual: undefined,
    call: (config: ReturnType<typeof mockConfig>["config"], gasless?: true) =>
      editAccountName(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        name: "Main",
        gasless,
        simulateBeforeWrite: false,
      }),
  },
  {
    name: "depositForAccount",
    functionName: "depositForAccount",
    signerAccount: undefined,
    accountMaybeVirtual: SUB_ACCOUNT,
    call: (config: ReturnType<typeof mockConfig>["config"], gasless?: true) =>
      depositForAccount(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        amount: 1_000000n,
        gasless,
        simulateBeforeWrite: false,
      }),
  },
  {
    name: "depositAndAllocateForAccount",
    functionName: "depositAndAllocateForAccount",
    signerAccount: undefined,
    accountMaybeVirtual: SUB_ACCOUNT,
    call: (config: ReturnType<typeof mockConfig>["config"], gasless?: true) =>
      depositAndAllocateForAccount(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        amount: 1_000000n,
        gasless,
        simulateBeforeWrite: false,
      }),
  },
  {
    name: "createSubAccounts",
    functionName: "createSubAccounts",
    signerAccount: undefined,
    accountMaybeVirtual: undefined,
    call: (config: ReturnType<typeof mockConfig>["config"], gasless?: true) =>
      createSubAccounts(config, {
        chainId: CHAIN,
        affiliate: AFFILIATE,
        accountsData: [
          {
            name: "Main",
            metadata: "0x",
            symmioCore: CORE,
            isolationType: SubAccountIsolationType.MARKET,
            singleVAMode: true,
          },
        ],
        gasless,
        simulateBeforeWrite: false,
      }),
  },
] as const;

describe.each(CASES)("$name — gasless seam", (testCase) => {
  beforeEach(() => {
    maybeRelayAsGasless.mockReset();
  });

  it("returns the relayer's broadcast hash, indistinguishable from a wallet submit", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, writeContract } = mockConfig();

    await expect(testCase.call(config, true)).resolves.toBe(RELAYED_HASH);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("relays the same AccountLayer calldata the wallet path would send", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config } = mockConfig();

    await testCase.call(config, true);

    const parameters = maybeRelayAsGasless.mock.calls[0]?.[1];
    expect(parameters.calls).toHaveLength(1);
    expect(parameters.calls[0].target).toBe(ARBITRUM.addresses.accountLayerAddress);
    expect(parameters.signerAccount).toBe(testCase.signerAccount);
    expect(parameters.accountMaybeVirtual).toBe(testCase.accountMaybeVirtual);

    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: parameters.calls[0].callData });
    expect(decoded.functionName).toBe(testCase.functionName);
  });

  it("falls through to the wallet path when the dispatcher declines", async () => {
    maybeRelayAsGasless.mockResolvedValue(null);
    const { config, writeContract } = mockConfig();

    await expect(testCase.call(config)).resolves.toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
  });

  it("skips the local dry-run when relayed — the relayer simulates its own bundle", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, simulateContract } = mockConfig();

    await testCase.call(config, true);

    expect(simulateContract).not.toHaveBeenCalled();
  });
});
