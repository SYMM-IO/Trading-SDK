import { SymmError } from "../shared/errors/symm-error";

/** Largest page The Graph serves for one entity collection. */
export const SUBGRAPH_MAX_PAGE_SIZE = 1000;

/**
 * Paging and sort shared by the entity reads (`getMarginTransfers`,
 * `getLiquidationDetails`, `getSubgraphQuotes`, `getQuoteFundingSettlements`,
 * `getFundingIndexCheckpoints`).
 *
 * One call returns one page; the consumer loops. For long reads page by cursor:
 * `orderBy: "id"`, `orderDirection: "asc"`, and pass the last row's `id` as
 * `idGt` — The Graph caps `skip` at 5000, a cursor has no ceiling.
 */
export interface SubgraphPageParameters {
  /** Page size, 1–1000. @default 1000 */
  first?: number;
  /** Rows to skip. The Graph rejects values above 5000. @default 0 */
  skip?: number;
  /** Sort field. @default "timestamp" */
  orderBy?: "timestamp" | "id";
  /** Sort direction. @default "desc" */
  orderDirection?: "asc" | "desc";
  /** Cursor filter (`id_gt`): only entities whose `id` sorts after this one. */
  idGt?: string;
}

/** One page of an entity read. */
export interface SubgraphPage<TRow> {
  /** The decoded rows of this page. */
  rows: TRow[];
  /** `true` when the page is full, so another page may exist. */
  hasMore: boolean;
}

/** {@link SubgraphPageParameters} with every default applied. */
export interface ResolvedSubgraphPage {
  first: number;
  skip: number;
  orderBy: "timestamp" | "id";
  orderDirection: "asc" | "desc";
}

/**
 * Apply the paging defaults and validate `first`.
 *
 * @param parameters - The caller's paging parameters.
 * @returns Paging values ready to send as query variables.
 * @throws {SymmError} (`kind: "validation"`) when `first` is not an integer in 1–1000
 *   or `skip` is negative.
 */
export function resolveSubgraphPage(parameters: SubgraphPageParameters): ResolvedSubgraphPage {
  const { first = SUBGRAPH_MAX_PAGE_SIZE, skip = 0, orderBy = "timestamp", orderDirection = "desc" } = parameters;
  if (!Number.isInteger(first) || first < 1 || first > SUBGRAPH_MAX_PAGE_SIZE) {
    throw new SymmError(
      "validation",
      "INVALID_SUBGRAPH_PAGE_SIZE",
      `first must be an integer from 1 to ${SUBGRAPH_MAX_PAGE_SIZE}; received ${first}.`,
    );
  }
  if (!Number.isInteger(skip) || skip < 0) {
    throw new SymmError(
      "validation",
      "INVALID_SUBGRAPH_SKIP",
      `skip must be a non-negative integer; received ${skip}.`,
    );
  }
  return { first, skip, orderBy, orderDirection };
}

/**
 * Wrap decoded rows as a {@link SubgraphPage}.
 *
 * @param rows - The decoded rows.
 * @param first - The page size that was requested.
 * @returns The page, with `hasMore` set when it came back full.
 */
export function toSubgraphPage<TRow>(rows: TRow[], first: number): SubgraphPage<TRow> {
  return { rows, hasMore: rows.length === first };
}

/**
 * Drop every `undefined` entry from a `where` object.
 *
 * Graph-node does not ignore a `null` filter (`symbolId_in: null` fails with
 * "Non-list value passed to `_in` filter"), so a filter the caller left out must
 * be absent from the object, not sent empty. This is what makes every filter
 * optional and applied only when passed.
 *
 * @param where - A `where` object whose omitted filters are `undefined`.
 * @returns The same object without its `undefined` keys.
 */
export function compactWhere<TWhere extends Record<string, unknown>>(where: TWhere): TWhere {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (value !== undefined) result[key] = value;
  }
  return result as TWhere;
}

/**
 * Whether any list filter was passed as an empty array. An empty list matches
 * nothing, so a read short-circuits to an empty page without a request.
 *
 * @param filters - The list filters, `undefined` when omitted.
 * @returns `true` when at least one filter is an empty array.
 */
export function hasEmptyListFilter(...filters: readonly (readonly unknown[] | undefined)[]): boolean {
  return filters.some((filter) => filter !== undefined && filter.length === 0);
}

/**
 * Lowercase a list of addresses or hashes for a subgraph filter. The subgraph
 * stores `Bytes` lowercase, so a checksummed value would match nothing.
 *
 * @param values - Addresses or hashes, or `undefined` when the filter is omitted.
 * @returns The lowercased list, or `undefined`.
 */
export function lowercaseList(values: readonly string[] | undefined): string[] | undefined {
  return values?.map((value) => value.toLowerCase());
}

/**
 * Stringify a list of numeric ids for a `BigInt` subgraph filter.
 *
 * @param values - Ids, or `undefined` when the filter is omitted.
 * @returns The ids as decimal strings, or `undefined`.
 */
export function stringList(values: readonly (bigint | number)[] | undefined): string[] | undefined {
  return values?.map((value) => value.toString());
}
