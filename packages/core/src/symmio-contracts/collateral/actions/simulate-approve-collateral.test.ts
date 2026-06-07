import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateApproveCollateral } from "./simulate-approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateApproveCollateral", () => {
  it("simulates ERC20 approve of the collateral token for the SYMMIO core", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: true, request: {} });

    const res = await simulateApproveCollateral(config, { amount: 1_000000n, from: FROM });

    expect(res.result).toBe(true);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, 1_000000n],
        account: FROM,
      }),
    );
  });
});
