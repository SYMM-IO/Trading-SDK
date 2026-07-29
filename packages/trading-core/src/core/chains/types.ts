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
export interface SymmioSolverConfig {
  /** Human-readable solver name */
  name: string;
  /** Solver's on-chain address (used as `partyB` in `sendQuoteWithAffiliateAndData`) */
  address: Address;
  /** Solver / hedger API base URL */
  url: string;
  /** Optional TP/SL handler — solver supports conditional orders only when set. */
  tpsl?: SymmioTpSlConfig;
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
  /** Handler WebSocket URL — defilytics-protocol notifications scoped by `appName`. */
  wsUrl: string;
  /** `App-Name` header value, e.g. `Hyper-EVM_COH-Low-Cap_Production`. */
  appName: string;
  /** COH wallet address that must be granted delegation to execute TP/SL orders. */
  cohWalletAddress: Address;
}

/**
 * Supported price-service providers.
 */
export type SymmioPriceServiceType = "enigma";

/**
 * Price-service configuration for a SYMMIO chain deployment.
 */
export interface SymmioPriceServiceConfig {
  /** Price-service provider type */
  type: SymmioPriceServiceType;
  /** Price-service API base URL */
  url: string;
  /** WebSocket URL for live mark-price broadcasts. */
  wsUrl: string;
}

/**
 * Wire protocol a notifications endpoint speaks.
 *
 * - `defilytics` — the lowcap solver endpoint (`…/ws/v1/subscribe`). Subscribes
 *   with a `channel_patterns` frame and wraps each push as `{ data, address }`.
 */
export type SymmioNotificationsProtocol = "defilytics";

/**
 * Notifications WebSocket configuration for a SYMMIO chain deployment.
 *
 * The notifications endpoint streams position/quote state transitions (instant
 * open/close confirmations, fills, cancels, liquidations) for a SubAccount. It
 * is a push channel, not a REST endpoint — `url` is a `ws://`/`wss://` URL.
 */
export interface SymmioNotificationsConfig {
  /** Notifications WebSocket URL (`wss://…`). */
  url: string;
  /** Channel / `app_name` the subscribe frame targets on this endpoint. */
  channel: string;
  /** Wire protocol the endpoint speaks. */
  protocol: SymmioNotificationsProtocol;
  /**
   * Base URL of the notification REST service that backs `searchNotifications`
   * (`POST /api/v1/search`), e.g. `https://notification.rasa.capital/notification`.
   * Optional — when unset, `searchNotifications` requires a per-call `baseUrl`.
   */
  searchUrl?: string;
}

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
  /** Notifications WebSocket configuration */
  notifications: SymmioNotificationsConfig;
  /** Muon oracle configuration */
  muon: SymmioMuonConfig;
}
