/** The Solvers page's sections, by their headings. */
export type SolverSection = "Reads" | "Enigma-only reads" | "Rasa-only reads" | "Notifications" | "Writes";

/**
 * Search/display metadata for one Solvers-page method card. Pure data — no
 * components — so the command-palette search index can import it without pulling
 * card UI into its bundle.
 */
export interface SolverMethodMeta {
  /** Card `testId`, which is also its in-page anchor (`/solvers#<id>`). */
  id: string;
  /** Method name shown on the card (and the search title). */
  method: string;
  /** React SDK hook that backs the card (a search keyword). */
  action: string;
  /** Read/write — drives the search row badge to match the card. */
  kind: "read" | "write";
  /** The section heading the card sits under. */
  section: SolverSection;
  /** One line on what the card does, written for a search result. */
  summary: string;
  /** Secondary SDK symbols and terms the card also demonstrates, kept searchable. */
  aliases?: string[];
}

/**
 * Every Solvers-page method card, in display order. Single source of truth for
 * the command-palette search index. The {@link SolversShell} renders the cards
 * directly, so a card added there must also be listed here to be searchable —
 * `e2e/search-coverage.read.spec.ts` fails until it is.
 */
export const SOLVER_METHODS: readonly SolverMethodMeta[] = [
  {
    id: "method-getLockedParams",
    method: "getLockedParams",
    action: "useLockedParams",
    kind: "read",
    section: "Reads",
    summary: "The solver's locked params for one market and leverage.",
  },
  {
    id: "method-getNotionalCap",
    method: "getNotionalCapBySymbolId",
    action: "useNotionalCapBySymbolId",
    kind: "read",
    section: "Reads",
    summary: "A market's notional cap — the liquidity still available, in dollars.",
  },
  {
    id: "method-getOpenInterest",
    method: "getOpenInterestBySymbolId",
    action: "useOpenInterestBySymbolId",
    kind: "read",
    section: "Reads",
    summary: "One market's open interest and total cap.",
  },
  {
    id: "method-getFundingInfo",
    method: "getFundingInfo",
    action: "useFundingInfo",
    kind: "read",
    section: "Reads",
    summary: "Long and short funding rates, the next funding time and the epoch length.",
  },
  {
    id: "method-getMarketInfo",
    method: "getMarketInfo",
    action: "useMarketInfo",
    kind: "read",
    section: "Reads",
    summary: "Per-market volume and totals, with price and 24h change on Rasa.",
  },
  {
    id: "method-getMarkets",
    method: "getMarkets",
    action: "useMarkets",
    kind: "read",
    section: "Reads",
    summary: "Every tradable market the solver quotes.",
  },
  {
    id: "method-getInstantOpens",
    method: "getInstantOpens",
    action: "useInstantOpens",
    kind: "read",
    section: "Reads",
    summary: "A sub-account's pending instant-open orders.",
  },
  {
    id: "method-getSolverErrorCodes",
    method: "getSolverErrorCodes",
    action: "useSolverErrorCodes",
    kind: "read",
    section: "Reads",
    summary: "The solver's error codes, to explain a failed open or close.",
  },
  {
    id: "method-managedQuotes",
    method: "useManagedQuotes",
    action: "useManagedQuotes",
    kind: "read",
    section: "Reads",
    summary: "One quote feed from on-chain positions and pending instant orders.",
  },
  {
    id: "method-getNotionalCapAll",
    method: "getNotionalCapAll",
    action: "useNotionalCapAll",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Open interest and total cap across every market.",
  },
  {
    id: "method-getEstimatedPrice",
    method: "getEstimatedPrice",
    action: "useEstimatedPrice",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Simulate an open or close and see the fill price, without placing an order.",
  },
  {
    id: "method-getSymbols",
    method: "getSymbols",
    action: "useSymbols",
    kind: "read",
    section: "Enigma-only reads",
    summary: "The symbol catalogue: max leverage, per-side trading state and validity.",
  },
  {
    id: "method-getTradeVolume",
    method: "getTradeVolume",
    action: "useTradeVolume",
    kind: "read",
    section: "Enigma-only reads",
    summary: "A market's daily trade volume.",
  },
  {
    id: "method-getRevenueRecords",
    method: "getRevenueRecords",
    action: "useRevenueRecords",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Incremental revenue records per symbol.",
  },
  {
    id: "method-getSolverInfo",
    method: "getSolverInfo",
    action: "useSolverInfo",
    kind: "read",
    section: "Enigma-only reads",
    summary: "The solver's fixed instant open and close fees.",
  },
  {
    id: "method-rasa-balanceInfo",
    method: "getSolverBalanceInfo",
    action: "useSolverBalanceInfo",
    kind: "read",
    section: "Rasa-only reads",
    summary: "Solver-side balance info for one account.",
  },
  {
    id: "method-rasa-partyAUpnl",
    method: "getPartyAUpnl",
    action: "usePartyAUpnl",
    kind: "read",
    section: "Rasa-only reads",
    summary: "A partyA's unrealized PnL.",
  },
  {
    id: "method-rasa-openInterest",
    method: "getSolverOpenInterest",
    action: "useSolverOpenInterest",
    kind: "read",
    section: "Rasa-only reads",
    summary: "Solver-wide open interest: the total cap and how much is used.",
  },
  {
    id: "method-rasa-priceRange",
    method: "getSolverPriceRange",
    action: "useSolverPriceRange",
    kind: "read",
    section: "Rasa-only reads",
    summary: "The lowest and highest acceptable prices for one symbol.",
  },
  {
    id: "method-rasa-errorMessage",
    method: "getErrorMessage",
    action: "useErrorMessage",
    kind: "read",
    section: "Rasa-only reads",
    summary: "Resolve one solver error code to its message.",
  },
  {
    id: "method-rasa-readiness",
    method: "getSolverReadiness",
    action: "useSolverReadiness",
    kind: "read",
    section: "Rasa-only reads",
    summary: "Whether the solver is available.",
  },
  {
    id: "method-watchNotifications",
    method: "Subscription",
    action: "useNotifications",
    kind: "read",
    section: "Notifications",
    summary: "Subscribe to a sub-account's live notifications and follow them in the live log.",
    aliases: ["watchNotifications", "live notifications", "Live log", "websocket"],
  },
  {
    id: "method-searchNotifications",
    method: "Search notifications",
    action: "useSearchNotifications",
    kind: "read",
    section: "Notifications",
    summary: "Search stored notifications by account, quote id or a custom filter.",
    aliases: ["searchNotifications"],
  },
  {
    id: "method-enigma-instant-open",
    method: "instantOpen",
    action: "useInstantOpen",
    kind: "write",
    section: "Writes",
    summary: "Open a lowcap position instantly through the InstantLayer.",
  },
  {
    id: "method-enigma-instant-close",
    method: "instantClose",
    action: "useInstantClose",
    kind: "write",
    section: "Writes",
    summary: "Close all or part of a lowcap instant position.",
  },
];
