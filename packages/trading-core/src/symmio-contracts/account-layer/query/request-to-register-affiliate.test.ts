import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import type { AffiliateRegistration } from "../types";
import { requestToRegisterAffiliateMutationOptions } from "./request-to-register-affiliate";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ADMIN: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

const REGISTRATION: AffiliateRegistration = {
  name: "Acme",
  brandColor: "#ff5c39",
  admin: ADMIN,
  stakeholders: [{ receiver: ADMIN, share: 900000000000000000n }],
  symmioShare: 100000000000000000n,
  metadata: "0x",
  legacyMultiAccounts: [],
  symmioCores: [CORE],
};

describe("requestToRegisterAffiliateMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(requestToRegisterAffiliateMutationOptions(config).mutationKey).toEqual(["requestToRegisterAffiliate"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await requestToRegisterAffiliateMutationOptions(config).mutationFn({ registration: REGISTRATION });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "requestToRegisterAffiliate",
        args: [REGISTRATION],
      }),
    );
  });
});
