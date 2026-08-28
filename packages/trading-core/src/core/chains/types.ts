import type { Address } from "viem";

/**
 * Contract addresses for a SYMMIO chain deployment.
 */
export interface SymmioContractAddresses {
  /** Main SYMMIO diamond contract */
  symmioAddress: Address;
  /** InstantLayer contract for instant actions */
  instantLayerAddress: Address;
  /** AccountLayer contract for subaccount management */
  accountLayerAddress: Address;
  /** Affiliates registry contract */
  affiliatesAddress: Address;
  /** Collateral token address (e.g. USDC) */
  collateralAddress: Address;
  /** Decimals of the collateral token */
  collateralDecimals: number;
}

/**
 * Subgraph endpoints for a SYMMIO chain deployment.
 */
export interface SymmioSubgraphUrls {
  /** Analytics subgraph for aggregated data (balance changes, quotes, history). */
  analytics: string;
  /** Events subgraph for raw on-chain events (e.g. `internalTransfers`). */
  events: string;
}

/**
 * Name of a configured subgraph endpoint (a key of {@link SymmioSubgraphUrls}).
 *
 * Used to pick which subgraph an action queries (`"analytics"` | `"events"`); the
 * union grows automatically as endpoints are added.
 */
export type SymmioSubgraphName = keyof SymmioSubgraphUrls;

/**
 * A solver's id within a chain config — its registry key. Equal to its
 * {@link SymmioSolverKind}: each chain registers at most one solver per kind, so
 * the id *is* the kind (`"enigma" | "rasa"`). Closed for that reason.
 */
export type SolverId = SymmioSolverKind;

/**
 * The solver kinds the SDK can actually serve — one generated client and
 * behavior set per entry. Single source of truth: {@link SymmioSolverKind} is
 * derived from this list, and `createConfig` validates every configured solver
 * against it (`assertSupportedSolver` in `solver-support.ts`). To add a kind,
 * append it here and ship its generated client + dispatch in the same change.
 *
 * @internal
 */
export const SUPPORTED_SOLVER_KINDS = ["enigma", "rasa"] as const;

/**
 * Schema family a solver's REST API speaks — the discriminant used to select a
 * generated client. Closed (derived from {@link SUPPORTED_SOLVER_KINDS}): the
 * SDK ships one client per kind, so dispatch must be exhaustive.
 *
 * There is deliberately no version axis: each SDK release supports exactly one
 * API generation per kind. When a solver ships a new API generation, the SDK
 * regenerates that kind's client in a new release — consumers pick the
 * generation by pinning the SDK version, not through config.
 */
export type SymmioSolverKind = (typeof SUPPORTED_SOLVER_KINDS)[number];

/**
 * Solver / hedger configuration for a SYMMIO chain deployment.
 *
 * In this SDK a "solver" is the same actor that fronts the lowcap hedger REST
 * API (`/instant_trade/instant_open`, `/contract-symbols`, …) and acts as
 * `partyB` on-chain. Its `url` is the API base URL, its `address` is partyB.
 *
 * Solvers live under {@link SymmioChainConfig.solvers}, keyed by
 * {@link SolverId} — the key is the solver's id, which is also its kind, so the
 * kind is not repeated here. `config.getSolver({ chainId, solverId })` returns a
 * {@link SymmioResolvedSolver} (this config plus its resolved `id`).
 */
/**
 * Per-solver capability flags. Gate SDK flows and UI on these so a solver that
 * lacks a feature degrades gracefully instead of erroring. Unset flags default
 * to `false` — a solver must **declare** a capability to enable it.
 */
