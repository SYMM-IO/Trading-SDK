import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateDeleteSubAccount } from "./simulate-delete-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateDeleteSubAccount", () => {
  it("simulates deleteSubAccount on the AccountLayer", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    await simulateDeleteSubAccount(config, { subAccount: SUB_ACCOUNT, from: FROM });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "deleteSubAccount",
        args: [SUB_ACCOUNT],
        account: FROM,
      }),
    );
  });

  it("does not require a wallet (uses the public client)", async () => {
    const { config, simulateContract } = mockConfig({ withWallet: false });
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    await expect(simulateDeleteSubAccount(config, { subAccount: SUB_ACCOUNT })).resolves.toBeDefined();
  });
});
