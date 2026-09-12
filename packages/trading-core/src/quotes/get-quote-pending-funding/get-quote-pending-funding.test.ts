import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { getQuotePendingFunding } from "./get-quote-pending-funding";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ARBITRUM = getChainConfig(SymmioSupportedChainId.ARBITRUM);

/** The `readContract` request shape this action sends. */
interface DebtsRequest {
  args: [readonly bigint[]];
}

/** `count` consecutive quote ids starting at 1. */
function makeQuoteIds(count: number): bigint[] {
  return Array.from({ length: count }, (_unused, index) => BigInt(index + 1));
}

/** The id batch sent by the `callIndex`-th `readContract` call. */
function batchOf(calls: unknown[][], callIndex: number): readonly bigint[] {
  return (calls[callIndex]?.[0] as DebtsRequest).args[0];
}

describe("getQuotePendingFunding", () => {
  it("reads getQuoteFundingDebts from the SYMMIO core with the quote ids", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([0n, 0n]);

    await getQuotePendingFunding(config, { quoteIds: [7334n, 7335n] });

    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith({
      address: DEFAULT.addresses.symmioAddress,
      abi: symmioAbi,
      functionName: "getQuoteFundingDebts",
      args: [[7334n, 7335n]],
    });
  });

  it("de-duplicates the ids and returns rows sorted by quoteId ascending", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockImplementationOnce(async ({ args }: DebtsRequest) => args[0].map((id) => id * 10n));
    const quoteIds = [30n, 10n, 20n, 10n, 30n];

    const rows = await getQuotePendingFunding(config, { quoteIds });

    expect(batchOf(readContract.mock.calls, 0)).toEqual([10n, 20n, 30n]);
    expect(rows).toEqual([
      { quoteId: 10n, pendingNetReceived: -100n },
      { quoteId: 20n, pendingNetReceived: -200n },
      { quoteId: 30n, pendingNetReceived: -300n },
    ]);
    expect(quoteIds).toEqual([30n, 10n, 20n, 10n, 30n]);
  });

  it("negates the cost-positive contract debt into income-positive pendingNetReceived", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([5n, -7n, 0n]);

    const rows = await getQuotePendingFunding(config, { quoteIds: [1n, 2n, 3n] });

    expect(rows).toEqual([
      { quoteId: 1n, pendingNetReceived: -5n },
      { quoteId: 2n, pendingNetReceived: 7n },
      { quoteId: 3n, pendingNetReceived: 0n },
    ]);
    expect(rows[2]?.pendingNetReceived).toBe(0n);
  });

  it("reads 60 ids in sequential batches of 25, 25 and 10", async () => {
    const { config, readContract } = mockConfig();
    let inFlight = 0;
    let maxInFlight = 0;
    readContract.mockImplementation(async ({ args }: DebtsRequest) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return args[0].map((id) => id);
    });
    const quoteIds = makeQuoteIds(60);

    const rows = await getQuotePendingFunding(config, { quoteIds });

    expect(readContract).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
    expect(batchOf(readContract.mock.calls, 0)).toEqual(quoteIds.slice(0, 25));
    expect(batchOf(readContract.mock.calls, 1)).toEqual(quoteIds.slice(25, 50));
    expect(batchOf(readContract.mock.calls, 2)).toEqual(quoteIds.slice(50, 60));
    expect(rows.map((row) => row.quoteId)).toEqual(quoteIds);
    expect(rows.map((row) => row.pendingNetReceived)).toEqual(quoteIds.map((id) => -id));
  });

  it("honors a custom batchSize", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockImplementation(async ({ args }: DebtsRequest) => args[0].map(() => 0n));

    const rows = await getQuotePendingFunding(config, { quoteIds: makeQuoteIds(5), batchSize: 2 });

    expect(readContract).toHaveBeenCalledTimes(3);
    expect(batchOf(readContract.mock.calls, 0)).toEqual([1n, 2n]);
    expect(batchOf(readContract.mock.calls, 1)).toEqual([3n, 4n]);
    expect(batchOf(readContract.mock.calls, 2)).toEqual([5n]);
    expect(rows).toHaveLength(5);
  });

  it.each([0, -1, 2.5, Number.NaN])(
    "rejects batchSize %s with a SymmError and makes no RPC call",
    async (batchSize) => {
      const { config, readContract } = mockConfig();

      await expect(getQuotePendingFunding(config, { quoteIds: [1n], batchSize })).rejects.toMatchObject({
        name: "SymmError",
        kind: "validation",
        code: "INVALID_BATCH_SIZE",
      });
      expect(readContract).not.toHaveBeenCalled();
    },
  );

  it("returns [] without an RPC call for an empty id list", async () => {
    const { config, readContract } = mockConfig();

    await expect(getQuotePendingFunding(config, { quoteIds: [] })).resolves.toEqual([]);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("throws a SymmError for an unsupported chain", async () => {
    const { config, readContract } = mockConfig();

    await expect(getQuotePendingFunding(config, { chainId: mainnet.id, quoteIds: [1n] })).rejects.toThrow(SymmError);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the Arbitrum diamond when chainId targets Arbitrum", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([-3n]);

    const rows = await getQuotePendingFunding(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      quoteIds: [42n],
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ARBITRUM.addresses.symmioAddress,
        functionName: "getQuoteFundingDebts",
        args: [[42n]],
      }),
    );
    expect(rows).toEqual([{ quoteId: 42n, pendingNetReceived: 3n }]);
  });
});
