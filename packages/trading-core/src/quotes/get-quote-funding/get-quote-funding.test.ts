import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getQuoteFunding, QUOTES_FUNDING_MAX_IDS_PER_REQUEST } from "./get-quote-funding";
import type { RawQuoteFundingRow } from "./to-funding-row";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

/** The GraphQL POST body the subgraph transport sends for `QuotesFunding`. */
interface FundingRequestBody {
  query: string;
  variables: { ids: string[]; first: number };
}

function fundingRow(quoteId: string, paid: string | null, received: string | null): RawQuoteFundingRow {
  return { quoteId, userPaidFunding: paid, userReceivedFunding: received };
}

/** Stub the transport so the action resolves against a fixed `quotes` payload. */
function mockQuotes(quotes: RawQuoteFundingRow[]) {
  return vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quotes } } });
}

/** Read the `QuotesFunding` variables out of one recorded `axios.post` call. */
function requestVariables(call: unknown[]): FundingRequestBody["variables"] {
  return (call[1] as FundingRequestBody).variables;
}

/** `count` consecutive quote ids, so a batch can exceed the per-request ceiling. */
function makeQuoteIds(count: number, start = 7000n): bigint[] {
  return Array.from({ length: count }, (_unused, index) => start + BigInt(index));
}

/**
 * Stub the transport the way The Graph behaves: echo one row back per requested
 * id (minus `omitted`, standing in for ids the subgraph has not indexed yet),
 * truncated to the request's own `first`.
 */
function mockPagedQuotes(omitted: ReadonlySet<string> = new Set()) {
  return vi.spyOn(axios, "post").mockImplementation(async (_url: string, body?: unknown) => {
    const { ids, first } = (body as FundingRequestBody).variables;
    const quotes = ids
      .filter((id) => !omitted.has(id))
      .slice(0, first)
      .map((id) => fundingRow(id, "1000000000000000000", "0"));
    return { data: { data: { quotes } } };
  });
}

describe("getQuoteFunding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty results and skips the network when no quote ids are passed", async () => {
    const post = vi.spyOn(axios, "post");

    expect(await getQuoteFunding(config, { quoteIds: [] })).toEqual({ rows: [], missingQuoteIds: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the funding query with stringified ids and returns decoded rows", async () => {
    const post = mockQuotes([fundingRow("7334", "3000000000000000000", "1000000000000000000")]);

    const result = await getQuoteFunding(config, { quoteIds: [7334n] });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]! as [string, FundingRequestBody];
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toContain("QuotesFunding");
    expect(body.variables).toEqual({ ids: ["7334"], first: QUOTES_FUNDING_MAX_IDS_PER_REQUEST });

    expect(result.rows).toEqual([
      { quoteId: 7334n, paid: 3000000000000000000n, received: 1000000000000000000n, net: 2000000000000000000n },
    ]);
    expect(result.missingQuoteIds).toEqual([]);
  });

  it("reports the input ids the subgraph did not return as missing", async () => {
    mockQuotes([fundingRow("7334", "1000000000000000000", "0"), fundingRow("7336", "0", "2000000000000000000")]);

    const result = await getQuoteFunding(config, { quoteIds: [7334n, 7335n, 7336n] });

    expect(result.rows.map((row) => row.quoteId)).toEqual([7334n, 7336n]);
    expect(result.missingQuoteIds).toEqual([7335n]);
  });

  it("reports no missing ids when the subgraph returns every requested id", async () => {
    mockQuotes([fundingRow("7334", "1000000000000000000", "0"), fundingRow("7335", "0", "5000000000000000000")]);

    const result = await getQuoteFunding(config, { quoteIds: [7334n, 7335n] });

    expect(result.missingQuoteIds).toEqual([]);
    expect(result.rows[1]!.net).toBe(-5000000000000000000n);
  });

  it("keeps a batch at exactly the per-request ceiling in a single request", async () => {
    const quoteIds = makeQuoteIds(QUOTES_FUNDING_MAX_IDS_PER_REQUEST);
    const post = mockPagedQuotes();

    const result = await getQuoteFunding(config, { quoteIds });

    expect(post).toHaveBeenCalledTimes(1);
    expect(requestVariables(post.mock.calls[0]!).ids).toHaveLength(QUOTES_FUNDING_MAX_IDS_PER_REQUEST);
    expect(result.rows).toHaveLength(QUOTES_FUNDING_MAX_IDS_PER_REQUEST);
    expect(result.missingQuoteIds).toEqual([]);
  });

  it("chunks a batch above the per-request ceiling and merges every row back", async () => {
    const remainder = 7;
    const quoteIds = makeQuoteIds(QUOTES_FUNDING_MAX_IDS_PER_REQUEST * 2 + remainder);
    const post = mockPagedQuotes();

    const result = await getQuoteFunding(config, { quoteIds });

    expect(post).toHaveBeenCalledTimes(3);
    const batches = post.mock.calls.map((call) => requestVariables(call));
    expect(batches.map((batch) => batch.ids.length)).toEqual([
      QUOTES_FUNDING_MAX_IDS_PER_REQUEST,
      QUOTES_FUNDING_MAX_IDS_PER_REQUEST,
      remainder,
    ]);
    /** Every id is requested exactly once, in input order, across the chunks. */
    expect(batches.flatMap((batch) => batch.ids)).toEqual(quoteIds.map((id) => id.toString()));

    expect(result.rows).toHaveLength(quoteIds.length);
    expect(result.rows.map((row) => row.quoteId)).toEqual(quoteIds);
    expect(result.missingQuoteIds).toEqual([]);
  });

  it("sends an explicit `first` on every chunk so The Graph cannot truncate to its default page", async () => {
    const post = mockPagedQuotes();

    await getQuoteFunding(config, { quoteIds: makeQuoteIds(QUOTES_FUNDING_MAX_IDS_PER_REQUEST + 1) });

    expect(post).toHaveBeenCalledTimes(2);
    for (const call of post.mock.calls) {
      expect(requestVariables(call).first).toBe(QUOTES_FUNDING_MAX_IDS_PER_REQUEST);
    }
  });

  it("issues the chunk requests concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.spyOn(axios, "post").mockImplementation(async (_url: string, body?: unknown) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const { ids } = (body as FundingRequestBody).variables;
      return { data: { data: { quotes: ids.map((id) => fundingRow(id, "0", "0")) } } };
    });

    await getQuoteFunding(config, { quoteIds: makeQuoteIds(QUOTES_FUNDING_MAX_IDS_PER_REQUEST * 3) });

    expect(maxInFlight).toBe(3);
  });

  it("computes missingQuoteIds across the full input set, not just the last chunk", async () => {
    const quoteIds = makeQuoteIds(QUOTES_FUNDING_MAX_IDS_PER_REQUEST + 3);
    const missing = [quoteIds[5]!, quoteIds[QUOTES_FUNDING_MAX_IDS_PER_REQUEST + 1]!];
    const post = mockPagedQuotes(new Set(missing.map((id) => id.toString())));

    const result = await getQuoteFunding(config, { quoteIds });

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.missingQuoteIds).toEqual(missing);
    expect(result.rows).toHaveLength(quoteIds.length - missing.length);
  });
});
