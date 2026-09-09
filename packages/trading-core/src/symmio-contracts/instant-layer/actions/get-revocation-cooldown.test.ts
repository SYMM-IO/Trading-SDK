import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getRevocationCooldown } from "./get-revocation-cooldown";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getRevocationCooldown", () => {
  it("reads the revocation cooldown from the InstantLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(3600n);

    const result = await getRevocationCooldown(config);

    expect(result).toBe(3600n);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "revocationCooldown",
      }),
    );
  });

  it("reads the cooldown of the requested chain", async () => {
    const chainId = SymmioSupportedChainId.ARBITRUM;
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(0n);

    await getRevocationCooldown(config, { chainId });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getChainConfig(chainId).addresses.instantLayerAddress,
        functionName: "revocationCooldown",
      }),
    );
  });
});
