import { encodeFunctionData, type Hash, type PublicClient } from "viem";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Config } from "../core/config";
import { gaslessWriteTestConfig, TEST_GASLESS_SIGNER, TEST_GASLESS_TX_HASH } from "../gasless/test/config";
import { mockConfig } from "../shared/test/mock-config";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { editAccountName } from "../symmio-contracts/account-layer/actions/edit-account-name";
import { executeContractWrite } from "./execute-contract-write";
import { executeWrite } from "./execute-write";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({
  default: { post, get },
  isAxiosError: (error: { isAxiosError?: boolean }) => error?.isAxiosError === true,
}));

const ACCOUNT = "0x2222222222222222222222222222222222222222";
const OTHER_ACCOUNT = "0x3333333333333333333333333333333333333333";
const SIGNER = "0x4444444444444444444444444444444444444444";
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-test" };
const REFUSAL = {
  isAxiosError: true,
  message: "Fee refused",
  response: { status: 409, statusText: "Conflict", data: { detail: { code: "FEE_POLICY_WOULD_REVERT" } } },
  config: { url: "/gateway/relay-instant", method: "post" },
};

function setup() {
  const base = gaslessWriteTestConfig(
    { execution: { mode: "gasless", fallback: "wallet", preflightFee: false, submitTimeoutMs: 0 } },
    { signersByFrom: { [SIGNER]: SIGNER } },
  );
  const simulateContract = vi.fn().mockResolvedValue({ result: undefined });
  const waitForTransactionReceipt = vi.fn();
  const config: Config = {
    ...base.config,
    getClient: () =>
      ({ ...base.config.getClient(), simulateContract, waitForTransactionReceipt }) as unknown as PublicClient,
  };
  base.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === "instantLayer") return config.getChainConfig().addresses.instantLayerAddress;
    if (functionName === "getSubAccount") return { owner: TEST_GASLESS_SIGNER, isExists: true };
    if (functionName === "isDelegationActive") return true;
    if (functionName === "nonces") return 1n;
    throw new Error(`Unexpected read: ${functionName}`);
  });
  post.mockResolvedValue({ headers: HEADERS, data: { request_id: "rename-1", status: "queued" } });
  get.mockResolvedValue({
    headers: HEADERS,
    data: { id: "rename-1", status: "submitted", tx_hash: TEST_GASLESS_TX_HASH, payload: {} },
  });
  return { ...base, config, simulateContract, waitForTransactionReceipt };
}

