import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getActiveDelegations } from "./get-active-delegations";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";
const DELEGATOR = { addr: ACCOUNT, isPartyB: false } as const;

describe("getActiveDelegations", () => {
  it("reads the active delegations from the InstantLayer", async () => {
    const { config, readContract } = mockConfig();
    const active = [
      { account: DELEGATOR, delegatedSigner: DELEGATE, selectors: [SELECTOR], expiryTimestamp: 789n },
    ] as const;
    readContract.mockResolvedValueOnce(active);

    const result = await getActiveDelegations(config, {
      delegator: DELEGATOR,
      delegates: [DELEGATE],
      selectors: [[SELECTOR]],
    });

    expect(result).toEqual(active);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "getActiveDelegations",
        args: [DELEGATOR, [DELEGATE], [[SELECTOR]]],
      }),
    );
  });

  it("returns an empty list when nothing probed is live", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    const result = await getActiveDelegations(config, {
      delegator: DELEGATOR,
      delegates: [DELEGATE],
      selectors: [[SELECTOR]],
    });

    expect(result).toEqual([]);
  });

  it("passes a virtual-account delegator through untouched — the contract canonicalizes it", async () => {
    const virtualAccount: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getActiveDelegations(config, {
      delegator: { addr: virtualAccount, isPartyB: false },
      delegates: [DELEGATE],
      selectors: [[SELECTOR]],
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [{ addr: virtualAccount, isPartyB: false }, [DELEGATE], [[SELECTOR]]],
      }),
    );
  });
});
