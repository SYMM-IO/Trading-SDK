import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { isPartyALiquidated } from "./is-party-a-liquidated";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("isPartyALiquidated", () => {
  it("reads the liquidation flag from the SYMMIO core", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(true);

    await expect(isPartyALiquidated(config, { partyA: TEST_USER })).resolves.toBe(true);

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "isPartyALiquidated",
        args: [TEST_USER],
      }),
    );
  });
});
