"use client";

import {
  checkForceCloseEligibility,
  type ConfigParameter,
  type ForceCloseEligibility,
  type Quote,
} from "@symmio/trading-core";
import { useEffect, useMemo, useState } from "react";
import { useSupportsLimitOrder } from "../solvers/use-solver-capabilities";
import { useForceCloseParams } from "./use-force-close-params";

/** The quote fields {@link useForceCloseEligibility} needs. */
export type ForceCloseEligibilityQuote = Pick<
  Quote,
  "quoteStatus" | "orderType" | "statusModifyTimestamp" | "deadline" | "symbolId"
>;

/** Parameters for {@link useForceCloseEligibility}. */
export type UseForceCloseEligibilityParameters = ConfigParameter & {
  /** The quote (or a subset with the needed fields) to gate. */
  quote?: ForceCloseEligibilityQuote;
};

/** Return type of {@link useForceCloseEligibility}. */
export type UseForceCloseEligibilityReturnType = ForceCloseEligibility & {
  /** `true` while the force-close params are loading (eligibility not yet known). */
  isLoading: boolean;
};

const NOT_ELIGIBLE: ForceCloseEligibility = { eligible: false, cooldownRemaining: 0n };

/**
 * Live force-close eligibility for a quote — the button gate + cooldown
 * countdown. Reads the market's force-close params ({@link useForceCloseParams})
 * and runs the pure `checkForceCloseEligibility` against a 1-second clock, so
 * `cooldownRemaining` ticks down and `eligible` flips on the moment the cooldown
 * elapses, without a manual refresh. Send with {@link useForceClose}.
 *
 * Force close is a limit-order feature (majors / rasa), so it is never eligible
 * on a solver that does not support limit orders.
 *
 * @example
 * ```tsx
 * const { eligible, reason, cooldownRemaining } = useForceCloseEligibility({ quote });
 * ```
 */
export function useForceCloseEligibility(
  parameters: UseForceCloseEligibilityParameters = {},
): UseForceCloseEligibilityReturnType {
  const { quote, config } = parameters;
  const supportsLimit = useSupportsLimitOrder({ config });
  /** `0n` is a placeholder that is never fetched — the query stays disabled until a quote is present. */
  const paramsQuery = useForceCloseParams({
    symbolId: quote?.symbolId ?? 0n,
    config,
    query: { enabled: quote !== undefined },
  });
  const params = paramsQuery.data;

  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const id = setInterval(() => setNowSec(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(id);
  }, []);

  const eligibility = useMemo<ForceCloseEligibility>(() => {
    // Force close only exists on limit-supporting solvers — never eligible otherwise.
    if (!supportsLimit || !quote || !params) return NOT_ELIGIBLE;
    return checkForceCloseEligibility({
      quote,
      firstCooldown: params.firstCooldown,
      secondCooldown: params.secondCooldown,
      minSigPeriod: params.minSigPeriod,
      now: nowSec,
    });
  }, [supportsLimit, quote, params, nowSec]);

  return { ...eligibility, isLoading: paramsQuery.isLoading };
}
