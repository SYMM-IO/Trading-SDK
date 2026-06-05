import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getPendingWithdrawRequests } from "./get-pending-withdraw-requests";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getPendingWithdrawRequests", () => {
  it("reads from the SYMMIO core with default pagination", async () => {
    const { config, readContract } = mockConfig();

    await getPendingWithdrawRequests(config, { user: SUB_ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPendingWithdrawRequests",
        args: [SUB_ACCOUNT, 1n, 200n],
      }),
    );
  });

  it("forwards start and size", async () => {
    const { config, readContract } = mockConfig();

    await getPendingWithdrawRequests(config, { user: SUB_ACCOUNT, start: 5n, size: 10n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [SUB_ACCOUNT, 5n, 10n] }));
  });
});
