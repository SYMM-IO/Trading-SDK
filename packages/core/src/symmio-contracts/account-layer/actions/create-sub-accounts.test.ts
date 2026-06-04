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
});