export interface SolverCapabilitiesConfig {
  /**
   * Whether the solver supports closing a whole market + side group of quotes in
   * one flow. Enigma (Virtual-Account isolation, one VA per market + side)
   * supports it; rasa (cross-margin) does not. Default `false`.
   */
  groupClose?: boolean;
  /**
   * Whether the solver supports LIMIT orders — placing a pending open at a
   * user-set price. Majors (rasa) support it; enigma (lowcap) does not. Default
   * `false`.
   */
  limitOrder?: boolean;
  /**
   * Whether this solver's markets are the lowcap **Pools** (listing service).
   * Purely declarative: the SDK's listing functions resolve the listing backend
   * **at chain level** ({@link SymmioChainConfig.listing}) and do **not** gate on
   * this flag. It exists so config can express which solvers do listing, readable
   * via `getSolverCapabilities`. Enigma (lowcap) declares it; rasa does not.
   * Default `false`.
   */
  listingService?: boolean;
}

export interface SymmioSolverConfig {
  /** Human-readable solver name */
  name: string;
  /** Solver's on-chain address (used as `partyB` in `sendQuoteWithAffiliateAndData`) */
  address: Address;
  /** Solver / hedger API base URL */
  url: string;
  /** Optional TP/SL handler — solver supports conditional orders only when set. */
  tpsl?: SymmioTpSlConfig;
  /**
   * Price source for **this solver's** markets. Falls back to the chain's
   * {@link SymmioChainConfig.priceService} when omitted, so set it only where a
   * solver diverges from the chain default — do not duplicate the default.
   *
   * Needed because a chain may register several solvers that price differently:
   * a lowcap solver reads its own price service while a majors solver reads
   * Binance. A single chain-level value cannot be right for both.
   */
  priceService?: SymmioPriceServiceConfig;
  /**
   * Notifications endpoint for **this solver's** position/quote state stream and
   * history search. Required per solver: notifications are inherently
   * solver-specific — the enigma `channel` and the rasa position-state URL are
   * the solver's own — so there is no chain-level default to inherit.
   */
  notifications: SymmioNotificationsConfig;
  /**
   * Optional per-solver capability flags. Gate SDK flows and UI on these
   * ({@link SolverCapabilitiesConfig}); unset flags default to `false`.
   */
  capabilities?: SolverCapabilitiesConfig;
}

/**
 * A {@link SymmioSolverConfig} resolved from the registry, with its `id`
 * attached. The `id` is the solver's kind (`"enigma" | "rasa"`) and drives
 * per-kind dispatch inside solver actions. Returned by `config.getSolver`.
 */
export interface SymmioResolvedSolver extends SymmioSolverConfig {
  /** The resolved solver id — equal to its kind. */
  id: SolverId;
}

/**
 * TP/SL (Conditional Order Handler) configuration for a solver.
 *
 * The handler is an off-chain service that signs and executes
 * `requestToClosePosition` calls when the user's TP/SL trigger fires. To
 * authorize it, every user must grant a delegation to {@link cohWalletAddress}
 * for the standard instant-trade selectors.
 */
export interface SymmioTpSlConfig {
  /** Handler REST root URL (no `/api/v5/` suffix — orval-generated paths add it). */
  url: string;
  /** Handler WebSocket URL — enigma-protocol notifications scoped by `appName`. */
  wsUrl: string;
  /** `App-Name` header value, e.g. `Hyper-EVM_COH-Low-Cap_Production`. */
  appName: string;
  /** COH wallet address that must be granted delegation to execute TP/SL orders. */
  cohWalletAddress: Address;
}

/**
 * The price providers the SDK ships a client for. Closed: it drives exhaustive
 * dispatch in `getMarkPrices` / `watchPrices`, and `createConfig` validates every
 * configured price service against it (`assertSupportedPriceServiceType` in
 * `price-service-support.ts`). To add a provider, append it here and ship its
 * adapter + dispatch in the same change.
 *
 * @internal
 */
export const SUPPORTED_PRICE_SERVICE_TYPES = ["enigma", "binance"] as const;

/**
 * Supported price-service providers.
 *
 * A **second, independent axis** from {@link SymmioSolverKind}: a Rasa solver is
 * priced off Binance today, and nothing in the type system ties the two
 * together. The provider is *derived* from `{ chainId, solverId }` via
 * `solver.priceService ?? chain.priceService` — never selected per call.
 */
