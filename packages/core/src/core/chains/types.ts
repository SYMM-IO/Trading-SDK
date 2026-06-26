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
  /** Analytics subgraph for aggregated data */
  analytics: string;
}

/**
 * Name of a configured subgraph endpoint (a key of {@link SymmioSubgraphUrls}).
 *
 * Used to pick which subgraph an action queries; today only `"analytics"` is
 * wired, but the union grows automatically as endpoints are added.
 */
export type SymmioSubgraphName = keyof SymmioSubgraphUrls;

/**
 * Solver / hedger configuration for a SYMMIO chain deployment.
 *
 * In this SDK a "solver" is the same actor that fronts the lowcap hedger REST
 * API (`/instant_trade/instant_open`, `/contract-symbols`, …) and acts as
 * `partyB` on-chain. Its `url` is the API base URL, its `address` is partyB.
 */
export interface SymmioSolverConfig {
  /** Human-readable solver name */
  name: string;
  /** Solver's on-chain address (used as `partyB` in `sendQuoteWithAffiliateAndData`) */
  address: Address;
  /** Solver / hedger API base URL */
  url: string;
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
  /** Solver / hedger configuration */
  solver: SymmioSolverConfig;
  /** Price-service configuration */
  priceService: SymmioPriceServiceConfig;
  /** Notifications WebSocket configuration */
  notifications: SymmioNotificationsConfig;
  /** Muon oracle configuration */
  muon: SymmioMuonConfig;
}
