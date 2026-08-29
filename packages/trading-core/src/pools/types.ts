import type { MarketStatus } from "./types/generated/listing-backend";

/**
 * Fixed-point scale of every money and rate field the listing service returns.
 *
 * The service reports these as decimal **strings** at 18 decimals, regardless of
 * the token's own decimals or the collateral's (`"1000000000000000000"` = `1`).
 * The SDK keeps them as `bigint` at this scale so nothing is lost; format with
 * `formatUnits(value, LISTING_VALUE_DECIMALS)` from `@symmio/utils/decimal` at
 * the display edge.
 *
 * **What the descaled number means differs by field.** For money fields it is a
 * USD amount (`1e18` = `$1`). For rate fields it is **already a percentage**
 * (`1e18` = `1%`), *not* a fraction — do **not** multiply by 100 to render one.
 *
 * Verified against the live service: a pool with `tvl` `177.78` and `reward_24h`
 * `0.0055` annualizes to `1.1295%`, and its `apr_24h` descales to exactly
 * `1.1295`.
 */
export const LISTING_VALUE_DECIMALS = 18;

/**
 * Lifecycle status of a market in the permissionless-listing service.
 *
 * The service — not the chain — owns this state machine. A market becomes
 * tradable only at {@link ListingMarketStatus.LISTED}; before that it has no
 * `symbolId` and no solver market behind it.
 *
 * - `WAITING_FOR_DEPOSIT` — application accepted, the listing deposit has not
 *   landed at the custodial address yet.
 * - `UNDER_REVIEW` — deposit received, awaiting the operator's decision.
 * - `REJECTED` — the operator declined the listing; the deposit is refundable.
 * - `LISTED` — live and tradable; `symbolId` is assigned.
 * - `DELISTED` — was live, has since been withdrawn from trading.
 */
export enum ListingMarketStatus {
  WAITING_FOR_DEPOSIT = "waiting_for_deposit",
  UNDER_REVIEW = "under_review",
  REJECTED = "rejected",
  LISTED = "listed",
  DELISTED = "delisted",
}

/**
 * Chains the listing service accepts a listing deposit on.
 *
 * This is the chain the **token** lives on and where its listing collateral was
 * deposited — it is **not** the chain the resulting market trades on. A market
 * whose token is on Solana or BSC still trades on the SYMMIO deployment the
 * listing service is configured for.
 *
 * `SOLANA = 0` is a sentinel the service uses for its one non-EVM chain, not a
 * real chain id: a `ListingMarket` on it carries a base58 `contractAddress`, so
 * never feed one to an EVM address helper without checking `chainId` first.
 */
export enum ListingDepositChainId {
  /** Sentinel for Solana — not an EVM chain id. Addresses are base58. */
  SOLANA = 0,
  BSC = 56,
  BASE = 8453,
  SONIC = 146,
  ARBITRUM_ONE = 42161,
  HYPER_EVM = 999,
}

/**
 * The same metric measured over each trailing window the listing service
 * reports.
 *
 * Every entry is a `bigint` at {@link LISTING_VALUE_DECIMALS}, or `null` when
 * the service has no value for that window — a young market has no 30-day
 * figure, and `null` means *absent*, never zero.
 */
export interface ListingTrailingWindows {
  /** Trailing 1 hour. */
  h1: bigint | null;
  /** Trailing 6 hours. */
  h6: bigint | null;
  /** Trailing 24 hours. */
  h24: bigint | null;
  /** Trailing 30 days. */
  d30: bigint | null;
}

/**
 * A metric the service reports over the trailing windows **and** since listing.
 *
 * Only the two APY series carry a lifetime column; APR does not, which is why
 * `lifetime` lives here rather than on {@link ListingTrailingWindows}.
 */
export interface ListingApyWindows extends ListingTrailingWindows {
  /** Since the market was listed. */
  lifetime: bigint | null;
}

/**
 * One market in the permissionless-listing catalog — a row of the pools list.
 *
 * Money and rate fields are `bigint` at {@link LISTING_VALUE_DECIMALS}; `null`
 * means the service reported no value, which is distinct from zero.
 */
