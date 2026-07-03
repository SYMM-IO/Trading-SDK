import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPartyAPendingQuotes } from "./get-party-a-pending-quotes";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getPartyAPendingQuotes", () => {
  it("reads the pending quote ids from the SYMMIO core", async () => {
    const { config, readContract } = mockConfig();

    await getPartyAPendingQuotes(config, { partyA: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPartyAPendingQuotes",
        args: [TEST_USER],
      }),
    );
  });

  it("returns the ids the contract reports", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([1n, 2n, 3n]);

    const ids = await getPartyAPendingQuotes(config, { partyA: TEST_USER });

    expect(ids).toEqual([1n, 2n, 3n]);
  });
});
