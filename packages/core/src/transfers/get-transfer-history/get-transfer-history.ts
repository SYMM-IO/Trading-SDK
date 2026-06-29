import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { InternalTransfersDocument } from "./query-document";
import { toTransferRow } from "./to-transfer-row";
import type { TransferDirection, TransferRow } from "./types";

/** Default page size when `first` is omitted. */
const DEFAULT_PAGE_SIZE = 1000;
/** Default upper time bound (far-future unix seconds) when `endTime` is omitted. */
const DEFAULT_END_TIME = 2_000_000_000;

/**
 * Parameters for {@link getTransferHistory}.
 */
export type GetTransferHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The accounts whose transfers to read (e.g. the addresses from
     * `getUserSubAccounts`). A transfer is matched when one of these is the
     * sender or the recipient. Required; an empty array reads nothing.
     */
    accounts: readonly Address[];
    /** Which transfers to return relative to {@link accounts}. @default "all" */
    direction?: TransferDirection;
    /** Page size. @default 1000 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Lower bound on the transfer timestamp (unix seconds). @default 0 */
    startTime?: number;
    /** Upper bound on the transfer timestamp (unix seconds). @default 2_000_000_000 */
    endTime?: number;
    /** Sort direction on the transfer timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getTransferHistory}. */
export interface GetTransferHistoryReturnType {
  /** The decoded transfer rows, newest first by default. */
  rows: TransferRow[];
}

/**
 * Read internal transfers (margin moves between SYMMIO accounts) from the
 * **events** subgraph's `internalTransfers` collection — the source behind a
 * "Transfer" view.
 *
 * Each row is one transfer with raw `from` / `to` endpoints, an 18-decimal
 * `amount`, and a `direction` relative to the queried accounts. Filtering by
 * direction, time range, and pagination all happen server-side.
 *
 * @param config - The SDK config.
 * @param parameters - Accounts, optional direction filter, pagination, time range, sort, chain id.
 * @returns The transfer rows.
 * @throws {SymmError} when the chain is unsupported or has no events subgraph configured.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getTransferHistory(config, {
 *   accounts: ["0xsub…"],
 *   direction: "outgoing",
 * });
 * ```
 */
export async function getTransferHistory(
  config: Config,
  parameters: GetTransferHistoryParameters,
): Promise<GetTransferHistoryReturnType> {
  const {
    chainId,
    accounts,
    direction = "all",
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    startTime = 0,
    endTime = DEFAULT_END_TIME,
    orderDirection = "desc",
  } = parameters;

  if (accounts.length === 0) return { rows: [] };

  const lowercased = accounts.map((account) => account.toLowerCase());
  // The query ORs `sender_in: $senders` with `user_in: $users`; an empty list
  // makes that branch match nothing, so direction is expressed by which list the
  // accounts go into.
  const senders = direction === "incoming" ? [] : lowercased;
  const users = direction === "outgoing" ? [] : lowercased;

  const data = await querySubgraph(config, {
    chainId,
    subgraph: "events",
    document: InternalTransfersDocument,
    variables: {
      senders,
      users,
      first,
      skip,
      orderDirection,
      startDate: startTime.toString(),
      endDate: endTime.toString(),
    },
  });

  const accountSet = new Set(lowercased);
  return { rows: data.internalTransfers.map((row) => toTransferRow(row, accountSet)) };
}
