import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { SubAccountIsolationType, type SubAccountCreationData } from "../types";
import { createSubAccountsMutationOptions } from "./create-sub-accounts";

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

describe("createSubAccountsMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(createSubAccountsMutationOptions(config).mutationKey).toEqual(["createSubAccounts"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await createSubAccountsMutationOptions(config).mutationFn({
      affiliate: AFFILIATE,
      accountsData: ACCOUNTS_DATA,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "createSubAccounts",
        args: [AFFILIATE, ACCOUNTS_DATA],
      }),
    );
  });
});
