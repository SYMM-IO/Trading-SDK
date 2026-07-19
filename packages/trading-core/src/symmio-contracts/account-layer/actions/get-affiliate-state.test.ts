import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { AffiliateState } from "../types";
import { getAffiliateState } from "./get-affiliate-state";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

describe("getAffiliateState", () => {
  it("reads getAffiliateState from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(AffiliateState.PENDING);

    const state = await getAffiliateState(config, { affiliate: AFFILIATE });

    expect(state).toBe(AffiliateState.PENDING);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getAffiliateState",
        args: [AFFILIATE],
      }),
    );
  });
});
