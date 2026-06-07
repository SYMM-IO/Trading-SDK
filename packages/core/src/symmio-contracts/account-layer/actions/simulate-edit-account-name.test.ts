import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateEditAccountName } from "./simulate-edit-account-name";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateEditAccountName", () => {
  it("simulates editAccountName on the AccountLayer", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const res = await simulateEditAccountName(config, { account: ACCOUNT, name: "New", from: FROM });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [ACCOUNT, "New"],
        account: FROM,
      }),
    );
  });
});
