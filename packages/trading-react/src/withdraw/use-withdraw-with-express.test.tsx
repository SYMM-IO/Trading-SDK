import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getChainConfig,
  getExpressWithdrawOptionsQueryKey,
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  getWithdrawRequestsQueryKey,
  getWithdrawRouteQueryKey,
  SubAccountIsolationType,
  SymmioSupportedChainId,
  type SubAccountDetail,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Address, type TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA, TEST_TX_HASH } from "../test/test-utils";
import { useWithdrawWithExpress } from "./use-withdraw-with-express";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const AMOUNT = 1_000_000n;
const WITHDRAW_INITIATED = parseAbiItem(
  "event WithdrawInitiated(uint256 indexed requestId, address indexed user, (uint256 id, uint256 amount, int256 chainId, bytes receiver, address virtualProvider, address expressProvider)[] parts, bool speedUp, bytes providerData, uint256 cooldownEndTime)",
);

function receipt(symmioAddress: Address): TransactionReceipt {
  return {
    status: "success",
    blockNumber: 12n,
    logs: [
      {
        address: symmioAddress,
        topics: encodeEventTopics({ abi: [WITHDRAW_INITIATED], args: { requestId: 17n, user: ACCOUNT } }),
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
      },
    ],
  } as unknown as TransactionReceipt;
}

describe("useWithdrawWithExpress", () => {
  it("returns the event request id and refreshes the complete withdrawal cache surface", async () => {
    const { config, readContract, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    const chain = getChainConfig(SymmioSupportedChainId.ARBITRUM);
    const subAccount: SubAccountDetail = {
      owner: TEST_EOA,
      name: "Test",
      metadata: "0x",
      isExists: true,
      singleVAMode: false,
      isolationType: SubAccountIsolationType.MARKET,
      affiliate: chain.addresses.affiliatesAddress,
      symmioCore: chain.addresses.symmioAddress,
      accountAddress: ACCOUNT,
    };
    readContract.mockResolvedValue(subAccount);
    writeContract.mockResolvedValue(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValue(receipt(chain.addresses.symmioAddress));
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
    ];
    for (const key of [...invalidatedKeys, ...removedKeys]) queryClient.setQueryData(key, "cached");

    const { result } = renderHookWithProviders(() => useWithdrawWithExpress({ config, account: ACCOUNT }), {
      queryClient,
    });
    await waitFor(() => expect(readContract).toHaveBeenCalled());

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

    for (const key of invalidatedKeys) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of removedKeys) expect(queryClient.getQueryState(key)).toBeUndefined();
  });
});