export interface ListingMarket {
  /**
   * The listed token's contract address on {@link ListingMarket.chainId}.
   *
   * Typed as `string`, **not** viem's `Address`: Solana listings
   * (`chainId === ListingDepositChainId.SOLANA`) carry a base58 address that is
   * not 0x-prefixed. This is also the id used to address a single market in the
   * rest of the listing API.
   */
  contractAddress: string;
  /** Chain the token lives on and its listing deposit was made on. */
  chainId: ListingDepositChainId;
  /**
   * The solver market id this listing trades under, or `null` when it has none
   * yet. Assigned when the market reaches {@link ListingMarketStatus.LISTED};
   * everything downstream (prices, notional caps, quotes, subgraph rows) keys
   * off it, so a `null` here means the market is not tradable.
   */
  symbolId: number | null;
  /** Token ticker, e.g. `"SYMM"`. */
  tokenTicker: string;
  /** Token display name, e.g. `"Symmio"`. */
  tokenName: string;
  /** Maximum leverage the market allows, as a whole multiplier (`20` = 20x). */
  maxLeverage: number;
  /** Token market capitalization, in USD. */
  marketCap: bigint | null;
  /** Trailing 24-hour trading volume, in USD. */
  vol24h: bigint | null;
  /** Total value locked in the market's pool, in USD. */
  tvl: bigint | null;
  /** Notional the solver will still take on this market, in USD. */
  liquidity: bigint | null;
  /** Notional currently open on this market, in USD. */
  openInterest: bigint | null;
  /** LP rewards accrued over the trailing 24 hours, in USD. */
  reward24h: bigint | null;
  /** Headline APR: a percentage already (`1e18` = `1%`), not a fraction — render it without multiplying by 100. */
  apr: bigint | null;
  /**
   * APR broken out per trailing window, same units as {@link ListingMarket.apr}.
   * There is no lifetime APR — use {@link ListingMarket.apr} for the headline.
   */
  aprByWindow: ListingTrailingWindows;
  /** APY attributed to TVL growth, per window: a percentage already (`1e18` = `1%`), not a fraction — render it without multiplying by 100. */
  tvlDrivenApy: ListingApyWindows;
  /** APY attributed to token price movement, per window: a percentage already (`1e18` = `1%`), not a fraction — render it without multiplying by 100. */
  priceDrivenApy: ListingApyWindows;
  /** When the market went live, as a Unix timestamp in **seconds**. `null` before it is listed. */
  listingTime: number | null;
  /** Where the market sits in the listing lifecycle. */
  marketStatus: ListingMarketStatus;
}

/** One page of {@link ListingMarket} rows, with the totals needed to paginate. */
export interface ListingMarketPage {
  /** Total rows matching the query across all pages. */
  total: number;
  /** Page size the service applied. */
  limit: number;
  /** Row offset of this page. */
  offset: number;
  /** The rows themselves. */
  items: ListingMarket[];
}

/**
 * A {@link ListingMarket} enriched with the signed-in user's position in it — one
 * row of "Your Pools", the markets that generated a deposit address for the user.
 */
export interface UserListingMarket extends ListingMarket {
  /** The user's current deposit into this pool, in USD (18-dec bigint). `null` when the deposit address exists but nothing has been deposited yet. */
  userDeposit: bigint | null;
  /** The user's share of the pool, as a percentage number (not 18-dec scaled). */
  userSharePercentage: number;
  /** The user's accrued revenue from this pool, in USD (18-dec bigint), or `null` when absent. */
  userRevenue: bigint | null;
}

/** One page of {@link UserListingMarket} rows, with the totals needed to paginate. */
export interface UserListingMarketPage {
  /** Total rows matching the query across all pages. */
  total: number;
  /** Page size the service applied. */
  limit: number;
  /** Row offset of this page. */
  offset: number;
  /** The rows themselves. */
  items: UserListingMarket[];
}

/**
 * The signed-in user's LP position and profit in a single pool — the authed
 * per-token read behind a pool's "your position" panel.
 *
 * Every field is a `bigint` at {@link LISTING_VALUE_DECIMALS} (18), independent
 * of the token's or collateral's own decimals; format with
 * `formatUnits(value, LISTING_VALUE_DECIMALS)` at the display edge. An absent
 * figure is normalized to `0n`, not `null`.
 */
