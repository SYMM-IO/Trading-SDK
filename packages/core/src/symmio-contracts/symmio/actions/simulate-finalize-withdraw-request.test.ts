import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateFinalizeWithdrawRequest } from "./simulate-finalize-withdraw-request";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const USER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateFinalizeWithdrawRequest", () => {
  it("simulates finalizeWithdrawRequest directly on the SYMMIO core", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const res = await simulateFinalizeWithdrawRequest(config, { user: USER, requestId: 1n, from: FROM });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "finalizeWithdrawRequest",
        args: [USER, 1n],
        account: FROM,
      }),
    );
  });
});
