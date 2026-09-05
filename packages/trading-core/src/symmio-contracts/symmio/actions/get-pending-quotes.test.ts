import { describe, expect, it } from "vitest";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import type { Quote } from "../types";
import { getPendingQuotes } from "./get-pending-quotes";

/** Minimal quote — the action only reads `id`. */
function fakeQuote(id: bigint): Quote {
  return { id } as unknown as Quote;
}

describe("getPendingQuotes", () => {
  it("returns [] and never multicalls when partyA has no pending ids", async () => {
    const { config, readContract, multicall } = mockConfig();
    readContract.mockResolvedValueOnce([]); // getPartyAPendingQuotes

    expect(await getPendingQuotes(config, { partyA: TEST_USER })).toEqual([]);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("hydrates ids via getQuote in multicalls batched by 10", async () => {
    const { config, readContract, multicall } = mockConfig();
    const ids = Array.from({ length: 23 }, (_, i) => BigInt(i + 1));
    readContract.mockResolvedValueOnce(ids);
    multicall.mockImplementation(async ({ contracts }: { contracts: { args: [bigint] }[] }) =>
      contracts.map((c) => fakeQuote(c.args[0])),
    );

    const result = await getPendingQuotes(config, { partyA: TEST_USER });

    expect(result).toHaveLength(23);
    expect(multicall).toHaveBeenCalledTimes(3); // 10 + 10 + 3
    for (const [{ contracts }] of multicall.mock.calls) {
      expect(contracts.length).toBeLessThanOrEqual(10);
      expect(contracts[0].functionName).toBe("getQuote");
    }
  });

  it("drops zeroed (id === 0n) quotes", async () => {
    const { config, readContract, multicall } = mockConfig();
    readContract.mockResolvedValueOnce([1n, 2n]);
    multicall.mockResolvedValueOnce([fakeQuote(1n), fakeQuote(0n)]);

    const result = await getPendingQuotes(config, { partyA: TEST_USER });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1n);
  });

  it("honors a custom batchSize", async () => {
    const { config, readContract, multicall } = mockConfig();
    readContract.mockResolvedValueOnce([1n, 2n, 3n, 4n, 5n]);
    multicall.mockImplementation(async ({ contracts }: { contracts: { args: [bigint] }[] }) =>
      contracts.map((c) => fakeQuote(c.args[0])),
    );

    await getPendingQuotes(config, { partyA: TEST_USER, batchSize: 2 });

    expect(multicall).toHaveBeenCalledTimes(3); // 2 + 2 + 1
  });
});
