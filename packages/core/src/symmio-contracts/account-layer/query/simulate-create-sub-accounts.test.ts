import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { SubAccountIsolationType, type SubAccountCreationData } from "../types";
import { simulateCreateSubAccountsMutationOptions } from "./simulate-create-sub-accounts";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SYMMIO_CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const FROM: Address = "0x1111111111111111111111111111111111111111";

const ACCOUNTS_DATA: readonly SubAccountCreationData[] = [
  {
    name: "Main",
    metadata: "0x",
    symmioCore: SYMMIO_CORE,
    isolationType: SubAccountIsolationType.MARKET,
    singleVAMode: true,
  },
];

describe("simulateCreateSubAccountsMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateCreateSubAccountsMutationOptions(config).mutationKey).toEqual(["simulateCreateSubAccounts"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: [SYMMIO_CORE], request: {} });

    const res = await simulateCreateSubAccountsMutationOptions(config).mutationFn({
      affiliate: AFFILIATE,
      accountsData: ACCOUNTS_DATA,
      from: FROM,
    });

    expect(res.result).toEqual([SYMMIO_CORE]);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "createSubAccounts",
        args: [AFFILIATE, ACCOUNTS_DATA],
        account: FROM,
      }),
    );
  });
});