export interface UserPoolProfit {
  /** LP balance valued in the pool's token units, 18-dec bigint. */
  userBalanceInTokens: bigint;
  /** LP balance valued in USDC, 18-dec bigint USD. */
  userBalanceInUsdc: bigint;
  /** Rewards the user can claim now, 18-dec bigint USD. */
  claimableReward: bigint;
  /** Rewards already claimed, 18-dec bigint USD. */
  claimedReward: bigint;
  /** Token amount the user deposited, 18-dec bigint. */
  userDepositedTokenAmount: bigint;
  /** The user's LP shares, 18-dec bigint. */
  userLpAmount: bigint;
  /** LP shares queued for withdrawal (the pending-withdrawal amount), 18-dec bigint. */
  pendingWithdrawLpAmount: bigint;
  /**
   * LP shares free to withdraw right now — `userLpAmount − pendingWithdrawLpAmount`,
   * floored at `0n`. This is the ceiling a withdrawal (`withdrawLp`) may request;
   * the shares already counted in {@link UserPoolProfit.pendingWithdrawLpAmount}
   * are spoken for. Derived by the SDK, not a field the service returns. 18-dec
   * bigint.
   */
  availableLpAmount: bigint;
}

/**
 * The receipt returned by `claimProfit` — the outcome of a `/v2/claim` request.
 *
 * The claim is synchronous: a `200` means the USDC was moved to the target
 * sub-account. `amountClaimed` is the moved figure normalized to a `bigint` at
 * `LISTING_VALUE_DECIMALS` (18), `claimRequestId` references the claim in the
 * service, and `transactionHash` is the on-chain transfer hash when the service
 * has one (`null` otherwise).
 */
export interface PoolClaimResult {
  /** The service's status string, e.g. `"ok"`. */
  status: string;
  /** USDC moved to the sub-account, 18-dec bigint USD. */
  amountClaimed: bigint;
  /** Claim id — reference it to restore or look up the claim later. */
  claimRequestId: string;
  /** On-chain hash of the claim transfer, or `null` when the service has none yet. */
  transactionHash: string | null;
}

/**
 * The signed-in user's deposit wallet for one market — the get-or-create result
 * of the authed `/v2/market/deposit-address` endpoint. This is the address the
 * user sends funds to in order to deposit into the market's pool.
 */
export interface MarketDepositAddress {
  /** The market's token contract address (EVM 0x… or Solana base58). */
  tokenContractAddress: string;
  /** The signed-in user this deposit wallet belongs to. */
  userAddress: string;
  /** The market's deposit chain. */
  depositChain: ListingDepositChainId;
  /** The deposit address — where the user sends funds to deposit into this market. `null` when the service returned none. */
  depositAddress: string | null;
  /** The token's on-chain decimals. */
  tokenDecimal: number;
  /** The market's listing lifecycle status. */
  marketStatus: ListingMarketStatus;
}

/**
 * The listing-pipeline status of a single market — the normalized result of
 * `getListingStatus`, keyed by the market's token address and deposit chain.
 *
 * `marketStatus` is the overall lifecycle status (the same machine as
 * {@link ListingMarketStatus}); the remaining fields describe where the listing
 * is in the backend's step pipeline and whether the current step is retrying or
 * has errored.
 */
export interface ListingStatus {
  /** Overall lifecycle status of the market, mapped from the service's `market_status`. */
  marketStatus: ListingMarketStatus;
  /** The step the listing pipeline is currently on, or `null` when it is not in a step. */
  currentStep: string | null;
  /** The ordered pipeline steps the listing moves through. */
  steps: string[];
  /** Error code reported for the current step, or `null` when there is no error. */
  errorCode: number | null;
  /** Human-readable detail for the current step's error, or `null`. */
  errorDetail: string | null;
  /** How many times the current step has been retried. */
  retryCount: number;
  /** The maximum retries allowed for the current step. */
  retryLimit: number;
}

/**
 * The protocol's global new-market listing cap for the current rolling weekly
 * window — how many pools may still be listed across the protocol before the
 * window resets.
 */
