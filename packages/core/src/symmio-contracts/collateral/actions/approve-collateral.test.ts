import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { approveCollateral } from "./approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AMOUNT = 5_000000n;

describe("approveCollateral", () => {
  it("approves the collateral token for the SYMMIO core", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await approveCollateral(config, { amount: AMOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(approveCollateral(config, { amount: AMOUNT })).rejects.toThrow(SymmError);
  });
});
