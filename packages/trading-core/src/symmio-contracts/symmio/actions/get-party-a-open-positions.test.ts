import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPartyAOpenPositions } from "./get-party-a-open-positions";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getPartyAOpenPositions", () => {
  it("reads from the SYMMIO core with default pagination", async () => {
    const { config, readContract } = mockConfig();

    await getPartyAOpenPositions(config, { partyA: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPartyAOpenPositions",
        args: [TEST_USER, 0n, 200n],
      }),
    );
  });

  it("forwards start and size", async () => {
    const { config, readContract } = mockConfig();

    await getPartyAOpenPositions(config, { partyA: TEST_USER, start: 10n, size: 50n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_USER, 10n, 50n] }));
  });
});
