import { toListingValue } from "../markets/to-listing-market";
import type { PoolRewardPoint, UserPoolRewardChart } from "../types";
import type { RewardChartPointSchema, UserMarketRewardChartSchema } from "../types/generated/listing-backend";

/**
 * Map one raw `RewardChartPointSchema` row into the SDK's {@link PoolRewardPoint}.
 *
 * `reward` is an 18-decimal decimal string on the wire and is parsed through
 * {@link toListingValue}. A `null` or unparseable value collapses to `0n` rather
 * than staying `null`: on a reward chart a missing snapshot and a zero-reward day
 * render identically, and a nullable point would push that collapse onto every
 * consumer.
 *
 * @param raw - One row of a `/v2/market/chart/rewards` or `/v2/profit/chart/rewards` response.
 * @returns The normalized point.
 */
export function toPoolRewardPoint(raw: RewardChartPointSchema): PoolRewardPoint {
  return {
    timestamp: raw.timestamp,
    reward: toListingValue(raw.reward) ?? 0n,
  };
}

/**
 * Map one raw `UserMarketRewardChartSchema` group — the per-market envelope the
 * authed `/v2/profit/chart/rewards` endpoint returns — into the SDK's
 * {@link UserPoolRewardChart}.
 *
 * The wire `chain_id` is the chain the pool's **token** lives on, so it is
 * surfaced as `marketChainId` and never as the SDK's own `chainId`.
 *
 * @param raw - One group of the `/v2/profit/chart/rewards` response.
 * @returns The normalized per-market series.
 */
export function toUserPoolRewardChart(raw: UserMarketRewardChartSchema): UserPoolRewardChart {
  return {
    marketAddress: raw.market_address,
    marketChainId: raw.chain_id,
    rewards: (raw.rewards ?? []).map(toPoolRewardPoint),
  };
}
