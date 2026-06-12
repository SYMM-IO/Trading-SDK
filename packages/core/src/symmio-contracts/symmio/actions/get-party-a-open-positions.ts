import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { Quote } from "../types";

/**
 * Parameters for {@link getPartyAOpenPositions}.
 */
export type GetPartyAOpenPositionsParameters = Compute<
  ChainIdParameter & {
    /** The partyA whose open positions to read — a SubAccount (Majors) or Virtual Account (VibeCaps). */
    partyA: Address;
    /**
     * Pagination offset into partyA's open-positions list.
     * @default 0n
     */
    start?: bigint;
    /**
     * Maximum number of positions to return from `start`. Clamped on-chain to the
     * number remaining.
     * @default 200n
     */
    size?: bigint;
  }
>;

/** Return type of {@link getPartyAOpenPositions}: the open-position quotes in range. */
export type GetPartyAOpenPositionsReturnType = readonly Quote[];

/**
 * Read a partyA's open positions (full {@link Quote} structs) within a paginated
 * range.
 *
 * Returns only quotes in `OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING`, or
 * `LIQUIDATED_PENDING` status. The underlying storage list is maintained with
 * swap-and-pop removal, so **ordering is not stable** — closing or liquidating a
 * position can reorder the list between calls; do not rely on index positions
 * across paginated reads.
 *
 * @remarks
 * `size` is clamped on-chain to the number of positions remaining after `start`,
 * so `start === length` yields an empty array. A `start` **greater than** the
 * list length reverts (Solidity arithmetic panic); read the count first if you
 * cannot bound `start`.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA, optional pagination (`start`/`size`), optional chain id.
 * @returns The open-position quotes found in the scanned range.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const positions = await getPartyAOpenPositions(config, { partyA: "0xva…" });
 * ```
 */
export async function getPartyAOpenPositions(
  config: Config,
  parameters: GetPartyAOpenPositionsParameters,
): Promise<GetPartyAOpenPositionsReturnType> {
  const { chainId, partyA, start = 0n, size = 200n } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getPartyAOpenPositions",
    args: [partyA, start, size],
  });
}