describe("shared contract write execution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses identical contract arguments for relay, wallet simulation and wallet submission", async () => {
    const state = setup();
    const variables = { account: ACCOUNT, name: "Renamed", from: SIGNER, simulateBeforeWrite: true } as const;
    await expect(editAccountName(state.config, variables)).resolves.toBe(TEST_GASLESS_TX_HASH);
    expect(state.simulateContract).not.toHaveBeenCalled();
    expect(state.writeContract).not.toHaveBeenCalled();
    await editAccountName(state.config, { ...variables, gasless: false });

    const walletRequest = state.writeContract.mock.calls[0]![0];
    const simulation = state.simulateContract.mock.calls[0]![0];
    expect(post.mock.calls[0]![1]).toMatchObject({
      accountId: ACCOUNT,
      signedOps: [{ target: walletRequest.address, callData: encodeFunctionData(walletRequest), signer: SIGNER }],
    });
    expect(simulation).toMatchObject({
      address: walletRequest.address,
      abi: accountLayerAbi,
      functionName: "editAccountName",
      args: [ACCOUNT, "Renamed"],
      account: SIGNER,
    });
    expect(walletRequest.account.address).toBe(SIGNER);
    expect(state.simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(
      state.writeContract.mock.invocationCallOrder[0]!,
    );
    expect(state.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("prefers an explicit billing account without changing the renamed account", async () => {
    const state = setup();
    await editAccountName(state.config, { account: ACCOUNT, name: "New", gasless: { account: OTHER_ACCOUNT } });
    expect(post.mock.calls[0]![1].accountId).toBe(OTHER_ACCOUNT);
    expect(post.mock.calls[0]![1].signedOps[0].callData).toBe(
      encodeFunctionData({
        abi: accountLayerAbi,
        functionName: "editAccountName",
        args: [ACCOUNT, "New"],
      }),
    );
  });

  it.each([false, { enabled: false }] as const)("respects the per-call gasless opt-out %j", async (gasless) => {
    const state = setup();
    await editAccountName(state.config, { account: ACCOUNT, name: "New", gasless });
    expect(state.writeContract).toHaveBeenCalledOnce();
    expect(state.readContract).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("simulates and submits once through the wallet after a definitive initial refusal", async () => {
    const state = setup();
    post.mockRejectedValue(REFUSAL);
    await editAccountName(state.config, { account: ACCOUNT, name: "New", from: SIGNER, simulateBeforeWrite: true });
    expect(state.signTypedData).toHaveBeenCalledOnce();
    expect(state.simulateContract).toHaveBeenCalledOnce();
    expect(state.simulateContract.mock.calls[0]![0].account).toBe(SIGNER);
    expect(state.writeContract).toHaveBeenCalledOnce();
    expect(state.writeContract.mock.calls[0]![0].account.address).toBe(SIGNER);
  });

  it("lets a per-call error policy veto the configured wallet fallback", async () => {
    const state = setup();
    post.mockRejectedValue(REFUSAL);
    await expect(
      editAccountName(state.config, {
        account: ACCOUNT,
        name: "New",
        gasless: { fallback: "error" },
      }),
    ).rejects.toThrow();
    expect(state.writeContract).not.toHaveBeenCalled();
  });

  it("never takes the configured wallet fallback for a write keyed with a caller-owned idempotency key", async () => {
    const state = setup();
    post.mockRejectedValue(REFUSAL);
    await expect(
      editAccountName(state.config, {
        account: ACCOUNT,
        name: "New",
        gasless: { idempotencyKey: "rename-action-1" },
      }),
    ).rejects.toMatchObject({ code: "GASLESS_RELAY_SUBMIT_FAILED" });
    expect(post.mock.calls[0]![1].idempotencyKey).toBe("rename-action-1");
    expect(state.simulateContract).not.toHaveBeenCalled();
    expect(state.writeContract).not.toHaveBeenCalled();
  });

  it("propagates a failed fallback simulation without another submission", async () => {
    const state = setup();
    post.mockRejectedValue(REFUSAL);
    state.simulateContract.mockRejectedValueOnce(new Error("would revert"));
    await expect(
      editAccountName(state.config, {
        account: ACCOUNT,
        name: "New",
        simulateBeforeWrite: true,
      }),
    ).rejects.toThrow("would revert");
    expect(state.signTypedData).toHaveBeenCalledOnce();
    expect(state.writeContract).not.toHaveBeenCalled();
  });

  it("preserves an ambiguous submission instead of executing its wallet fallback", async () => {
    const state = setup();
    post.mockResolvedValue({ headers: HEADERS, data: {} });
    await expect(editAccountName(state.config, { account: ACCOUNT, name: "New" })).rejects.toMatchObject({
      code: "GASLESS_SUBMIT_UNCONFIRMED",
    });
    expect(state.writeContract).not.toHaveBeenCalled();
  });

  it("supports a different wallet implementation without rebuilding the relay calls", async () => {
    const state = setup();
    const submitWallet = vi.fn().mockResolvedValue(TEST_GASLESS_TX_HASH);
    const calls = [
      {
        target: state.config.getChainConfig().addresses.accountLayerAddress,
        callData: encodeFunctionData({
          abi: accountLayerAbi,
          functionName: "editAccountName",
          args: [ACCOUNT, "Custom"],
        }),
      },
    ];
    post.mockRejectedValue(REFUSAL);
    await executeWrite(
      state.config,
      { from: SIGNER },
      {
        calls,
        relay: { billingAccount: { kind: "subaccount", account: ACCOUNT } },
        submitWallet,
      },
    );
    expect(submitWallet).toHaveBeenCalledExactlyOnceWith(SIGNER);
    expect(state.writeContract).not.toHaveBeenCalled();
    expect(post.mock.calls[0]![1].signedOps[0]).toMatchObject(calls[0]!);
  });

  it("checks function names and argument tuples against the literal ABI", () => {
    const { config } = mockConfig();
    const contract = { address: ACCOUNT, abi: accountLayerAbi } as const;
    expectTypeOf(() =>
      executeContractWrite(
        config,
        {},
        {
          contract: { ...contract, functionName: "editAccountName", args: [ACCOUNT, "New"] },
        },
      ),
    ).returns.toEqualTypeOf<Promise<Hash>>();
    expectTypeOf(() =>
      executeContractWrite(
        config,
        {},
        {
          contract: {
            ...contract,
            // @ts-expect-error A read function cannot be submitted as a contract write.
            functionName: "getSubAccount",
            args: [ACCOUNT],
          },
        },
      ),
    );
    expectTypeOf(() =>
      executeContractWrite(
        config,
        {},
        {
          contract: {
            ...contract,
            functionName: "editAccountName",
            // @ts-expect-error The second argument is a string, not a bigint.
            args: [ACCOUNT, 1n],
          },
        },
      ),
    );
    expectTypeOf(() =>
      executeContractWrite(
        config,
        {},
        {
          // @ts-expect-error Required contract arguments remain required through the helper.
          contract: { ...contract, functionName: "editAccountName" },
        },
      ),
    );
  });
});
