import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { getPendingWithdrawRequestsAbiV085 } from "../internal/withdraw-requests-v0-8-5";
import { getPendingWithdrawRequests } from "./get-pending-withdraw-requests";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** A decoded v0.8.5 request row — no `advancedAmount`; the action must stamp it. */
const LEGACY_ROW = {
  id: 1n,
  user: SUB_ACCOUNT,
  parts: [],
  timestamp: 1n,
  cooldownEndTime: 2n,
  status: 0,
  speedUp: false,
  isCooldownModified: false,
  provider: SUB_ACCOUNT,
  isPureVirtual: false,
  providerData: "0x",
  totalAmount: 5n,
  totalVirtualAmount: 0n,
};

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

  it("decodes with the v0.8.5 fragment on a v0.8.5 chain — advancedAmount stays undefined", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue([LEGACY_ROW]);

    /** HyperEVM is a `contractsVersion: "0.8.5"` chain. */
    const result = await getPendingWithdrawRequests(config, { user: SUB_ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ abi: getPendingWithdrawRequestsAbiV085 }));
    expect(result).toEqual([LEGACY_ROW]);
    expect(result[0]?.advancedAmount).toBeUndefined();
  });

  it("decodes with the shipped v0.8.6 ABI on a v0.8.6 chain, advancedAmount passing through", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue([{ ...LEGACY_ROW, advancedAmount: 7n }]);

    const result = await getPendingWithdrawRequests(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      user: SUB_ACCOUNT,
    });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ abi: symmioAbi }));
    expect(result).toEqual([{ ...LEGACY_ROW, advancedAmount: 7n }]);
  });
});
