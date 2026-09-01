import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import type { Quote } from "../types";

/**
 * Parameters for {@link getQuote}.
 */
export type GetQuoteParameters = Compute<
  ChainIdParameter & {
    /** The quote id to read. Quote ids are 1-based. */
    quoteId: bigint;
  }
>;

/** Return type of {@link getQuote}: the quote, or `null` when no quote has that id. */
export type GetQuoteReturnType = Quote | null;

/**
 * Read a single {@link Quote} by id.
 *
 * The underlying view reads a storage mapping and does **not** revert for an
 * unknown id — it returns a zeroed struct. Because quote ids start at 1, a result
 * with `id === 0n` means "not found"; this action maps that sentinel to `null`.
 *
 * @param config - The SDK config.
 * @param parameters - Quote id, optional chain id.
 * @returns The quote, or `null` if no quote exists with that id.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const quote = await getQuote(config, { quoteId: 42n });
 * if (quote) console.log(quote.quoteStatus);
 * ```
 */
export async function getQuote(config: Config, parameters: GetQuoteParameters): Promise<GetQuoteReturnType> {
  const { chainId, quoteId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const quote = await client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getQuote",
    args: [quoteId],
  });

  return quote.id === 0n ? null : quote;
}
