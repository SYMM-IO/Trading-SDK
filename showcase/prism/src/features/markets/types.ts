import type { Deployment, MarketFamily } from "@/config/deployments";
import type { Market } from "@symmio/trading-core";

/**
 * A market, tagged with the deployment that serves it.
 *
 * This tag is the only thing Prism adds to the SDK's normalized `Market`. It is
 * what lets one table hold both solvers' markets while every row still knows
 * which chain to trade on and which palette to wear.
 */
export interface PrismMarket {
  /** The SDK's normalized market, discriminated by `kind` (`enigma` / `rasa`). */
  market: Market;
  /** The deployment that listed it. */
  deployment: Deployment;
  /** Convenience alias for `deployment.family`. */
  family: MarketFamily;
  /** Stable row key across the merged list. */
  key: string;
}

/** Build a merged-list key that cannot collide across deployments. */
export function marketKey(family: MarketFamily, symbolId: number): string {
  return `${family}:${symbolId}`;
}
