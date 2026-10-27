import type { Config } from "../../core/config";
import { closeTypeToEventTypes, LIQUIDATION_EVENT_TYPES } from "../../quotes/get-quote-history/close-type";
import { toQuoteHistoryRow } from "../../quotes/get-quote-history/to-history-row";
import { QuoteCloseType, type QuoteHistoryRow } from "../../quotes/get-quote-history/types";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import type {
  PoolQuoteEventsQuery,
  PoolQuoteEventsQueryVariables,
} from "../../symmio-subgraph/types/generated/analytics/graphql";
import { toPoolQuote } from "../quotes/to-pool-quote";
import { resolvePoolSource } from "../resolve-pool-source";
import type { PoolQuote } from "../types";
import { calculateHistoryMetrics } from "./calculate-history-metrics";
import { PoolQuoteEventsDocument } from "./query-document";

/** Page size when the caller does not specify one. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Parameters for {@link getPoolTradeHistory}.
 */
export type GetPoolTradeHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The pool's solver market id. A pool with no `symbolId` is not tradable and
     * has no history — the action short-circuits to an empty result.
     */
    symbolId: number | null | undefined;
    /** Close-type filter. @default QuoteCloseType.All */
    closeType?: QuoteCloseType;
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the event timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getPoolTradeHistory}. */
export interface GetPoolTradeHistoryReturnType {
  /** The decoded, snapshot-applied history rows (one per close/liquidation event). */
  rows: PoolTradeHistoryRow[];
  /** Full quote fields with each event snapshot applied, aligned with rows. */
  quotes: PoolQuote[];
}

/** One immutable close event with derived 18-decimal amounts. Missing calculation inputs yield null. */
export interface PoolTradeHistoryRow extends QuoteHistoryRow {
  /** This event's closed/liquidated quantity, otherwise the available quote quantity. */
  closeQuantity: bigint | null;
  /** Event execution price; liquidation uses its own price rather than an earlier average close. */
  closePrice: bigint | null;
  /** Event quantity times execution price, in collateral units. */
  tradeValue: bigint | null;
  /** Opening-fee share attributed to this event's quantity, floored independently per row. */
  openFee: bigint | null;
  /** Event closing fee; zero for liquidation, charged for normal, force, emergency and ADL closes. */
  closeFee: bigint | null;
  /** openFee + closeFee; excludes solver, funding and liquidation fees. */
  platformFee: bigint | null;
  /** Gross realized PnL before fees, from the shared quote primitive. */
  realizedPnl: bigint | null;
}

/**
 * Read a **pool's** realized trade history from the analytics subgraph.
 *
 * The pool-scoped counterpart to `getQuoteHistory`: that one filters by the
 * accounts you pass, this one filters by the market and the SYMMIO diamond the
 * quotes were opened against, with no account clause at all. The result is every
 * trader's closes on this pool, which is what a pool page shows.
 *
 * Rows come from the immutable `quoteEvents` collection with each event's frozen
 * `metadata` snapshot overlaid, so a quote closed across several partial closes
 * yields several individually-accurate rows rather than repeating its final
 * state.
 *
 * @param config - The SDK config.
 * @param parameters - The pool's `symbolId`, optional close-type filter, paging and sort.
 * @returns The history rows; empty when `symbolId` is absent.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getPoolTradeHistory(config, { symbolId: 1, first: 25 });
 * ```
 */
export async function getPoolTradeHistory(
  config: Config,
  parameters: GetPoolTradeHistoryParameters,
): Promise<GetPoolTradeHistoryReturnType> {
  const {
    chainId,
    symbolId,
    closeType = QuoteCloseType.All,
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (symbolId === null || symbolId === undefined) return { rows: [], quotes: [] };

  const data = await querySubgraph<PoolQuoteEventsQuery, PoolQuoteEventsQueryVariables>(config, {
    chainId,
    document: PoolQuoteEventsDocument,
    variables: {
      typeIn: closeTypeToEventTypes[closeType] as string[],
      symbolId: String(symbolId),
      source: resolvePoolSource(config, chainId),
      first,
      skip,
      orderDirection,
    },
  });

  const rows = (data.quoteEvents ?? []).map(toQuoteHistoryRow);
  const quotes = (data.quoteEvents ?? []).map((event, index) => {
    const snapshot = rows[index]!;
    const quote = toPoolQuote(event.quote);
    let metadata: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(event.metadata ?? "{}");
      if (parsed && typeof parsed === "object") metadata = parsed as Record<string, unknown>;
    } catch {
      /* Missing snapshot keeps the nullable quote fields. */
    }
    const amount = snapshotWei(metadata.amount);
    const closePrice = snapshotWei(metadata.closePrice);
    const isLiquidation = LIQUIDATION_EVENT_TYPES.has(snapshot.closeEventType);
    return {
      ...quote,
      quoteStatus: snapshot.quoteStatus,
      openedPrice: snapshotWei(metadata.openedPrice) ?? quote.openedPrice,
      closedAmount: amount ?? quote.closedAmount,
      quantityToClose: amount ?? quote.quantityToClose,
      averageClosedPrice: closePrice ?? quote.averageClosedPrice,
      liquidateAmount: (isLiquidation ? amount : null) ?? quote.liquidateAmount,
      liquidatePrice: (isLiquidation ? closePrice : null) ?? quote.liquidatePrice,
    };
  });
  return { rows: rows.map((row, index) => ({ ...row, ...calculateHistoryMetrics(quotes[index]!) })), quotes };
}

function snapshotWei(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  try {
    const amount = BigInt(value);
    return amount >= 0n ? amount : null;
  } catch {
    return null;
  }
}
