import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { QuoteTpSlRow } from "../get-quote-tpsl";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import {
  ConditionalOrdersState,
  searchConditionalOrdersV5ApiV5SearchPost,
  type ConditionalOrderSearchRequestSchemaV3,
  type ConditionalOrderType,
  type PriceActionType,
} from "../types/generated/tpsl-handler";

/**
 * The row states that represent an order the handler still holds.
 *
 * Exactly the set {@link QuoteTpSlRow} consumers treat as actionable —
 * `canceled` and `killed` are terminal and carry no live order. Passing this as
 * the search filter keeps "absent from the result" equivalent to "no live
 * order", which is what makes a cancel confirmable from a search response.
 */
export const TPSL_LIVE_ORDER_STATES = [
  ConditionalOrdersState.pending,
  ConditionalOrdersState.new,
  ConditionalOrdersState.triggered,
  ConditionalOrdersState.triggered_pending,
] as const;

/** Default page size. The handler's own default is 100; a position's legs fit well inside this. */
const DEFAULT_SEARCH_SIZE = 200;

/** Parameters for {@link searchTpSlOrders}. */
export type SearchTpSlOrdersParameters = Compute<
  ChainIdParameter & {
    /**
     * Account whose conditional orders to search — the Virtual Account that
     * owns them, which is what the handler stores as `party_a_address`.
     */
    account: Address;
    /** Row states to include. Defaults to {@link TPSL_LIVE_ORDER_STATES}. */
    state?: readonly QuoteTpSlRowStateFilter[];
    /** Restrict to one market. */
    symbolId?: number;
    /** Restrict to one side. */
    conditionalOrderType?: ConditionalOrderType;
    /** Restrict to one trigger-price source. */
    conditionalPriceType?: PriceActionType;
    /** Page offset. Defaults to `0`. */
    start?: number;
    /** Page size. Defaults to `200`. */
    size?: number;
    /**
     * Abort the request after this many milliseconds. Unset means axios's
     * default of "wait forever" — pass one when the call is on a repeating
     * schedule, so a stalled connection fails the attempt instead of hanging it.
     */
    timeoutMs?: number;
  }
>;

/** A state accepted by the search filter. */
type QuoteTpSlRowStateFilter = ConditionalOrderSearchRequestSchemaV3["state"] extends
  | (infer TState)[]
  | null
  | undefined
  ? TState
  : never;

/** Return type of {@link searchTpSlOrders}. */
export interface SearchTpSlOrdersReturnType {
  /** The page's rows, in handler order. */
  orders: QuoteTpSlRow[];
  /** The handler's reported total for the filter. Advisory — see `isComplete`. */
  count: number;
  /**
   * `true` when this page provably exhausted the filtered result set, i.e.
   * fewer rows came back than were asked for.
   *
   * Derived from the page length rather than from `count`, whose meaning on
   * this endpoint is unverified and whose sibling `GET` already contradicts its
   * own spec. A caller may only read "this order is absent, therefore it is
   * gone" from a complete page; on an incomplete one, absence means nothing.
   */
  isComplete: boolean;
}

/**
 * Search one account's conditional orders at the TP/SL handler.
 *
 * Hits `POST /api/v5/search/`. Unlike {@link getQuoteTpSl}, which reads one
 * quote, this returns every matching order for an account in a single request —
 * so a merged position's legs cost one call rather than one call per leg.
 *
 * Returns the raw rows; framework layers fold them into UI-facing snapshots.
 *
 * @param config - The SDK config.
 * @param parameters - The account to search, plus optional filters and paging.
 * @returns The page's rows, the handler's count, and whether the page is complete.
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 *
 * @example
 * ```ts
 * const { orders, isComplete } = await searchTpSlOrders(config, { account: virtualAccount });
 * const live = orders.filter((order) => order.quote_id === Number(quoteId));
 * ```
 */
export async function searchTpSlOrders(
  config: Config,
  parameters: SearchTpSlOrdersParameters,
): Promise<SearchTpSlOrdersReturnType> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  const size = parameters.size ?? DEFAULT_SEARCH_SIZE;
  const body: ConditionalOrderSearchRequestSchemaV3 = {
    party_a_address: parameters.account,
    state: [...(parameters.state ?? TPSL_LIVE_ORDER_STATES)],
    start: parameters.start ?? 0,
    size,
  };
  if (parameters.symbolId !== undefined) body.symbol_id = parameters.symbolId;
  if (parameters.conditionalOrderType !== undefined) body.conditional_order_type = parameters.conditionalOrderType;
  if (parameters.conditionalPriceType !== undefined) body.conditional_price_type = parameters.conditionalPriceType;

  try {
    const response = await searchConditionalOrdersV5ApiV5SearchPost(body, {
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, "Content-Type": "application/json", Accept: "application/json" },
      ...(parameters.timeoutMs === undefined ? {} : { timeout: parameters.timeoutMs }),
    });
    return toSearchResult(response.data, size);
  } catch (err) {
    return rethrowTpSlError(err, { code: "SEARCH_TPSL_FAILED", baseURL: tpsl.url });
  }
}

/**
 * Normalize the response body.
 *
 * The live endpoint answers `{ data, count }`, but its sibling `GET` returns a
 * bare array against the same spec, so both shapes are accepted rather than
 * assumed — reading the wrong one would silently yield an empty page, which a
 * caller cannot distinguish from "this account has no orders".
 */
function toSearchResult(body: unknown, size: number): SearchTpSlOrdersReturnType {
  const orders = (Array.isArray(body) ? body : ((body as { data?: unknown })?.data ?? [])) as QuoteTpSlRow[];
  const reported = Array.isArray(body) ? undefined : (body as { count?: unknown })?.count;
  return {
    orders,
    count: typeof reported === "number" ? reported : orders.length,
    isComplete: orders.length < size,
  };
}
