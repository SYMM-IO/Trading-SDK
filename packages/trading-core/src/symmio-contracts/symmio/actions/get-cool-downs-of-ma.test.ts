import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getCoolDownsOfMA } from "./get-cool-downs-of-ma";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getCoolDownsOfMA", () => {
  it("reads coolDownsOfMA and returns the four cooldowns (index 1 = forceCancelCooldown)", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([10n, 300n, 600n, 900n]);

    const result = await getCoolDownsOfMA(config);

    expect(result).toEqual([10n, 300n, 600n, 900n]);
    expect(result[1]).toBe(300n); // forceCancelCooldown
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: DEFAULT.addresses.symmioAddress, functionName: "coolDownsOfMA" }),
    );
  });
});
