import { getQuoteHistory, QuoteCloseType, type QuoteHistoryRow } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

/** Rows rendered per page. */
export const HISTORY_PAGE_SIZE = 12;

/**
 * One row more than we render. The subgraph reports no total count, so the only
 * way to answer "is there a next page?" is to ask for one extra row and see
 * whether it comes back.
 */
const FETCH_SIZE = HISTORY_PAGE_SIZE + 1;

/** History is immutable once written; a slow poll is enough to catch new closes. */
const REFETCH_INTERVAL = 20_000;

export interface QuoteHistoryPage {
  /** The rows for this page, newest close first. */
  rows: QuoteHistoryRow[];
  /** Whether a further page exists (derived from the look-ahead row). */
  hasNextPage: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

export interface UseQuoteHistoryParameters {
  /** One-based page number. */
  page: number;
  /** Which terminal events to return. */
  closeType: QuoteCloseType;
}

/**
 * One page of the active sub-account's closed / liquidated quote history, read
 * from the analytics subgraph. Each row is a single terminal event with its
 * frozen `metadata` snapshot already applied by the SDK, so a quote closed over
 * several partial closes yields several individually accurate rows — key them by
 * `eventId`, never by `quoteId`.
 *
 * Filtering, sorting (`timestamp` desc) and pagination are all server-side.
 */
export function useQuoteHistory({ page, closeType }: UseQuoteHistoryParameters): QuoteHistoryPage {
  const { config, chainId } = useSdkScope();
  const { subAccount, subAccountDetail } = useSubAccount();

  const query = useQuery({
    queryKey: ["quote-history", chainId, subAccount, subAccountDetail?.isolationType, closeType, page],
    enabled: Boolean(subAccount),
    refetchInterval: REFETCH_INTERVAL,
    /**
     * Keep the current rows on screen while the next **page** loads, but only
     * then. This fires on any key change, so an unguarded `(previous) => previous`
     * would also hold the old rows across an account or filter change — showing
     * one account's trades under another's header, or `Closed` rows beneath a
     * `Liquidated` title, with no loading state (placeholder data counts as
     * success, so `isLoading` stays false).
     */
    placeholderData: (previous, previousQuery) => {
      const [, previousChainId, previousAccount, previousIsolationType, previousCloseType] = (previousQuery?.queryKey ??
        []) as [string, number | undefined, Address | undefined, number | undefined, QuoteCloseType | undefined];
      return previousChainId === chainId &&
        previousAccount === subAccount &&
        previousIsolationType === subAccountDetail?.isolationType &&
        previousCloseType === closeType
        ? previous
        : undefined;
    },
    queryFn: async (): Promise<QuoteHistoryRow[]> => {
      /**
       * The sub-account ONLY — never its Virtual Accounts. Unlike the on-chain
       * position reads (where a lowcap position's `partyA` IS its VA and the
       * fan-out is mandatory), the subgraph filters history on the quote's parent
       * `subAccount` field and carries the VA on `partyA`. Passing a VA here
       * matches nothing and silently returns zero rows.
       */
      const { rows } = await getQuoteHistory(config, {
        chainId,
        subAccounts: [subAccount as Address],
        isolationType: subAccountDetail?.isolationType,
        closeType,
        first: FETCH_SIZE,
        skip: (page - 1) * HISTORY_PAGE_SIZE,
      });
      return rows;
    },
  });

  const fetched = query.data ?? [];

  return {
    rows: fetched.slice(0, HISTORY_PAGE_SIZE),
    hasNextPage: fetched.length > HISTORY_PAGE_SIZE,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
