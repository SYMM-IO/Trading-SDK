import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getOperationalFeeAllowance } from "./get-operational-fee-allowance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PAYER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHARGER: Address = "0x8347953D80037b8d82827246f37EC7442AD188B4";

describe("getOperationalFeeAllowance", () => {
  it("reads the allowance tuple from the diamond for an explicit charger", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([100n, 40n, 1_700_000_000n, 10_000n]);

    const result = await getOperationalFeeAllowance(config, { payer: PAYER, charger: CHARGER });

    expect(result).toEqual({
      allowance: 100n,
      pendingAllowance: 40n,
      reductionReadyAt: 1_700_000_000n,
      feeMultiplier: 10_000n,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getOperationalFeeAllowance",
        args: [PAYER, CHARGER],
      }),
    );
  });

  it("requires an explicit charger when the chain has no gasless block", async () => {
    const { config } = mockConfig();

    await expect(getOperationalFeeAllowance(config, { payer: PAYER })).rejects.toThrowError(
      /GASLESS_CHARGER_REQUIRED|charger/,
    );
  });
});
