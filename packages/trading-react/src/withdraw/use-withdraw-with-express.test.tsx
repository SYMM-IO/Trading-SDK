import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getExpressWithdrawOptionsQueryKey,
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  getWithdrawRequestsQueryKey,
  getWithdrawRouteChoicesQueryKey,
  getWithdrawRouteQueryKey,
  SubAccountIsolationType,
  symmioAbi,
  SymmioSupportedChainId,
  type SubAccountDetail,
  type WithdrawRoute,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type EncodeEventTopicsReturnType,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA, TEST_TX_HASH } from "../test/test-utils";
import { useWithdrawWithExpress } from "./use-withdraw-with-express";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const AMOUNT = 1_000_000n;
/** Latest block timestamp the immediate route judges the cooldown against (chain time). */
const BLOCK_TIMESTAMP = 1_767_225_600n;
const IMMEDIATE_ROUTE: WithdrawRoute = { kind: "classic", finalize: "immediate", reason: "cooldown-ready" };

interface ReceiptLog {
  address: Address;
  topics: EncodeEventTopicsReturnType;
  data: Hex;
}

function initiatedLog(symmioAddress: Address, requestId: bigint): ReceiptLog {
  return {
    address: symmioAddress,
    topics: encodeEventTopics({ abi: symmioAbi, eventName: "WithdrawInitiated", args: { requestId, user: ACCOUNT } }),
    data: encodeAbiParameters(
      [
        {
          type: "tuple[]",
          components: [
            { name: "id", type: "uint256" },
            { name: "amount", type: "uint256" },
            { name: "chainId", type: "int256" },
            { name: "receiver", type: "bytes" },
            { name: "virtualProvider", type: "address" },
            { name: "expressProvider", type: "address" },
          ],
        },
        { type: "bool" },
        { type: "bytes" },
        { type: "uint256" },
      ],
      [[], false, "0x", 99n],
    ),
  };
}

function finalizedLog(symmioAddress: Address, requestId: bigint): ReceiptLog {
  return {
    address: symmioAddress,
    topics: encodeEventTopics({ abi: symmioAbi, eventName: "WithdrawFinalized", args: { requestId, user: ACCOUNT } }),
    data: "0x",
  };
}

function receipt(logs: ReceiptLog[]): TransactionReceipt {
  return { status: "success", blockNumber: 12n, logs } as unknown as TransactionReceipt;
}

/**
 * A MARKET subaccount whose available balance covers {@link AMOUNT} and whose
 * cooldown is over at the latest block, with every withdrawal cache seeded so a
 * test can assert which of them the hook refreshed.
 *
 * @param lastWithdrawRequestId - Last id the immediate route reads; it guesses the next one.
 */
function setup(lastWithdrawRequestId = 16n) {
  const { config, readContract, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
  const { addresses } = config.getChainConfig(SymmioSupportedChainId.ARBITRUM);
  const subAccount: SubAccountDetail = {
    owner: TEST_EOA,
    name: "Test",
    metadata: "0x",
    isExists: true,
    singleVAMode: false,
    isolationType: SubAccountIsolationType.MARKET,
    affiliate: addresses.affiliatesAddress,
    symmioCore: addresses.symmioAddress,
    accountAddress: ACCOUNT,
  };
  /** `balanceOf` reports SYMMIO's 18-decimal internal balance, not collateral units. */
  const balance = AMOUNT * 10n ** BigInt(18 - addresses.collateralDecimals);
  readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    switch (functionName) {
      case "getSubAccount":
        return subAccount;
      case "getWithdrawableTime":
        return BLOCK_TIMESTAMP;
      case "balanceOf":
        return balance;
      case "getLastWithdrawRequestId":
        return lastWithdrawRequestId;
      default:
        throw new Error(`Unexpected contract read: ${functionName}`);
    }
  });
  /** The mock public client has no `getBlock`; the immediate route reads the latest block for chain time. */
  const getBlock = vi.fn().mockResolvedValue({ timestamp: BLOCK_TIMESTAMP });
  Object.assign(config.getClient({ chainId: SymmioSupportedChainId.ARBITRUM }), { getBlock });
  writeContract.mockResolvedValue(TEST_TX_HASH);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const invalidatedKeys = [
    getAccountBalanceInfoQueryKey({ account: ACCOUNT }),
    getAccountBalanceOfQueryKey({ account: ACCOUNT }),
    getPendingWithdrawRequestsQueryKey({ user: ACCOUNT }),
    getWithdrawRequestsQueryKey({ user: ACCOUNT }),
    getLastWithdrawRequestIdQueryKey({ user: ACCOUNT }),
    getWithdrawableTimeQueryKey({ user: ACCOUNT }),
  ];
  const removedKeys = [
    getExpressWithdrawOptionsQueryKey({ user: ACCOUNT, amount: AMOUNT, receiver: RECEIVER }),
    getWithdrawRouteQueryKey({ user: ACCOUNT, amount: AMOUNT, receiver: RECEIVER }),
    getWithdrawRouteChoicesQueryKey({ user: ACCOUNT, amount: AMOUNT, receiver: RECEIVER }),
  ];
  for (const key of [...invalidatedKeys, ...removedKeys]) queryClient.setQueryData(key, "cached");

  return {
    config,
    readContract,
    writeContract,
    waitForTransactionReceipt,
    getBlock,
    symmioAddress: addresses.symmioAddress,
    queryClient,
    invalidatedKeys,
    removedKeys,
  };
}

