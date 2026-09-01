import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link getPartyAPendingQuotes}.
 */
export type GetPartyAPendingQuotesParameters = Compute<
  ChainIdParameter & {
    /** The partyA (virtual account, lowcap) whose pending quote ids to read. */
    partyA: Address;
  }
>;

/** Return type of {@link getPartyAPendingQuotes}: the pending quote ids. */
export type GetPartyAPendingQuotesReturnType = readonly bigint[];

/**
 * Read the ids of a partyA's pending quotes — those in `PENDING`, `LOCKED`, or
 * `CANCEL_PENDING` status (limit orders and not-yet-opened quotes).
 *
 * The contract returns the **whole** id array with no pagination. The ids are
 * returned, not the full structs; hydrate them with {@link "getQuote"} (one read
 * per id, e.g. via a viem multicall).
 *
 * @param config - The SDK config.
 * @param parameters - PartyA, optional chain id.
 * @returns The pending quote ids.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const ids = await getPartyAPendingQuotes(config, { partyA: "0xva…" });
 * const quotes = await Promise.all(ids.map((quoteId) => getQuote(config, { quoteId })));
 * ```
 */
export async function getPartyAPendingQuotes(
  config: Config,
  parameters: GetPartyAPendingQuotesParameters,
): Promise<GetPartyAPendingQuotesReturnType> {
  const { chainId, partyA } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getPartyAPendingQuotes",
    args: [partyA],
  });
}
