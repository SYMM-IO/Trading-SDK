import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateGrantDelegations } from "./simulate-grant-delegations";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SIGNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const SELECTORS: readonly Hex[] = ["0x12345678"];

describe("simulateGrantDelegations", () => {
  it("simulates grantDelegations on the InstantLayer as `from`", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const res = await simulateGrantDelegations(config, {
      account: { addr: ACCOUNT, isPartyB: false },
      delegations: [{ delegatedSigner: SIGNER, selectors: SELECTORS, expiryTimestamp: 1_700_000_000n }],
      from: FROM,
    });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "grantDelegations",
        args: [
          [
            {
              account: { addr: ACCOUNT, isPartyB: false },
              delegatedSigner: SIGNER,
              selectors: SELECTORS,
              expiryTimestamp: 1_700_000_000n,
            },
          ],
        ],
        account: FROM,
      }),
    );
  });

  it("rejects an empty list without simulating", async () => {
    const { config, simulateContract } = mockConfig();

    await expect(
      simulateGrantDelegations(config, { account: { addr: ACCOUNT, isPartyB: false }, delegations: [] }),
    ).rejects.toMatchObject({ code: "GRANT_DELEGATIONS_EMPTY" });
    expect(simulateContract).not.toHaveBeenCalled();
  });
});
