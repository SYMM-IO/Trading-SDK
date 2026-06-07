import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateGrantDelegation } from "./simulate-grant-delegation";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SIGNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const SELECTORS: readonly Hex[] = ["0x12345678"];

describe("simulateGrantDelegation", () => {
  it("simulates grantDelegation on the InstantLayer", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const res = await simulateGrantDelegation(config, {
      account: { addr: ACCOUNT, isPartyB: false },
      delegatedSigner: SIGNER,
      selectors: SELECTORS,
      expiryTimestamp: 1_700_000_000n,
      from: FROM,
    });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "grantDelegation",
        args: [
          {
            account: { addr: ACCOUNT, isPartyB: false },
            delegatedSigner: SIGNER,
            selectors: SELECTORS,
            expiryTimestamp: 1_700_000_000n,
          },
        ],
        account: FROM,
      }),
    );
  });
});
