/** A flow of the integration console — its tab value, and its `?flow=` URL value. */
export type IntegrationFlowId =
  | "setup"
  | "deposit"
  | "withdraw"
  | "instant-open"
  | "instant-close"
  | "close-all"
  | "tpsl"
  | "cancel-limit"
  | "cancel-close";

/**
 * One flow of the integration console. Pure data — no components — so the
 * command-palette index can list the flows without pulling the flows' UI into
 * the header's bundle.
 */
export interface IntegrationFlowMeta {
  id: IntegrationFlowId;
  /** The tab label, which is also the search title. */
  label: string;
  /** One line on what the flow does, written for a search result. */
  summary: string;
  /** SDK hooks the flow is built from, plus other terms worth matching. */
  keywords: readonly string[];
}

/** The console's DOM id — the anchor a flow search hit lands on. */
export const INTEGRATION_CONSOLE_ID = "integration-console";

/**
 * A flow's command-palette entry id. The console lists the ids of the flows it
 * currently offers in `data-search-entries`, so the palette's "On this page"
 * leaves out a flow this solver does not run.
 */
export function flowSearchEntryId(flow: IntegrationFlowId): string {
  return `flow:${flow}`;
}

/**
 * The flows, grouped as the switcher groups them: setup gets the account into a
 * state where anything else can run, collateral moves in and out of a
 * subaccount, position flows act on an open position, and cancel flows retract
 * a request that has not settled yet. The console offers the cancel group only
 * on solvers that support LIMIT orders.
 */
export const INTEGRATION_FLOW_GROUPS = {
  setup: [
    {
      id: "setup",
      label: "Setup",
      summary: "Get an account ready to trade: a funded sub-account, with or without a relayer or session key.",
      keywords: [
        "useUserSubAccounts",
        "useApproveCollateral",
        "useDepositAndAllocate",
        "useSessionKeyDelegation",
        "useOperationalFeeAllowance",
        "onboarding",
        "get started",
      ],
    },
  ],
  collateral: [
    {
      id: "deposit",
      label: "Deposit",
      summary: "Approve collateral and fund a sub-account, allocating it as margin if you choose.",
      keywords: ["useDeposit", "useDepositAndAllocate", "useApproveCollateral", "fund", "collateral"],
    },
    {
      id: "withdraw",
      label: "Withdraw",
      summary: "Request a withdrawal, wait out the cooldown, then finalize or cancel it.",
      keywords: ["useWithdraw", "useFinalizeWithdrawRequest", "useRequestCancelWithdraw", "usePendingWithdrawRequests"],
    },
  ],
  position: [
    {
      id: "instant-open",
      label: "Instant Open",
      summary: "Open a position instantly, with fees previewed before you sign.",
      keywords: ["useInstantOpenFees", "useInstantCloseFees", "useGrantDelegation", "open position", "trade"],
    },
    {
      id: "instant-close",
      label: "Instant Close",
      summary: "Close one position, or a group of them, instantly.",
      keywords: ["usePartyAOpenPositions", "useGroupedQuotes", "useSupportsGroupClose", "close position"],
    },
    {
      id: "close-all",
      label: "Close All",
      summary: "Exit every open position at once.",
      keywords: ["useInstantCloseBulkAuto", "useAggregatedPositions", "bulk close"],
    },
    {
      id: "tpsl",
      label: "TP/SL",
      summary: "Set or remove a position's take-profit and stop-loss.",
      keywords: ["useSetQuoteTpSl", "useDeleteQuoteTpSl", "useQuoteTpSl", "take profit", "stop loss"],
    },
  ],
  cancel: [
    {
      id: "cancel-limit",
      label: "Cancel Limit",
      summary: "Cancel a resting limit order, on solvers that take limit orders.",
      keywords: ["useRequestToCancelQuote", "useForceCancelQuote", "useLimitOrders", "limit order"],
    },
    {
      id: "cancel-close",
      label: "Cancel Close",
      summary: "Cancel a pending close request, or force-close, on solvers that take limit orders.",
      keywords: ["useRequestToCancelCloseRequest", "useForceCancelCloseRequest", "useForceClose", "close request"],
    },
  ],
} as const satisfies Record<string, readonly IntegrationFlowMeta[]>;

/** Every flow, in switcher order. */
export const INTEGRATION_FLOWS: readonly IntegrationFlowMeta[] = Object.values(INTEGRATION_FLOW_GROUPS).flat();

/** Read a `?flow=` value as a flow id; anything else is `undefined`. */
export function toIntegrationFlowId(value: string | null): IntegrationFlowId | undefined {
  return INTEGRATION_FLOWS.find((flow) => flow.id === value)?.id;
}
