import { getOperationalFeeAllowanceQueryKey, symmioAbi, SymmioSupportedChainId } from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { decodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useApproveOperationalFeeAllowance } from "./use-approve-operational-fee-allowance";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_ACCOUNT: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const CHARGER: Address = "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca";

describe("useApproveOperationalFeeAllowance", () => {
  it("sends the two-argument approveOperationalFee and refreshes only this payer's allowance", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = config.getChainConfigKey(CHAIN);
    const mine = getOperationalFeeAllowanceQueryKey({ chainId: CHAIN, payer: ACCOUNT, configKey });
    const other = getOperationalFeeAllowanceQueryKey({ chainId: CHAIN, payer: OTHER_ACCOUNT, configKey });
    queryClient.setQueryData(mine, 0n);
    queryClient.setQueryData(other, 0n);

    const { result } = renderHookWithProviders(
      () => useApproveOperationalFeeAllowance({ config, waitForReceipt: false }),
      { queryClient },
    );

    await act(async () => {
      await result.current.mutateAsync({ chainId: CHAIN, account: ACCOUNT, chargers: [CHARGER], amounts: [7n] });
    });

    const callArgs = writeContract.mock.calls[0]?.[0].args as [Address, readonly `0x${string}`[]];
    const inner = decodeFunctionData({ abi: symmioAbi, data: callArgs[1][0]! });
    expect(inner.functionName).toBe("approveOperationalFee");
    expect(inner.args).toEqual([[CHARGER], [7n]]);
    expect(queryClient.getQueryState(mine)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false);
  });
});
