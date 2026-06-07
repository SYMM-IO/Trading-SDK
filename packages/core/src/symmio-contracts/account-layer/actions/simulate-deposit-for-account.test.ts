import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateDepositForAccount } from "./simulate-deposit-for-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateDepositForAccount", () => {
  it("simulates depositForAccount on the AccountLayer", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const res = await simulateDepositForAccount(config, { account: ACCOUNT, amount: 1_000000n, from: FROM });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "depositForAccount",
        args: [ACCOUNT, 1_000000n],
        account: FROM,
      }),
    );
  });
});
