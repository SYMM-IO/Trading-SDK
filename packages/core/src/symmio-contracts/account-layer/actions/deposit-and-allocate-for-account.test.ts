import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { depositAndAllocateForAccount } from "./deposit-and-allocate-for-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 1_000000n;

describe("depositAndAllocateForAccount", () => {
  it("writes depositAndAllocateForAccount to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await depositAndAllocateForAccount(config, { account: SUB_ACCOUNT, amount: AMOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "depositAndAllocateForAccount",
        args: [SUB_ACCOUNT, AMOUNT],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(depositAndAllocateForAccount(config, { account: SUB_ACCOUNT, amount: AMOUNT })).rejects.toThrow(
      SymmError,
    );
  });
});
