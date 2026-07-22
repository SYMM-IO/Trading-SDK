import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { generateAccountManagerAddress } from "./generate-account-manager-address";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const REGISTRANT: Address = "0x1111111111111111111111111111111111111111";
const PREDICTED: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

describe("generateAccountManagerAddress", () => {
  it("reads generateAccountManagerAddress from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(PREDICTED);

    const predicted = await generateAccountManagerAddress(config, { registrant: REGISTRANT, name: "Acme" });

    expect(predicted).toBe(PREDICTED);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "generateAccountManagerAddress",
        args: [REGISTRANT, "Acme"],
      }),
    );
  });
});
