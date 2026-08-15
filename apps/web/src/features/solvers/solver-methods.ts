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
}

/**
 * Every Solvers-page method card, in display order. Single source of truth for
 * the command-palette search index. The {@link SolversShell} renders the cards
 * directly, so a card added there must also be listed here to be searchable.
 */
export const SOLVER_METHODS: readonly SolverMethodMeta[] = [
  { id: "method-getLockedParams", method: "getLockedParams", action: "useLockedParams", kind: "read" },
  {
    id: "method-getNotionalCap",
    method: "getNotionalCapBySymbolId",
    action: "useNotionalCapBySymbolId",
    kind: "read",
  },
  { id: "method-getNotionalCapAll", method: "getNotionalCapAll", action: "useNotionalCapAll", kind: "read" },
  {
    id: "method-getOpenInterest",
    method: "getOpenInterestBySymbolId",
    action: "useOpenInterestBySymbolId",
    kind: "read",
  },
  { id: "method-getFundingInfo", method: "getFundingInfo", action: "useFundingInfo", kind: "read" },
  { id: "method-getEstimatedPrice", method: "getEstimatedPrice", action: "useEstimatedPrice", kind: "read" },
  { id: "method-getMarketInfo", method: "getMarketInfo", action: "useMarketInfo", kind: "read" },
  { id: "method-getMarkets", method: "getMarkets", action: "useMarkets", kind: "read" },
  { id: "method-getInstantOpens", method: "getInstantOpens", action: "useInstantOpens", kind: "read" },
  { id: "method-getSolverErrorCodes", method: "getSolverErrorCodes", action: "useSolverErrorCodes", kind: "read" },
  { id: "method-managedQuotes", method: "useManagedQuotes", action: "useManagedQuotes", kind: "read" },
  { id: "method-rasa-balanceInfo", method: "getSolverBalanceInfo", action: "useSolverBalanceInfo", kind: "read" },
  { id: "method-rasa-partyAUpnl", method: "getPartyAUpnl", action: "usePartyAUpnl", kind: "read" },
  { id: "method-rasa-openInterest", method: "getSolverOpenInterest", action: "useSolverOpenInterest", kind: "read" },
  { id: "method-rasa-priceRange", method: "getSolverPriceRange", action: "useSolverPriceRange", kind: "read" },
  { id: "method-rasa-errorMessage", method: "getErrorMessage", action: "useErrorMessage", kind: "read" },
  { id: "method-rasa-readiness", method: "getSolverReadiness", action: "useSolverReadiness", kind: "read" },
  { id: "method-searchNotifications", method: "searchNotifications", action: "useSearchNotifications", kind: "read" },
  { id: "method-enigma-instant-open", method: "instantOpen", action: "useInstantOpen", kind: "write" },
  { id: "method-enigma-instant-close", method: "instantClose", action: "useInstantClose", kind: "write" },
  {
    id: "method-rasa-whitelist",
    method: "checkSolverWhitelist / addSolverWhitelist",
    action: "useAddSolverWhitelist",
    kind: "write",
  },
];
