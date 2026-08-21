"use client";

import { getDeployment, type MarketFamily } from "@/config/deployments";
import type { PrismMarket } from "@/features/markets/types";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * The market the trade screen is pointed at, held in the URL.
 *
 * Keeping it in `?market=<family>:<symbolId>` means a market link carries its
 * deployment with it — there is no ambiguity about which solver a shared link
 * refers to, even though both families appear in one book.
 */
export function useSelectedMarket() {
  const router = useRouter();
  const params = useSearchParams();
  const { markets, byKey, isLoading } = useMergedMarkets({ scope: "mode" });

  const requested = params.get("market");

  const selected = useMemo<PrismMarket | undefined>(() => {
    if (requested) {
      const match = byKey.get(requested);
      if (match) return match;
    }
    /**
     * Fall back to the deepest majors market, then to the deepest market of
     * any family. Majors first is deliberate: they are the family with a
     * candle source and a public order book, so an unparameterised visit
     * lands on the screen at its most complete rather than on two panels
     * explaining what this solver does not publish.
     */
    return markets.find((entry) => entry.family === "majors") ?? markets[0];
  }, [requested, byKey, markets]);

  const select = useCallback(
    (key: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("market", key);
      router.replace(`/?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const deployment = selected ? getDeployment(selected.family as MarketFamily) : undefined;

  return { selected, select, deployment, markets, isLoading };
}
