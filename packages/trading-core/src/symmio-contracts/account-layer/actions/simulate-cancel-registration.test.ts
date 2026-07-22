import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateCancelRegistration } from "./simulate-cancel-registration";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateCancelRegistration", () => {
  it("simulates cancelRegistration on the AccountLayer", async () => {
    const { config, simulateContract } = mockConfig();

    await simulateCancelRegistration(config, { affiliate: AFFILIATE, from: FROM });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "cancelRegistration",
        args: [AFFILIATE],
        account: FROM,
      }),
    );
  });

  it("does not require a wallet (uses the public client)", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(simulateCancelRegistration(config, { affiliate: AFFILIATE })).resolves.toBeDefined();
  });
});
