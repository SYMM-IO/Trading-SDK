import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getInstantLayerNonce } from "./get-instant-layer-nonce";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getInstantLayerNonce", () => {
  it("reads the account's replay nonce from the InstantLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(7n);

    const result = await getInstantLayerNonce(config, { account: ACCOUNT });

    expect(result).toBe(7n);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "nonces",
        args: [ACCOUNT],
      }),
    );
  });
});
