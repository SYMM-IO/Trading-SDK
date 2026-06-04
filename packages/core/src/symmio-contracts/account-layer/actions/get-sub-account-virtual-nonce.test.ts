import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getSubAccountVirtualNonce } from "./get-sub-account-virtual-nonce";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getSubAccountVirtualNonce", () => {
  it("reads getSubAccountVirtualNonce from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(7n);

    const nonce = await getSubAccountVirtualNonce(config, { subAccount: SUB_ACCOUNT });

    expect(nonce).toBe(7n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getSubAccountVirtualNonce",
        args: [SUB_ACCOUNT],
      }),
    );
  });
});