async function renderReadyHook(context: ReturnType<typeof setup>) {
  const { result } = renderHookWithProviders(
    () => useWithdrawWithExpress({ config: context.config, account: ACCOUNT }),
    {
      queryClient: context.queryClient,
    },
  );
  await waitFor(() => expect(context.readContract).toHaveBeenCalled());
  return result;
}

describe("useWithdrawWithExpress", () => {
  it("returns the event request id and refreshes the complete withdrawal cache surface", async () => {
    const context = setup();
    context.waitForTransactionReceipt.mockResolvedValue(receipt([initiatedLog(context.symmioAddress, 17n)]));
    const result = await renderReadyHook(context);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          amount: AMOUNT,
          receiver: RECEIVER,
          preparedRoute: { kind: "classic", finalize: "after-cooldown", reason: "service-disabled" },
          simulateBeforeWrite: false,
        }),
      ).resolves.toMatchObject({ hash: TEST_TX_HASH, requestId: 17n });
    });

    for (const key of context.invalidatedKeys) expect(context.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of context.removedKeys) expect(context.queryClient.getQueryState(key)).toBeUndefined();
  });

  it("resolves an immediate route whose receipt finalized the request it initiated", async () => {
    const context = setup(16n);
    context.waitForTransactionReceipt.mockResolvedValue(
      receipt([initiatedLog(context.symmioAddress, 17n), finalizedLog(context.symmioAddress, 17n)]),
    );
    const result = await renderReadyHook(context);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          amount: AMOUNT,
          receiver: RECEIVER,
          preparedRoute: IMMEDIATE_ROUTE,
          simulateBeforeWrite: false,
        }),
      ).resolves.toMatchObject({ hash: TEST_TX_HASH, requestId: 17n, route: IMMEDIATE_ROUTE });
    });

    expect(context.getBlock).toHaveBeenCalledWith({ blockTag: "latest" });
  });

  it("rejects an immediate route whose receipt finalized another request, and still refreshes the caches", async () => {
    /** Read id 15 so the batch finalizes #16, while a concurrent request took #16 and this one became #17. */
    const context = setup(15n);
    context.waitForTransactionReceipt.mockResolvedValue(
      receipt([initiatedLog(context.symmioAddress, 17n), finalizedLog(context.symmioAddress, 16n)]),
    );
    const result = await renderReadyHook(context);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          amount: AMOUNT,
          receiver: RECEIVER,
          preparedRoute: IMMEDIATE_ROUTE,
          simulateBeforeWrite: false,
        }),
      ).rejects.toMatchObject({ kind: "sdk", code: "WITHDRAW_REQUEST_NOT_FINALIZED" });
    });

    for (const key of context.invalidatedKeys) expect(context.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of context.removedKeys) expect(context.queryClient.getQueryState(key)).toBeUndefined();
  });

  it("leaves the caches alone when the transaction never mined", async () => {
    const context = setup();
    context.writeContract.mockRejectedValue(new Error("wallet unavailable"));
    const result = await renderReadyHook(context);

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          amount: AMOUNT,
          receiver: RECEIVER,
          preparedRoute: IMMEDIATE_ROUTE,
          simulateBeforeWrite: false,
        }),
      ).rejects.toMatchObject({ kind: "unknown", message: "wallet unavailable" });
    });

    expect(context.waitForTransactionReceipt).not.toHaveBeenCalled();
    for (const key of context.invalidatedKeys)
      expect(context.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    for (const key of context.removedKeys) expect(context.queryClient.getQueryData(key)).toBe("cached");
  });
});
