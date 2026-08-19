import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { Quote } from "../types";
import { getPartyAPendingQuotes } from "./get-party-a-pending-quotes";

/** Default number of `getQuote` reads per multicall batch. */
const DEFAULT_BATCH_SIZE = 10;

/**
 * Parameters for {@link getPendingQuotes}.
 */
export type GetPendingQuotesParameters = Compute<
  ChainIdParameter & {
    /** PartyA (virtual account, or the sub-account for cross-margin) whose resting limit orders to read. */
    partyA: Address;
    /** How many `getQuote` reads to bundle per multicall. @default 10 */
    batchSize?: number;
  }
>;

/** Return type of {@link getPendingQuotes}: the hydrated resting limit-order {@link Quote} structs. */
export type GetPendingQuotesReturnType = Quote[];

/**
 * Read a partyA's resting **LIMIT orders** as **full {@link Quote} structs**. A
 * pending quote is one that has not opened yet — in practice a limit order
 * waiting to fill (`PENDING` / `LOCKED` / `CANCEL_PENDING`), since a market order
 * never rests here.
 *
 * The contract exposes only the pending quote ids ({@link getPartyAPendingQuotes})
 * and a per-id `getQuote`, so this hydrates them: fetch the ids, then read the
 * quotes with `getQuote` bundled into **multicalls of `batchSize`** (default 10)
 * to keep each RPC round-trip small. Zeroed (`id === 0n`) entries are dropped.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA, optional chain id and batch size.
 * @returns The hydrated limit orders (empty when partyA has none).
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` / multicall errors for on-chain failures.
 *
 * @example
 * ```ts
 * const limitOrders = await getPendingQuotes(config, { partyA: "0xsub…" });
 * ```
 */
export async function getPendingQuotes(
  config: Config,
  parameters: GetPendingQuotesParameters,
): Promise<GetPendingQuotesReturnType> {
  const { chainId, partyA, batchSize = DEFAULT_BATCH_SIZE } = parameters;

  const ids = await getPartyAPendingQuotes(config, { chainId, partyA });
  if (ids.length === 0) return [];

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const quotes: Quote[] = [];
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const results = await client.multicall({
      allowFailure: false,
      contracts: batch.map(
        (quoteId) =>
          ({
            address: addresses.symmioAddress,
            abi: symmioAbi,
            functionName: "getQuote",
            args: [quoteId],
          }) as const,
      ),
    });
    for (const quote of results) {
      // `getQuote` returns a zeroed struct for an unknown id (ids are 1-based).
      if (quote.id !== 0n) quotes.push(quote);
    }
  }

  return quotes;
}
