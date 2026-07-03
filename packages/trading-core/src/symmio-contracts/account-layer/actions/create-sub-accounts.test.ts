import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { SubAccountIsolationType, type SubAccountCreationData } from "../types";
import { createSubAccounts } from "./create-sub-accounts";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SYMMIO_CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

const ACCOUNTS_DATA: readonly SubAccountCreationData[] = [
  {
    name: "Main",
    metadata: "0x",
    symmioCore: SYMMIO_CORE,
    isolationType: SubAccountIsolationType.MARKET,
    singleVAMode: true,
  },
];

describe("createSubAccounts", () => {
  it("writes createSubAccounts to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await createSubAccounts(config, { affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "createSubAccounts",
        args: [AFFILIATE, ACCOUNTS_DATA],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(createSubAccounts(config, { affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA })).rejects.toThrow(
      SymmError,
    );
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await createSubAccounts(config, { affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "createSubAccounts", args: [AFFILIATE, ACCOUNTS_DATA] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await createSubAccounts(config, {
        affiliate: AFFILIATE,
        accountsData: ACCOUNTS_DATA,
        simulateBeforeWrite: false,
      });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await createSubAccounts(config, { affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(createSubAccounts(config, { affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA })).rejects.toThrow(
        "would revert",
      );
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
