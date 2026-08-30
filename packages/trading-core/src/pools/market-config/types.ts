import type { ListingDepositChainId } from "../types";

/**
 * Client-side bounds for the two {@link ListingMarketConfig} knobs.
 *
 * The listing service does **not** publish these: `getListingConfig`'s
 * `/v2/configs` payload carries deposit guidance, the listing fee, supported
 * deposit chains, rate limits, and the protocol reward share — but no leverage
 * or buyback range. Until it grows one, these are the values the listing team's
 * own UI enforces, and the service is the final authority: a value outside them
 * is rejected server-side with a `422`.
 *
 * Use them to bound a slider or a numeric input; do not treat them as a
 * substitute for handling the service's rejection.
 */
export const LISTING_MARKET_CONFIG_BOUNDS = {
  /** Whole multiplier, inclusive. */
  maxLeverage: { min: 1, max: 20 },
  /** Whole percent, inclusive. */
  buybackRatio: { min: 0, max: 100 },
} as const;

/**
 * One market's configuration as the listing service sees it for the signed-in
 * user — the caller's own opinion alongside the pool-level values in force.
 *
 * The pool does not take a single LP's word for its configuration. Every LP
 * submits an opinion through `updateListingMarketConfig`, and the service folds
 * them into a deposit-weighted average: `maxLeverage` and `buybackRatio` are
 * that blend, `userMaxLeverage` and `userBuybackRatio` are this caller's
 * contribution to it.
 *
 * Both ratios are plain numbers, **not** 18-decimal values: `buybackRatio: 50`
 * means 50%, `maxLeverage: 20` means 20x. This is the same convention
 * `ListingMarketDetail.buybackRatio` and `ListingMarketDetail.maxLeverage` use.
 */
export interface ListingMarketConfig {
  /**
   * The market's token contract address, echoed back by the service — an EVM
   * `0x…` address, or a Solana base58 address for a Solana-deposited listing.
   */
  tokenContractAddress: string;
  /** The market's deposit chain, echoed back by the service. */
  depositChain: ListingDepositChainId;
  /**
   * The caller's own max-leverage opinion, a whole multiplier. `null` until the
   * caller has ever submitted one for this market.
   */
  userMaxLeverage: number | null;
  /**
   * The caller's own buyback opinion, a whole percent. `null` until the caller
   * has ever submitted one for this market.
   */
  userBuybackRatio: number | null;
  /**
   * The pool-level max leverage in force — the deposit-weighted blend of every
   * LP's opinion. Matches `ListingMarketDetail.maxLeverage`.
   */
  maxLeverage: number;
  /**
   * The pool-level buyback percentage in force — the deposit-weighted blend of
   * every LP's opinion. Matches `ListingMarketDetail.buybackRatio`.
   */
  buybackRatio: number;
}

/**
 * Inputs for {@link projectListingMarketConfig}.
 *
 * The pool-side figures come from `getListingMarketDetail`, the caller's prior
 * opinion from `getListingMarketConfig`, and the caller's stake from whichever
 * token-denominated balance the consumer trusts — `getUserProfit`'s
 * `userBalanceInTokens` is the recommended source, since it is the live stake
 * and is denominated in the same tokens as `totalTokenInPool`.
 */
export interface ProjectListingMarketConfigParameters {
  /**
   * The pool-level buyback percentage in force, from
   * `ListingMarketDetail.buybackRatio`. `null` when unknown — the projection
   * for that knob is then `null` too.
   */
  poolBuybackRatio: number | null;
  /**
   * The pool-level max leverage in force, from `ListingMarketDetail.maxLeverage`.
   * `null` when unknown.
   */
  poolMaxLeverage: number | null;
  /**
   * The caller's prior buyback opinion, from
   * `ListingMarketConfig.userBuybackRatio`. `null` when the caller has never
   * configured this market — the pool value is then used as the baseline, which
   * makes the projection an approximation rather than a first-order exact shift.
   */
  priorBuybackRatio: number | null;
  /** The caller's prior max-leverage opinion, from `ListingMarketConfig.userMaxLeverage`. */
  priorMaxLeverage: number | null;
  /** The buyback percentage the caller is about to submit. Omit to skip that knob. */
  buybackRatio?: number;
  /** The max leverage the caller is about to submit. Omit to skip that knob. */
  maxLeverage?: number;
  /**
   * The caller's stake in the pool, token-denominated at
   * `LISTING_VALUE_DECIMALS` (18). `getUserProfit`'s `userBalanceInTokens` is
   * the recommended source.
   */
  userTokenAmount: bigint;
  /** The pool's total token balance, from `ListingMarketDetail.totalTokenInPool`. */
  totalTokenInPool: bigint;
  /** The pool's total value in USD, from `ListingMarketDetail.tvl`. */
  tvl: bigint | null;
  /** The pool's USDC balance, from `ListingMarketDetail.totalUsdcInPool`. */
  totalUsdcInPool: bigint;
}

/** Result of {@link projectListingMarketConfig}. */
export interface ListingMarketConfigProjection {
  /**
   * The caller's deposit-**value** share of the pool, clamped to `0..1` — the
   * weight the service gives their opinion.
   */
  share: number;
  /**
   * Where the pool's buyback percentage lands once the opinion is saved, or
   * `null` when `poolBuybackRatio` or the entered value is unknown.
   */
  projectedBuybackRatio: number | null;
  /**
   * Where the pool's max leverage lands once the opinion is saved, or `null`
   * when `poolMaxLeverage` or the entered value is unknown.
   */
  projectedMaxLeverage: number | null;
}
