import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import type { AffiliateRegistration } from "../types";
import { requestToRegisterAffiliate } from "./request-to-register-affiliate";

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

describe("requestToRegisterAffiliate", () => {
  it("writes requestToRegisterAffiliate to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await requestToRegisterAffiliate(config, { registration: REGISTRATION });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "requestToRegisterAffiliate",
        args: [REGISTRATION],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(requestToRegisterAffiliate(config, { registration: REGISTRATION })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await requestToRegisterAffiliate(config, { registration: REGISTRATION });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "requestToRegisterAffiliate", args: [REGISTRATION] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await requestToRegisterAffiliate(config, { registration: REGISTRATION, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(requestToRegisterAffiliate(config, { registration: REGISTRATION })).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