export type SymmioPriceServiceType = (typeof SUPPORTED_PRICE_SERVICE_TYPES)[number];

/**
 * Price-service configuration for a SYMMIO chain deployment.
 *
 * Both URLs stay **required, including for Binance**. Binance's endpoints are
 * public constants, but keeping them in config is the geo-restriction escape
 * hatch: an integrator whose users are in a blocked region repoints both at
 * their own proxy with no SDK change.
 */
export interface SymmioPriceServiceConfig {
  /** Price-service provider type. Selects which client the SDK uses. */
  type: SymmioPriceServiceType;
  /**
   * REST host root, no trailing slash — the client appends the provider's path.
   * `enigma`: `https://lowcap-price.enigma.bz` (+ `/api/v1/prices/names`).
   * `binance`: `https://fapi.binance.com` (+ `/fapi/v1/premiumIndex`).
   */
  url: string;
  /**
   * **Full** WebSocket endpoint — the exact URL the SDK dials, identically for
   * every provider, so nothing downstream needs to know which provider it holds.
   * `enigma`: `wss://lowcap-price.enigma.bz/ws`.
   * `binance`: `wss://fstream.binance.com/market/ws/!markPrice@arr@1s`.
   */
  wsUrl: string;
}

/**
 * Wire protocol a notifications endpoint speaks. Closed: it drives exhaustive
 * dispatch in `watchNotifications` / `parseNotificationFrame`; to add a
 * protocol, append it here and ship its subscribe + parse path in the same
 * change.
 *
 * - `enigma` — the lowcap solver endpoint (`…/ws/v1/subscribe`). Subscribes
 *   with a `channel_patterns` frame and wraps each push as `{ data, address }`.
 * - `rasa` — the Rasa position-state endpoint (`…/ws/position-state-ws3`).
 *   Subscribes with an `{ address: [...] }` frame (one socket can carry many
 *   SubAccounts) and pushes bare notification frames, no envelope.
 */
export type SymmioNotificationsProtocol = "enigma" | "rasa";

/**
 * Fields every notifications endpoint shares, regardless of wire protocol.
 */
interface SymmioNotificationsConfigBase {
  /** Notifications WebSocket URL (`wss://…`). */
  url: string;
  /**
   * Base URL of the notification REST service that backs `searchNotifications`
   * (`POST /api/v1/search`), e.g. `https://notification.rasa.capital/notification`.
   * Optional — when unset, `searchNotifications` requires a per-call `baseUrl`.
   */
  searchUrl?: string;
}

/**
 * Notifications endpoint speaking the `enigma` protocol (the lowcap
 * solver's channel-scoped stream).
 */
export interface SymmioEnigmaNotificationsConfig extends SymmioNotificationsConfigBase {
  /** Wire protocol the endpoint speaks. */
  protocol: "enigma";
  /** Channel / `app_name` the subscribe frame targets on this endpoint. */
  channel: string;
}

/**
 * Notifications endpoint speaking the `rasa` position-state protocol. No
 * channel — the subscribe frame is just the watched SubAccount addresses.
 */
export interface SymmioRasaNotificationsConfig extends SymmioNotificationsConfigBase {
  /** Wire protocol the endpoint speaks. */
  protocol: "rasa";
}

/**
 * Notifications WebSocket configuration for a SYMMIO chain deployment.
 *
 * The notifications endpoint streams position/quote state transitions (instant
 * open/close confirmations, fills, cancels, liquidations) for a SubAccount. It
 * is a push channel, not a REST endpoint — `url` is a `ws://`/`wss://` URL.
 * Discriminated on `protocol`; narrow to reach protocol-specific fields
 * (e.g. the enigma `channel`).
 */
export type SymmioNotificationsConfig = SymmioEnigmaNotificationsConfig | SymmioRasaNotificationsConfig;

