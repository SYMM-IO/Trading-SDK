import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import type { AffiliateRegistration } from "../types";
import { simulateRequestToRegisterAffiliate } from "./simulate-request-to-register-affiliate";

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

describe("simulateRequestToRegisterAffiliate", () => {
  it("simulates requestToRegisterAffiliate on the AccountLayer and returns the predicted address", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: PREDICTED, request: {} });

    const res = await simulateRequestToRegisterAffiliate(config, { registration: REGISTRATION, from: FROM });

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

  it("does not require a wallet (uses the public client)", async () => {
    const { config, simulateContract } = mockConfig({ withWallet: false });
    simulateContract.mockResolvedValueOnce({ result: PREDICTED, request: {} });

    await expect(simulateRequestToRegisterAffiliate(config, { registration: REGISTRATION })).resolves.toBeDefined();
  });
});
