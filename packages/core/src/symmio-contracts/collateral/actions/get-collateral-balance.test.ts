import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getCollateralBalance } from "./get-collateral-balance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getCollateralBalance", () => {
  it("reads the owner's collateral-token balance", async () => {
    const { config, readContract } = mockConfig();

    await getCollateralBalance(config, { owner: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "balanceOf",
        args: [TEST_USER],
      }),
    );
  });
});