/**
 * Muon oracle configuration for a SYMMIO chain deployment.
 *
 * The Muon network signs off-chain values (e.g. a party's unrealized PnL) that
 * the contracts verify on-chain — `removeMargin` requires such a signature. The
 * gateway is a query-param REST endpoint with no OpenAPI spec; `urls` are tried
 * in order until one returns a successful attestation.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
export interface SymmioMuonConfig {
  /** Muon oracle gateway base URLs, tried in order (fallback on failure). */
  urls: readonly string[];
}

/**
 * Pools **listing backend** configuration for a SYMMIO chain deployment.
 *
 * The listing backend is an auth'd REST service that owns the lowcap Pools flow
 * — the pool catalogue, per-pool stats, a user's stake/rewards, and the
 * create/deposit/withdraw/claim actions. It is chain-level: one listing backend
 * is served per chain (a chain has at most one), with no solver or capability
 * involved. Present only where Pools is available (Enigma on HyperEVM); omitted
 * elsewhere.
 *
 * One deployment serves listings whose collateral was deposited on **several**
 * chains — a catalogue row's `chainId` is the token's deposit chain, which is
 * not the chain the resulting market trades on.
 */
export interface SymmioListingConfig {
  /**
   * Listing backend **host root** — no version segment and no trailing slash
   * (e.g. `https://listing85.enigma.bz`, staging
   * `https://listing-staging.enigma.bz`).
   *
   * The generated client's own paths already begin with `/v2`, so a versioned
   * base URL here would request `/v2/v2/market/search` and 404. Point this at
   * staging with a `createConfig` override — there is no separate environment
   * axis.
   */
  url: string;
}

/**
 * Inventory-service configuration for a SYMMIO chain deployment.
 *
 * The inventory service is the custody backend behind the lowcap Pools: it holds
 * the per-market token and collateral inventory that backs trading, and reports
 * the system-wide TVL those balances add up to. It is a **separate vendor** from
 * both the solver and the {@link SymmioListingConfig} listing backend, with its
 * own deployment and its own OpenAPI spec.
 *
 * Chain-level and optional, like `listing`: present where lowcap Pools are
 * available, omitted elsewhere.
 */
export interface SymmioInventoryConfig {
  /**
   * Inventory service **host root** — no path segment and no trailing slash
   * (e.g. `https://inventory85.enigma.bz`, staging
   * `https://inventory-staging.enigma.bz`).
   *
   * The generated client's own paths already begin with `/api/v1`, so appending
   * `/api` here would request `/api/api/v1/...` and 404.
   */
  url: string;
}

/**
 * Complete resolved configuration for a SYMMIO chain deployment.
 */
export interface SymmioChainConfig {
  /** Chain ID */
  chainId: number;
  /** Contract addresses */
  addresses: SymmioContractAddresses;
  /** Subgraph endpoints */
  subgraphs: SymmioSubgraphUrls;
  /**
   * Solvers available on this chain, keyed by {@link SolverId} (which is the
   * solver's kind). A chain registers a subset of the kinds, so this is partial.
   * Resolve one with `config.getSolver({ chainId, solverId })`, which defaults to
   * {@link defaultSolverId} when `solverId` is omitted.
   */
  solvers: Partial<Record<SolverId, SymmioSolverConfig>>;
  /** Id of the solver an action targets on this chain when `solverId` is omitted. */
  defaultSolverId: SolverId;
  /** Price-service configuration */
  priceService: SymmioPriceServiceConfig;
  /** Muon oracle configuration */
  muon: SymmioMuonConfig;
  /**
   * Optional Pools listing backend, served per chain. Set on chains where the
   * lowcap Pools flow is available (Enigma on HyperEVM); omitted elsewhere.
   * Resolve it with `resolveListingService` / gate on `supportsListingService`.
   */
  listing?: SymmioListingConfig;
  /**
   * Optional inventory service — the custody backend behind lowcap Pools, and
   * the source of system-wide TVL. Set alongside {@link SymmioChainConfig.listing};
   * resolve it with `resolveInventoryService`.
   */
  inventory?: SymmioInventoryConfig;
}