export interface WeeklyListingLimit {
  /** Total new-market listings allowed per rolling weekly window. */
  limit: number;
  /** Listings still available in the current window — `0` means no more pools can be listed until reset. */
  remaining: number;
  /** When the window resets, as the Unix timestamp the service returns (`reset_at`). */
  resetAt: number;
}

/**
 * Server-side sort keys accepted by `getListingMarkets`.
 *
 * Mirrors the service's `sort_by` enum verbatim — snake_case, not the SDK's
 * camelCase field names — because the value is a wire literal, and translating
 * it would break silently the moment the service adds a key.
 *
 * Note the two bare keys: `tvl_driven_apy` and `price_driven_apy` have no
 * matching bare response field. They sort by the **lifetime** column
 * (`tvl_driven_apy_lifetime` / `price_driven_apy_lifetime`).
 */
export type ListingMarketSortField =
  | "liquidity"
  | "tvl"
  | "market_cap"
  | "vol24h"
  | "open_interest"
  | "apr_1h"
  | "apr_6h"
  | "apr_24h"
  | "apr_30d"
  | "reward_24h"
  | "apr"
  | "tvl_driven_apy_1h"
  | "tvl_driven_apy_6h"
  | "tvl_driven_apy_24h"
  | "tvl_driven_apy_30d"
  | "tvl_driven_apy"
  | "price_driven_apy_1h"
  | "price_driven_apy_6h"
  | "price_driven_apy_24h"
  | "price_driven_apy_30d"
  | "price_driven_apy"
  | "listing_time";

/** Sort direction. */
export type ListingSortDirection = "asc" | "desc";

/**
 * An inclusive `[min, max]` bound on one of the service's value fields. Either
 * end may be omitted for a one-sided bound.
 *
 * Bounds use the **same 18-decimal scale as the response**
 * ({@link LISTING_VALUE_DECIMALS}), not the human-readable figure. Filtering for
 * "market cap of at least one million USD" is
 * `{ min: parseUnits("1000000", LISTING_VALUE_DECIMALS) }`, not `{ min: 1_000_000 }`
 * — the latter is a bound of `0.000000000001` USD and silently matches nothing
 * useful. Verified against the live service.
 */
export interface ListingValueRange {
  /** Inclusive lower bound at 18 decimals (`__ge` on the wire). */
  min?: bigint;
  /** Inclusive upper bound at 18 decimals (`__le` on the wire). */
  max?: bigint;
}

/**
 * An inclusive `[min, max]` bound on a timestamp field, in Unix **seconds**
 * (not milliseconds, and not 18-decimal scaled).
 */
export interface ListingTimeRange {
  /** Inclusive lower bound, Unix seconds (`__ge` on the wire). */
  min?: number;
  /** Inclusive upper bound, Unix seconds (`__le` on the wire). */
  max?: number;
}

/**
 * Range filters `getListingMarkets` accepts. Every key is optional; omitted keys
 * are not sent.
 *
 * All {@link ListingValueRange} bounds are at {@link LISTING_VALUE_DECIMALS};
 * `listingTime` is the one exception and takes Unix seconds.
 */
export interface ListingMarketFilters {
  /** Token market capitalization, USD. */
  marketCap?: ListingValueRange;
  /** Trailing 24-hour volume, USD. */
  vol24h?: ListingValueRange;
  /** Total value locked, USD. */
  tvl?: ListingValueRange;
  /** Available notional, USD. */
  liquidity?: ListingValueRange;
  /** Open notional, USD. */
  openInterest?: ListingValueRange;
  /** Trailing 24-hour LP rewards, USD. */
  reward24h?: ListingValueRange;
  /** Headline APR bounds, at the field's own scale (`1e18` = `1%`). */
  apr?: ListingValueRange;
  /** APR over the trailing hour. */
  apr1h?: ListingValueRange;
  /** APR over the trailing 6 hours. */
  apr6h?: ListingValueRange;
  /** APR over the trailing 24 hours. */
  apr24h?: ListingValueRange;
  /** APR over the trailing 30 days. */
  apr30d?: ListingValueRange;
  /** TVL-driven APY over the trailing hour. */
  tvlDrivenApy1h?: ListingValueRange;
  /** TVL-driven APY over the trailing 6 hours. */
  tvlDrivenApy6h?: ListingValueRange;
  /** TVL-driven APY over the trailing 24 hours. */
  tvlDrivenApy24h?: ListingValueRange;
  /** TVL-driven APY over the trailing 30 days. */
  tvlDrivenApy30d?: ListingValueRange;
  /** TVL-driven APY over the market's lifetime. */
  tvlDrivenApy?: ListingValueRange;
  /** Price-driven APY over the trailing hour. */
  priceDrivenApy1h?: ListingValueRange;
  /** Price-driven APY over the trailing 6 hours. */
  priceDrivenApy6h?: ListingValueRange;
  /** Price-driven APY over the trailing 24 hours. */
  priceDrivenApy24h?: ListingValueRange;
  /** Price-driven APY over the trailing 30 days. */
  priceDrivenApy30d?: ListingValueRange;
  /** Price-driven APY over the market's lifetime. */
  priceDrivenApy?: ListingValueRange;
  /** Listing timestamp bounds, Unix seconds. */
  listingTime?: ListingTimeRange;
}

