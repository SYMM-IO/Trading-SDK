import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getAccountBalanceInfo } from "./get-account-balance-info";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const CONTRACT_RESULT = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n] as const;

describe("getAccountBalanceInfo", () => {
  it("reads balanceInfoOfPartyA from the configured SYMMIO core", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(CONTRACT_RESULT);

    const result = await getAccountBalanceInfo(config, { account: ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "balanceInfoOfPartyA",
        args: [ACCOUNT],
      }),
    );
    expect(result).toEqual({
      allocatedBalance: 1n,
      lockedCVA: 2n,
      lockedLF: 3n,
      lockedPartyAMM: 4n,
      lockedPartyBMM: 5n,
      pendingLockedCVA: 6n,
      pendingLockedLF: 7n,
      pendingLockedPartyAMM: 8n,
      pendingLockedPartyBMM: 9n,
    });
  });
});
