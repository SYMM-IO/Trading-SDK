import { decodeFunctionData, encodeFunctionData, type Address, type PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import type { Config } from "../../../core/config";
import { gaslessWriteTestConfig, TEST_GASLESS_SIGNER, TEST_GASLESS_TX_HASH } from "../../../gasless/test/config";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { SubAccountIsolationType } from "../types";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({ default: { post, get }, isAxiosError: () => false }));

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
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-test" };

/**
 * Exercise each public action through its actual dispatcher. Only the external
 * wallet, chain and HTTP boundaries are stubbed, so moving an action between
 * shared executors does not bypass its gasless behavior in these tests.
 */
const CASES = [
  {
    name: "deleteSubAccount",
    functionName: "deleteSubAccount",
    call: (config: Config, gasless?: true) =>
      deleteSubAccount(config, { chainId: CHAIN, subAccount: SUB_ACCOUNT, gasless, simulateBeforeWrite: true }),
  },
  {
    name: "editAccountName",
    functionName: "editAccountName",
    call: (config: Config, gasless?: true) =>
      editAccountName(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        name: "Main",
        gasless,
        simulateBeforeWrite: true,
      }),
  },
  {
    name: "depositForAccount",
    functionName: "depositForAccount",
    call: (config: Config, gasless?: true) =>
      depositForAccount(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        amount: 1_000000n,
        gasless,
        simulateBeforeWrite: true,
      }),
  },
  {
    name: "depositAndAllocateForAccount",
    functionName: "depositAndAllocateForAccount",
    call: (config: Config, gasless?: true) =>
      depositAndAllocateForAccount(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        amount: 1_000000n,
        gasless,
        simulateBeforeWrite: true,
      }),
  },
  {
    name: "createSubAccounts",
    functionName: "createSubAccounts",
    call: (config: Config, gasless?: true) =>
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
        gasless: gasless ? { enabled: true, account: SUB_ACCOUNT } : undefined,
        simulateBeforeWrite: true,
      }),
  },
] as const;

function setup() {
  const base = gaslessWriteTestConfig({ execution: { preflightFee: false } });
  const simulateContract = vi.fn().mockResolvedValue({ result: undefined });
  const config: Config = {
    ...base.config,
    getClient: () => ({ ...base.config.getClient(), simulateContract }) as unknown as PublicClient,
  };
  base.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === "instantLayer") return ARBITRUM.addresses.instantLayerAddress;
    if (functionName === "getSubAccount") return { owner: TEST_GASLESS_SIGNER, isExists: true };
    if (functionName === "getVirtualAccount") return { isExists: false };
    if (functionName === "nonces") return 1n;
    throw new Error(`Unexpected read: ${functionName}`);
  });
  post.mockResolvedValue({ headers: HEADERS, data: { request_id: "account-write-1", status: "queued" } });
  get.mockResolvedValue({
    headers: HEADERS,
    data: { id: "account-write-1", status: "submitted", tx_hash: RELAYED_HASH, payload: {} },
  });
  return { ...base, config, simulateContract };
}

describe.each(CASES)("$name — gasless seam", (testCase) => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the relayer's broadcast hash, indistinguishable from a wallet submit", async () => {
    const { config, writeContract } = setup();

    await expect(testCase.call(config, true)).resolves.toBe(RELAYED_HASH);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("relays the same AccountLayer calldata the wallet path would send", async () => {
    const { config, writeContract } = setup();

    await testCase.call(config, true);
    await testCase.call(config);

    const parameters = post.mock.calls[0]![1];
    expect(parameters.signedOps).toHaveLength(1);
    expect(parameters.accountId).toBe(SUB_ACCOUNT);
    expect(parameters.signedOps[0]).toMatchObject({
      target: ARBITRUM.addresses.accountLayerAddress,
      callData: encodeFunctionData(writeContract.mock.calls[0]![0]),
    });

    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: parameters.signedOps[0].callData });
    expect(decoded.functionName).toBe(testCase.functionName);
  });

  it("uses the wallet path when gasless is disabled", async () => {
    const { config, writeContract, simulateContract } = setup();

    await expect(testCase.call(config)).resolves.toBe(TEST_GASLESS_TX_HASH);
    expect(simulateContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();
  });

  it("skips the local dry-run when relayed — the relayer simulates its own bundle", async () => {
    const { config, simulateContract } = setup();

    await testCase.call(config, true);

    expect(simulateContract).not.toHaveBeenCalled();
  });
});