/**
 * Which side of the pool's book a {@link PoolPosition} row describes.
 *
 * The pool's inventory is reported as two aggregates, not a list of individual
 * trades — the detail read gives one long total and one short total.
 */
export enum PoolPositionSide {
  LONG = "long",
  SHORT = "short",
}

/**
 * One side of a pool's aggregate position book.
 *
 * Every figure is a `bigint` at {@link LISTING_VALUE_DECIMALS}. `upnl` is signed
 * — a losing side reports a negative value — and is the only field here that
 * routinely is.
 */
export interface PoolPosition {
  /** Which side this row aggregates. */
  side: PoolPositionSide;
  /** Total size held on this side, in the pool token's units. */
  size: bigint;
  /** Notional value of the side, in USD. */
  value: bigint;
  /** Size-weighted average open price of the side, in USD. */
  avgOpenPrice: bigint;
  /** Unrealized PnL of the side, in USD. Signed. */
  upnl: bigint;
}

/**
 * A pool's public detail — the aggregate stats and inventory position behind a
 * pool page.
 *
 * Money and rate fields are `bigint` at {@link LISTING_VALUE_DECIMALS}; recall
 * that a descaled *rate* is already a percentage (`1e18` = `1%`) while a
 * descaled *money* field is USD (`1e18` = `$1`). `null` means the backend
 * reported no value, which is not zero.
 *
 * A **delisted** pool is a documented special case: the backend returns cached
 * remaining token and USDC balances with `tvl` fixed at zero.
 */
export interface ListingMarketDetail {
  /** The pool's token contract address — its id in the listing API. */
  tokenContractAddress: string;
  /** Chain the token lives on and its listing deposit was made on. */
  depositChain: ListingDepositChainId;
  /** Token display name. */
  tokenName: string;
  /** Token ticker, or `null` when the backend has none. */
  tokenTicker: string | null;
  /** Token decimals. */
  tokenDecimal: number;
  /** Solver market id, or `null` when the pool is not tradable yet. */
  symbolId: number | null;
  /** Where the pool sits in the listing lifecycle. */
  marketStatus: ListingMarketStatus;
  /** Maximum leverage the market allows, as a whole multiplier. */
  maxLeverage: number;
  /** Share of revenue routed to token buybacks, as a percentage (`50` = 50%). */
  buybackRatio: number;
  /** When the market went live, as a Unix timestamp in **seconds**. */
  listingTime: number | null;
  /** Pool age in **seconds**, or `null` before listing. */
  age: number | null;
  /** Number of distinct LPs in the pool. */
  activeLps: number;
  /** Total value locked in the pool, USD. `0` for a delisted pool by design. */
  tvl: bigint | null;
  /** Collateral held by the pool, USD. */
  totalUsdcInPool: bigint;
  /** Pool token held by the pool, in the token's own units. */
  totalTokenInPool: bigint;
  /** Accrued maintenance fees, USD. */
  maintenanceFees: bigint;
  /** LP rewards per window, USD. */
  rewards: ListingApyWindows;
  /** Solver revenue per window, USD. */
  solverRevenue: ListingApyWindows;
  /** Headline APY per window, as a percentage. */
  apy: ListingApyWindows;
  /** APY attributed to TVL growth, per window, as a percentage. */
  tvlDrivenApy: ListingApyWindows;
  /** APY attributed to token price movement, per window, as a percentage. */
  priceDrivenApy: ListingApyWindows;
  /** The pool's aggregate long side, or `null` when the backend reported none. */
  longPosition: PoolPosition | null;
  /** The pool's aggregate short side, or `null` when the backend reported none. */
  shortPosition: PoolPosition | null;
}

