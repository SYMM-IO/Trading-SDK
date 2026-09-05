import type { Address } from "viem";
import type { SolverId } from "../../core/chains";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { PositionStateResponseSchema } from "../../solvers/types/generated/rasa-solver";
import type { NotificationDocument, NotificationSearchFilter } from "../types";

/**
 * Parameters for {@link searchNotifications} — one shape for both solver kinds.
 * The common filters (`account`, `quoteId`, `tempQuoteId`, `timestampGte`) are
 * mapped to each kind's native query; `filter` is an enigma-only advanced
 * equality filter, and `baseUrl` overrides the enigma notification service host.
 *
 * `solverId` is a {@link SolverId}. Pass a **literal** kind to narrow the return
 * to that kind's result variant.
 */
export type SearchNotificationsParameters<K extends SolverId = SolverId> = Compute<
  ChainIdParameter & {
    /** Target solver — selects the search endpoint + result variant. Defaults to the chain's default solver. */
    solverId?: K;
    /** Filter: counterparty (subaccount) address. */
    account?: Address;
    /** Filter: on-chain quote id. */
    quoteId?: number;
    /** Filter: pre-chain temporary quote id (negative). Enigma only. */
    tempQuoteId?: number;
    /** Filter: created/emitted at or after this unix timestamp (seconds). Rasa only. */
    timestampGte?: number;
    /** Zero-based offset of the first row. Defaults to 0. */
    start?: number;
    /** Maximum rows to return. Defaults to the endpoint default. */
    size?: number;
    /**
     * Enigma-only advanced equality filter, merged over the mapped common
     * filters. Ignored for rasa (which has no free-form filter).
     */
    filter?: NotificationSearchFilter;
    /** Override the enigma notification-service base URL (defaults to the solver's `notifications.searchUrl`). */
    baseUrl?: string;
  }
>;

/**
 * A notification search result from an **enigma** solver — the standalone
 * notification service's stored documents.
 */
export interface EnigmaNotificationSearchResult {
  /** Discriminant: this page came from an enigma solver. */
  kind: "enigma";
  /** Total documents matching the filter, ignoring pagination (enigma service only). */
  total: number;
  /** Number of rows returned in this page. */
  count: number;
  /** The matched documents for the requested `start`/`size` window. */
  rows: NotificationDocument[];
}

/**
 * A notification search result from a **rasa** solver — the solver's own
 * position-state records (`POST /position-state/{start}/{size}`), which are the
 * rasa protocol's notification history.
 */
export interface RasaNotificationSearchResult {
  /** Discriminant: this page came from a rasa solver. */
  kind: "rasa";
  /** Total matching rows on the solver, for paging. */
  count: number;
  /** The matched position-state rows for the requested window. */
  rows: PositionStateResponseSchema[];
}

/**
 * Notification search result, normalized per solver kind. Discriminated on
 * `kind`; narrow to reach kind-specific fields (e.g. enigma's `total`).
 */
export type NotificationSearchResult = EnigmaNotificationSearchResult | RasaNotificationSearchResult;

/**
 * Maps each solver kind to its notification search result variant. Indexed by
 * the caller's `solverId` to narrow the {@link searchNotifications} return.
 */
export interface NotificationSearchResultByKind {
  enigma: EnigmaNotificationSearchResult;
  rasa: RasaNotificationSearchResult;
}

/** Return type of {@link searchNotifications}: `NotificationSearchResultByKind[K]`. */
export type SearchNotificationsReturnType<K extends SolverId = SolverId> = NotificationSearchResultByKind[K];
