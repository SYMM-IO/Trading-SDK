import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import type { AffiliateRegistration } from "../types";
import { simulateRequestToRegisterAffiliateMutationOptions } from "./simulate-request-to-register-affiliate";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ADMIN: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const PREDICTED: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

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

describe("simulateRequestToRegisterAffiliateMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateRequestToRegisterAffiliateMutationOptions(config).mutationKey).toEqual([
      "simulateRequestToRegisterAffiliate",
    ]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: PREDICTED, request: {} });

    const res = await simulateRequestToRegisterAffiliateMutationOptions(config).mutationFn({
      registration: REGISTRATION,
      from: FROM,
    });

    expect(res.result).toBe(PREDICTED);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "requestToRegisterAffiliate",
        args: [REGISTRATION],
        account: FROM,
      }),
    );
  });
});
