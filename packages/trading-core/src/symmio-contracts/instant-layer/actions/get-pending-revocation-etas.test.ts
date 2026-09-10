import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPendingRevocationEtas } from "./get-pending-revocation-etas";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const DELEGATOR = { addr: TEST_USER, isPartyB: false } as const;
const DELEGATE: Hex = "0x2222222222222222222222222222222222222222";
const SELECTORS: Hex[] = ["0xaaaaaaaa", "0xbbbbbbbb", "0xcccccccc"];

describe("getPendingRevocationEtas", () => {
  it("maps each scheduled selector to its ETA and drops the unscheduled ones", async () => {
    const { config, multicall } = mockConfig();
    multicall.mockResolvedValueOnce([1_700n, 0n, 1_900n]);

    const result = await getPendingRevocationEtas(config, {
      delegator: DELEGATOR,
      delegate: DELEGATE,
      selectors: SELECTORS,
    });

    expect([...result]).toEqual([
      ["0xaaaaaaaa", 1_700n],
      ["0xcccccccc", 1_900n],
    ]);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        allowFailure: false,
        contracts: SELECTORS.map((selector) =>
          expect.objectContaining({
            address: DEFAULT.addresses.instantLayerAddress,
            functionName: "pendingRevocationEta",
            args: [DELEGATOR.addr, DELEGATE, selector],
          }),
        ),
      }),
    );
  });

  it("returns an empty map when nothing is scheduled", async () => {
    const { config, multicall } = mockConfig();
    multicall.mockResolvedValueOnce([0n, 0n, 0n]);

    const result = await getPendingRevocationEtas(config, {
      delegator: DELEGATOR,
      delegate: DELEGATE,
      selectors: SELECTORS,
    });

    expect(result.size).toBe(0);
  });

  it("reads nothing at all for an empty selector list", async () => {
    const { config, multicall } = mockConfig();

    const result = await getPendingRevocationEtas(config, {
      delegator: DELEGATOR,
      delegate: DELEGATE,
      selectors: [],
    });

    expect(result.size).toBe(0);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("splits the selectors into multicalls of batchSize", async () => {
    const { config, multicall } = mockConfig();
    multicall.mockResolvedValueOnce([1_700n, 0n]).mockResolvedValueOnce([1_900n]);

    const result = await getPendingRevocationEtas(config, {
      delegator: DELEGATOR,
      delegate: DELEGATE,
      selectors: SELECTORS,
      batchSize: 2,
    });

    expect(multicall).toHaveBeenCalledTimes(2);
    expect([...result.keys()]).toEqual(["0xaaaaaaaa", "0xcccccccc"]);
  });

  it("reads the InstantLayer of the requested chain", async () => {
    const chainId = SymmioSupportedChainId.ARBITRUM;
    const { config, multicall } = mockConfig();
    multicall.mockResolvedValueOnce([0n]);

    await getPendingRevocationEtas(config, {
      chainId,
      delegator: DELEGATOR,
      delegate: DELEGATE,
      selectors: ["0xaaaaaaaa"],
    });

    expect(multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: [expect.objectContaining({ address: getChainConfig(chainId).addresses.instantLayerAddress })],
      }),
    );
  });
});
