import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getCollateralAllowance } from "./get-collateral-allowance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getCollateralAllowance", () => {
  it("reads the owner's allowance to the SYMMIO core", async () => {
    const { config, readContract } = mockConfig();

    await getCollateralAllowance(config, { owner: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "allowance",
        args: [TEST_USER, DEFAULT.addresses.symmioAddress],
      }),
    );
  });
});
