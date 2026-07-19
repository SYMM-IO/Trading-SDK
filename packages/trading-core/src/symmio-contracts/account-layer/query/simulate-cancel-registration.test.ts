import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateCancelRegistrationMutationOptions } from "./simulate-cancel-registration";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateCancelRegistrationMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateCancelRegistrationMutationOptions(config).mutationKey).toEqual(["simulateCancelRegistration"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();

    await simulateCancelRegistrationMutationOptions(config).mutationFn({ affiliate: AFFILIATE, from: FROM });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "cancelRegistration",
        args: [AFFILIATE],
        account: FROM,
      }),
    );
  });
});