/** Whether a pool transaction is money going in or coming out. */
export enum PoolTransactionType {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

/**
 * Where a pool transaction sits in its lifecycle, as the backend reports it to
 * users.
 */
export enum PoolTransactionStatus {
  PENDING = "pending",
  SUCCESS = "success",
  REJECTED = "rejected",
  REFUND = "refund",
  CANCELED = "canceled",
}

/**
 * One deposit or withdrawal against a pool.
 *
 * `amount`, `usdcAmount` and `tokenAmount` are `bigint` at
 * {@link LISTING_VALUE_DECIMALS}. The refund fields are populated only for a
 * refunded row.
 */
export interface PoolTransaction {
  /** Backend id for the transaction. */
  transactionId: string;
  /** The wallet that made it. */
  walletAddress: string;
  /** Amount moved, in the transaction's own denomination. */
  amount: bigint;
  /** Collateral value moved, USD. */
  usdcAmount: bigint;
  /** Token amount moved, in the pool token's units. */
  tokenAmount: bigint;
  /** On-chain transaction hash or Solana signature, when known. */
  transactionHash: string | null;
  /** Address a refund was sent to, or `null` when this is not a refund. */
  refundAddress: string | null;
  /** Hash of the refund transaction, or `null` when this is not a refund. */
  refundTransactionHash: string | null;
  /** When the refund completed, Unix **seconds**; `null` when not a refund. */
  refundTime: number | null;
  /** Deposit or withdrawal. */
  type: PoolTransactionType;
  /** Lifecycle status. */
  status: PoolTransactionStatus;
  /** When the transaction happened, Unix **seconds**. */
  time: number;
}

/** One page of {@link PoolTransaction} rows for a pool. */
export interface PoolTransactionPage {
  /** The pool's token contract address, echoed by the backend. */
  marketAddress: string;
  /** Total rows matching the query across all pages. */
  count: number;
  /** The rows themselves. */
  items: PoolTransaction[];
}

/**
 * The generated `MarketStatus` enum and {@link ListingMarketStatus} carry the
 * same string values; this alias documents that the cast in the mapper is
 * value-preserving rather than a widening.
 *
 * @internal
 */
export type GeneratedMarketStatus = MarketStatus;

/**
 * One deposit chain a new listing may use, from the listing service's public
 * config ({@link ListingConfig.supportedDepositChains}).
 */
export interface ListingDepositChain {
  /** Numeric chain id to send with market/deposit requests. */
  chainId: ListingDepositChainId;
  /** Human-readable chain name, e.g. "HyperEVM". */
  chainName: string;
}

/**
 * The client mutation limits the listing service enforces, from its public
 * config ({@link ListingConfig.rateLimits}).
 */
export interface ListingRateLimits {
  /** Max successful market-config updates per user+market in a rolling 24h window. */
  marketConfigUpdatesPerDay: number;
  /** Max successful profit claims per user+market in a rolling 24h window. */
  profitClaimsPerDay: number;
}

/**
 * The listing service's public client configuration — the deposit guidance,
 * listing fee, supported deposit chains, rate limits, and protocol reward share
 * a create-listing flow needs.
 *
 * The three USDC figures are `bigint` at {@link LISTING_VALUE_DECIMALS} (18),
 * independent of the collateral token's own decimals; format them with
 * `formatUnits(value, LISTING_VALUE_DECIMALS)` at the display edge.
 */
export interface ListingConfig {
  /** Recommended initial USDC deposit to start a listing, USD at LISTING_VALUE_DECIMALS (18) as a bigint. */
  recommendedInitialDepositUsdc: bigint;
  /** Minimum accepted initial USDC deposit after slippage, USD 18-dec bigint. */
  minimumInitialDepositUsdc: bigint;
  /** Listing fee in USDC, USD 18-dec bigint. */
  listingFeeUsdc: bigint;
  /** Deposit chains new markets may use — the source of truth for a chain picker. */
  supportedDepositChains: ListingDepositChain[];
  /** Rolling-24h client mutation limits. */
  rateLimits: ListingRateLimits;
  /** Whole-percent of market revenue to the protocol before buyback/LP. */
  protocolRewardSharePercent: number;
}

/**
 * One quote in a pool's book, decoded from the analytics subgraph.
 *
 * A pool's book is **every trader's** quotes on that market, not one account's —
 * `partyA` differs from row to row. Amounts and prices are `bigint` at 18
 * decimals (the protocol's own scale, not the listing backend's), and `null`
 * means the subgraph had no value for that field.
 */
export interface PoolQuote {
  /** Subgraph row id (`{quoteId}-{source}`); stable, use as a table key. */
  id: string;
  /** Protocol quote id. */
  quoteId: bigint;
  /** Raw `QuoteStatus` ordinal as the subgraph reports it. */
  quoteStatus: number | null;
  /** Raw `PositionType` ordinal — `0` long, `1` short. */
  positionType: number | null;
  /** Raw `OrderType` ordinal of the open — `0` limit, `1` market. */
  orderTypeOpen: number | null;
  /** Market ticker, when the subgraph carries one. */
  symbol: string | null;
  /** Solver market id. */
  symbolId: number | null;
  /** The account that opened the quote. */
  partyA: string;
  /** The solver that took the other side. */
  partyB: string | null;
  /** Quote size. */
  quantity: bigint | null;
  /** How much of {@link PoolQuote.quantity} has been closed. */
  closedAmount: bigint | null;
  /** Size of an in-flight close request. */
  quantityToClose: bigint | null;
  /** Price the quote actually opened at. */
  openedPrice: bigint | null;
  /** Price the opener asked for. */
  requestedOpenPrice: bigint | null;
  /** Size-weighted average of the closes so far. */
  averageClosedPrice: bigint | null;
  /** Price of an in-flight close request. */
  closePrice: bigint | null;
  /** Open price before any modification. */
  initialOpenedPrice: bigint | null;
  /** Size liquidated, when the quote was liquidated. */
  liquidateAmount: bigint | null;
  /** Price the liquidation executed at. */
  liquidatePrice: bigint | null;
  /** Block timestamp of the quote's last update, Unix **seconds**. */
  timestamp: number;
  /** Block the quote was last updated in. */
  blockNumber: bigint;
}

/**
 * One day of LP reward for a pool.
 *
 * A series of these is what a pool page's rewards chart plots — the public
 * per-pool series from `getPoolRewardChart`, or one market's slice of the
 * signed-in user's {@link UserPoolRewardChart}.
 */
export interface PoolRewardPoint {
  /** Start of the reward day, unix **seconds**. */
  timestamp: number;
  /**
   * Reward earned that day, `bigint` at {@link LISTING_VALUE_DECIMALS} (18).
   *
   * A **money** field, so the descaled number is a USD amount (`1e18` = `$1`) —
   * unlike the catalog's rate fields, which are already percentages. A day the
   * service reports as absent collapses to `0n` rather than `null`: a missing
   * snapshot and a zero-reward day are the same point on a chart.
   */
  reward: bigint;
}

/**
 * The signed-in user's daily reward series for **one** market, as returned by
 * `getUserRewardChart` — which reports every market the user has rewards in,
 * one entry each.
 *
 * A market is addressed by the pair `(marketAddress, marketChainId)`, matching
 * {@link ListingMarket.contractAddress} and {@link ListingMarket.chainId}. Note
 * `marketChainId` is the chain the **token** lives on, not the SYMMIO chain the
 * market trades on.
 */
export interface UserPoolRewardChart {
  /** The pool's token contract address — matches {@link ListingMarket.contractAddress}. */
  marketAddress: string;
  /** Chain the token lives on — matches {@link ListingMarket.chainId}. */
  marketChainId: ListingDepositChainId;
  /** The user's daily rewards in this pool, in the order the service returns them. */
  rewards: PoolRewardPoint[];
}
