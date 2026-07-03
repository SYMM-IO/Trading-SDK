import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateDepositAndAllocateForAccountMutationOptions } from "./simulate-deposit-and-allocate-for-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const AMOUNT = 1_000000n;

describe("simulateDepositAndAllocateForAccountMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateDepositAndAllocateForAccountMutationOptions(config).mutationKey).toEqual([
      "simulateDepositAndAllocateForAccount",
    ]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();

    await simulateDepositAndAllocateForAccountMutationOptions(config).mutationFn({
      account: SUB_ACCOUNT,
      amount: AMOUNT,
      from: FROM,
    });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "depositAndAllocateForAccount",
        args: [SUB_ACCOUNT, AMOUNT],
        account: FROM,
      }),
    );
  });
});
