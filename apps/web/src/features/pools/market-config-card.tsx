"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { Stat } from "@/components/stat";
import { LISTING_MARKET_CONFIG_BOUNDS, ListingDepositChainId } from "@symmio/trading-core";
import {
  useListingMarketConfig,
  useListingMarketConfigProjection,
  useUpdateListingMarketConfig,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";

const DASH = "—";

/**
 * Parse a whole-number input into a value inside `bounds`, or `null` when it is
 * blank or out of range. The two knobs are plain integers — `50` is 50%, `20` is
 * 20x — so a fractional or out-of-range entry is rejected before the request
 * rather than left for the service's `422`.
 */
function parseWhole(value: string, bounds: { min: number; max: number }): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < bounds.min || parsed > bounds.max) return null;

  return parsed;
}

/** Format a projected value: integers stay clean, blends show one decimal. */
function formatBlend(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Market config — submit the signed-in user&rsquo;s max-leverage and buyback opinion
 * for one pool.
 *
 * A pool&rsquo;s configuration is not set by any single LP. Every depositor submits an
 * opinion and the listing service folds them into a deposit-weighted average, so
 * this card writes a *nudge*, not an overwrite. It reads the caller&rsquo;s current
 * opinion with {@link useListingMarketConfig} (blank until they have ever set
 * one), projects the resulting pool values with
 * {@link useListingMarketConfigProjection}, and submits with
 * {@link useUpdateListingMarketConfig}.
 *
 * The pool comes from the section&rsquo;s shared picker ({@link usePoolScope}) and the
 * bearer token from the shared {@link useListingAuth} session. Enigma-only: the
 * listing backend lives on HyperEVM, so the card is gated on Enigma being the
 * active solver, mirroring the other Listing-session cards.
 */
export function MarketConfigCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn } = useListingAuth();
  const { contractAddress, market: selectedMarket } = usePoolScope();

  const [buybackInput, setBuybackInput] = useState("");
  const [leverageInput, setLeverageInput] = useState("");

  const depositChain = selectedMarket?.chainId ?? ListingDepositChainId.HYPER_EVM;

  const marketConfig = useListingMarketConfig({
    accessToken: accessToken ?? "",
    tokenContractAddress: contractAddress,
    depositChain,
  });

  const update = useUpdateListingMarketConfig();

  const signedIn = accessToken !== null;
  const buybackRatio = parseWhole(buybackInput, LISTING_MARKET_CONFIG_BOUNDS.buybackRatio);
  const maxLeverage = parseWhole(leverageInput, LISTING_MARKET_CONFIG_BOUNDS.maxLeverage);

  const projection = useListingMarketConfigProjection({
    accessToken: accessToken ?? "",
    tokenContractAddress: contractAddress,
    depositChain,
    buybackRatio: buybackRatio ?? undefined,
    maxLeverage: maxLeverage ?? undefined,
    enabled: signedIn && contractAddress.length > 0,
  });

  const buybackInvalid = buybackInput.trim() !== "" && buybackRatio === null;
  const leverageInvalid = leverageInput.trim() !== "" && maxLeverage === null;
  const formReady = contractAddress.length > 0 && (buybackRatio !== null || maxLeverage !== null);
  const disabled =
    !enigmaActive || isSigningIn || update.isPending || (signedIn && (!formReady || buybackInvalid || leverageInvalid));

  function onSubmit() {
    if (!signedIn) {
      signIn();
      return;
    }
    if (accessToken === null || (buybackRatio === null && maxLeverage === null)) return;
    update.mutate({
      accessToken,
      tokenContractAddress: contractAddress,
      depositChain,
      // Send only the knobs the user filled in — an omitted one leaves their
      // current value untouched rather than resetting it.
      ...(buybackRatio === null ? {} : { buybackRatio }),
      ...(maxLeverage === null ? {} : { maxLeverage }),
    });
    // No marketConfig.refetch() here — useUpdateListingMarketConfig invalidates
    // getListingMarketConfig and getListingMarketDetail at the react level.
  }

  const poolBuyback = formatBlend(marketConfig.data?.buybackRatio);
  const poolLeverage = formatBlend(marketConfig.data?.maxLeverage);
  const yourBuyback = formatBlend(marketConfig.data?.userBuybackRatio);
  const yourLeverage = formatBlend(marketConfig.data?.userMaxLeverage);
  const newBuyback = formatBlend(projection.data?.projectedBuybackRatio);
  const newLeverage = formatBlend(projection.data?.projectedMaxLeverage);
  const share = projection.data ? `${(projection.data.share * 100).toFixed(2)}%` : DASH;

  const buybackHint = buybackInvalid
    ? `Enter a whole percent between ${LISTING_MARKET_CONFIG_BOUNDS.buybackRatio.min} and ${LISTING_MARKET_CONFIG_BOUNDS.buybackRatio.max}.`
    : "Share of profit used to buy back the pool's token. Leave blank to keep your current value.";
  const leverageHint = leverageInvalid
    ? `Enter a whole multiplier between ${LISTING_MARKET_CONFIG_BOUNDS.maxLeverage.min} and ${LISTING_MARKET_CONFIG_BOUNDS.maxLeverage.max}.`
    : "Highest leverage the pool offers traders. Leave blank to keep your current value.";

  return (
    <MethodCard
      testId="method-updateListingMarketConfig"
      name="updateListingMarketConfig"
      mutability="nonpayable"
      description="Market config — submit your max-leverage and buyback opinion for one pool. The service deposit-weights every LP's opinion, so this nudges the pool rather than overwriting it. Enigma-only."
      wide
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          size="sm"
          label="Pool buyback"
          value={poolBuyback === null ? DASH : `${poolBuyback}%`}
          testId="market-config-pool-buyback"
        />
        <Stat
          size="sm"
          label="Pool leverage"
          value={poolLeverage === null ? DASH : `${poolLeverage}x`}
          testId="market-config-pool-leverage"
        />
        <Stat size="sm" label="Your share" value={share} testId="market-config-share" />
        <Stat
          size="sm"
          label="Your buyback"
          value={yourBuyback === null ? DASH : `${yourBuyback}%`}
          hint="Blank until you have configured this pool."
          testId="market-config-your-buyback"
        />
        <Stat
          size="sm"
          label="Your leverage"
          value={yourLeverage === null ? DASH : `${yourLeverage}x`}
          testId="market-config-your-leverage"
        />
      </div>

      <Field label="buyback_ratio (%)" htmlFor="market-config-buyback" hint={buybackHint}>
        <Input
          id="market-config-buyback"
          data-testid="market-config-buyback"
          inputMode="numeric"
          value={buybackInput}
          onChange={(e) => setBuybackInput(e.target.value)}
          placeholder={yourBuyback ?? "50"}
          className="font-mono"
          disabled={update.isPending}
          aria-invalid={buybackInvalid}
        />
      </Field>

      <Field label="max_leverage (x)" htmlFor="market-config-leverage" hint={leverageHint}>
        <Input
          id="market-config-leverage"
          data-testid="market-config-leverage"
          inputMode="numeric"
          value={leverageInput}
          onChange={(e) => setLeverageInput(e.target.value)}
          placeholder={yourLeverage ?? "20"}
          className="font-mono"
          disabled={update.isPending}
          aria-invalid={leverageInvalid}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Stat
          size="sm"
          label="New pool buyback"
          value={newBuyback === null ? DASH : `~${newBuyback}%`}
          testId="market-config-new-buyback"
        />
        <Stat
          size="sm"
          label="New pool leverage"
          value={newLeverage === null ? DASH : `~${newLeverage}x`}
          hint="Deposit-weighted estimate. The exact figure is set when you save."
          testId="market-config-new-leverage"
        />
      </div>

      <Button type="button" size="sm" disabled={disabled} onClick={onSubmit} data-testid="market-config-submit">
        {update.isPending ? (
          <>
            <Spinner className="size-4" /> Saving…
          </>
        ) : isSigningIn ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : signedIn ? (
          "Save config"
        ) : (
          "Sign in first"
        )}
      </Button>

      {!enigmaActive ? (
        <ResultNote testId="market-config-gate">Switch to Enigma (HyperEVM) to configure a pool.</ResultNote>
      ) : update.error ? (
        <ResultError kind={update.error.kind} message={update.error.message} testId="market-config-error" />
      ) : update.isSuccess ? (
        <ResultSuccess testId="market-config-success">
          <span className="text-foreground/80 text-xs">
            Opinion recorded. The pool now reads {formatBlend(update.data?.buybackRatio) ?? DASH}% buyback and{" "}
            {formatBlend(update.data?.maxLeverage) ?? DASH}x leverage.
          </span>
        </ResultSuccess>
      ) : signedIn && contractAddress.length > 0 && marketConfig.error ? (
        <ResultNote testId="market-config-read-error">
          Could not read your current opinion ({marketConfig.error.message}). You can still submit one — the projection
          falls back to the pool value as its baseline.
        </ResultNote>
      ) : (
        <ResultNote testId="market-config-idle">
          {signedIn
            ? "Pick a pool above, then set a buyback percentage, a max leverage, or both. Capped at 5 updates per pool per day."
            : "Sign in to configure a pool."}
        </ResultNote>
      )}
    </MethodCard>
  );
}
