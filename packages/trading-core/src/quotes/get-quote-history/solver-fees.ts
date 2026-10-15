/**
 * Metadata tag of the rate-based solver fee — `notional × rate`, so it scales
 * with the size the event settled.
 */
const SOLVER_FEE_TAG = "SOLVER_FEE";

/**
 * Metadata tag of the flat solver fee — a fixed per-event charge, independent of
 * the settled size.
 */
const STATIC_SOLVER_FEE_TAG = "STATIC_SOLVER_FEE";

/**
 * The solver fees a single `QuoteEvent` charged, decoded from its `metadata`
 * `solverFees` list. All amounts are 18-decimal wei of collateral.
 */
export interface QuoteSolverFees {
  /** The `SOLVER_FEE` entry, or `null` when the event carried none. */
  solverFee: bigint | null;
  /** The `STATIC_SOLVER_FEE` entry, or `null` when the event carried none. */
  staticSolverFee: bigint | null;
  /**
   * Sum of every entry in the list — including tags this version does not name
   * individually — or `null` when the event recorded no `solverFees` at all.
   */
  totalSolverFee: bigint | null;
}

/** The decoded shape for an event that recorded no `solverFees` list. */
const NO_SOLVER_FEES: QuoteSolverFees = { solverFee: null, staticSolverFee: null, totalSolverFee: null };

/**
 * Read one entry's amount as a non-negative `bigint`, or `null` when it is
 * absent, unparsable, or negative (a fee is never negative, so a negative value
 * is malformed and must not skew the total).
 */
function toFeeAmount(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (text === "") return null;

  let parsed: bigint;
  try {
    parsed = BigInt(text);
  } catch {
    return null;
  }
  return parsed >= 0n ? parsed : null;
}

/**
 * Decode the `solverFees` value of a `QuoteEvent`'s `metadata` snapshot.
 *
 * The subgraph records the contract's `SolverFeeEntry[]` as a list of
 * `[tag, amount]` tuples, e.g.
 * `[["SOLVER_FEE", "659102399999999"], ["STATIC_SOLVER_FEE", "100000000000000000"]]`.
 * Only the fill-close and open-position events carry it; liquidation and ADL
 * events, and deployments indexed before the fee was recorded, omit it entirely.
 *
 * `totalSolverFee` sums **every** well-formed entry, so a tag added by a future
 * contract release still lands in the total even though it has no named field
 * here. Entries whose amount is missing, unparsable, or negative are skipped.
 *
 * @param solverFees - The `solverFees` value off the already-parsed metadata object.
 * @returns The named fees plus their total, each `null` when the list is absent or not a list.
 *
 * @example
 * ```ts
 * const metadata = JSON.parse(event.metadata);
 * const { solverFee, staticSolverFee, totalSolverFee } = parseSolverFees(metadata.solverFees);
 * ```
 */
export function parseSolverFees(solverFees: unknown): QuoteSolverFees {
  if (!Array.isArray(solverFees)) return NO_SOLVER_FEES;

  let solverFee: bigint | null = null;
  let staticSolverFee: bigint | null = null;
  let totalSolverFee = 0n;

  for (const entry of solverFees) {
    if (!Array.isArray(entry)) continue;

    const amount = toFeeAmount(entry[1]);
    if (amount === null) continue;

    totalSolverFee += amount;
    if (entry[0] === SOLVER_FEE_TAG) solverFee = amount;
    else if (entry[0] === STATIC_SOLVER_FEE_TAG) staticSolverFee = amount;
  }

  return { solverFee, staticSolverFee, totalSolverFee };
}
