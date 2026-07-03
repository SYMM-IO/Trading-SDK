import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { depositAndAllocateForAccountMutationOptions } from "./deposit-and-allocate-for-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 1_000000n;

describe("depositAndAllocateForAccountMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(depositAndAllocateForAccountMutationOptions(config).mutationKey).toEqual(["depositAndAllocateForAccount"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await depositAndAllocateForAccountMutationOptions(config).mutationFn({
      account: SUB_ACCOUNT,
      amount: AMOUNT,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "depositAndAllocateForAccount",
        args: [SUB_ACCOUNT, AMOUNT],
      }),
    );
  });
});
