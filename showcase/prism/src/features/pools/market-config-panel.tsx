"use client";

import { Button } from "@/components/button";
import { Chips } from "@/components/chips";
import { DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { LeverageSlider } from "@/components/leverage-slider";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import { useWriteToast } from "@/features/portfolio/use-write-toast";
import { cn } from "@/lib/cn";
import { formatLeverage } from "@/lib/format";
import { LISTING_MARKET_CONFIG_BOUNDS, type ListingDepositChainId } from "@symmio/trading-core";
import {
  useListingConfig,
  useListingMarketConfig,
  useListingMarketConfigProjection,
  useListingMarketDetail,
  useUpdateListingMarketConfig,
  useUserProfit,
  type SymmioRequestError,
} from "@symmio/trading-react";
import { useState, type ReactNode } from "react";
import { WarnGlyph } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn, ListingSignInPrompt } from "./listing-sign-in";
import { ABSENT, sharePercent } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/** Buy-back quick-picks, as the chips render them. The unit is part of the label. */
const BUYBACK_PRESETS = ["0%", "5%", "25%", "50%", "100%"] as const;

export interface MarketConfigPanelProps {
  /** The pool's token contract address — `0x…` on an EVM chain, base58 on Solana. */
  address: string;
  /** The pool's deposit chain, which is where its token lives, not where the perp settles. */
  chainId: ListingDepositChainId;
}

/**
 * This LP's opinion on the pool's max leverage and buy-back ratio.
 *
 * ## What the write actually does
 *
 * It does not set the pool. Every LP submits an opinion and the listing service
 * folds them into a **deposit-weighted average**, so a submit nudges the pool by
 * this wallet's share of it and by nothing more. That is why the panel leads
 * with two figures rather than one — what is in force pool-wide, and what this
 * wallet contributed to it — and why the projection below the editor is the
 * point of the screen: a 3% LP moving their opinion from 20× to 5× moves the
 * pool by less than half a multiple, and a form that showed only the entered
 * value would imply otherwise.
 *
 * ## Four percentage conventions meet here, and only one of them is a rate
 *
 * The listing backend uses the 18-decimal scale for money and for rates, and
 * neither convention applies to this endpoint:
 *
 * - `maxLeverage`, `buybackRatio`, `userMaxLeverage`, `userBuybackRatio` and the
 *   projection's `projected*` are **plain whole integers**. `50` is 50%, `20` is
 *   20×. Running them through `listingRate` — the helper every other figure on
 *   this feature needs — descales by `1e18` and renders 50% as `0.00%`.
 * - `ListingMarketConfigProjection.share` is a **`0..1` fraction** and is the one
 *   field here that needs `× 100` before it reads as a percent.
 *
 * So percentages go through `sharePercent` (a plain number that already is a
 * percentage) and leverage through `formatLeverage`, which is exactly what
 * `pool-header` and `pool-row` already do with the same two fields.
 *
 * ## Gating
 *
 * Every read is addressed to `POOLS_CHAIN_ID` explicitly, including the
 * projection's — see the note on that hook below. The write is custodial REST
 * behind a bearer token, not a transaction, so it carries no chain gate: the
 * only wallet-on-HyperEVM requirement in the whole Pools surface is the
 * signature `ListingSignIn` asks for.
 */
export function MarketConfigPanel({ address, chainId }: MarketConfigPanelProps) {
  const supported = usePoolsSupported();
  const session = useListingSession();
  const runWrite = useWriteToast();

  const enabled = supported && session.isSignedIn && address.length > 0;

  /* The caller's own opinion plus the pool values in force. Both string inputs
     self-gate inside the hook, so the `enabled` here is about the chain and the
     session rather than about the arguments. */
  const marketConfig = useListingMarketConfig({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled },
  });

  /* The public read is mounted for one reason: `getListingMarketConfig` can
     `404` on a backend where only the write is deployed, and the pool's own
     values live on the detail too. Reading them from here keeps the "in force"
     column populated when the authed read is missing — and it costs nothing,
     because the detail is already in the cache under this exact key (the pool
     page and the projection below both address it with the same `chainId`). */
  const detail = useListingMarketDetail({
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && address.length > 0 },
  });

  /* The stake the service weights this opinion by. The projection hook mounts
     the same query internally with the same key, so asking for it here is one
     request between the two of them, not two. */
  const profit = useUserProfit({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    chainId: POOLS_CHAIN_ID,
    query: { enabled },
  });

  /* Public, and the only place the update cap is published. */
  const listingConfig = useListingConfig({ chainId: POOLS_CHAIN_ID, query: { enabled: supported } });

  const update = useUpdateListingMarketConfig({});

  /* `null` means untouched, which is not the same as empty: an untouched knob is
     omitted from the write and the LP's current value survives, while an empty
     buy-back field is an attempt to send something unsendable. Keeping the two
     apart in one piece of state is why these are nullable rather than seeded
     from the server value with a separate `touched` flag beside them. */
  const [leverage, setLeverage] = useState<number | null>(null);
  const [buyback, setBuyback] = useState<string | null>(null);

  /* Counted in this browser only — see `UpdateCapMeter`. */
  const [submittedHere, setSubmittedHere] = useState(0);

  const bounds = LISTING_MARKET_CONFIG_BOUNDS;

  /* The write half answers with a full `ListingMarketConfig` — the recorded
     opinion and the re-blended pool figures — so a save receipt is a second,
     equally authoritative source for what this wallet thinks. It is checked
     against the pool it was recorded for because the route can swap `address`
     under a mounted panel without resetting the mutation, and a receipt from
     the previous pool is worse than none. */
  const receipt =
    update.data !== undefined &&
    update.data.tokenContractAddress.toLowerCase() === address.toLowerCase() &&
    update.data.depositChain === chainId
      ? update.data
      : undefined;

  /* The receipt is read *second* so a fresh read stays authoritative once it
     lands, and *at all* because otherwise two windows show a dash where a
     recorded figure exists: while the invalidated read is in flight, and
     forever on a backend that ships the POST of `/v2/market/config` without the
     GET (see `opinionUnknown`). Both windows also re-arm the unchanged-value
     guard below, which is what turns a stale baseline into a wasted update. */
  const priorLeverage = marketConfig.data?.userMaxLeverage ?? receipt?.userMaxLeverage ?? null;
  const priorBuyback = marketConfig.data?.userBuybackRatio ?? receipt?.userBuybackRatio ?? null;
  const poolLeverage = marketConfig.data?.maxLeverage ?? detail.data?.maxLeverage ?? null;
  const poolBuyback = marketConfig.data?.buybackRatio ?? detail.data?.buybackRatio ?? null;

  /* The editor opens on what this LP already thinks, falling back to the pool's
     own value so the first move is a nudge from where the pool actually is
     rather than from the bottom of the scale. */
  const leverageValue = leverage ?? clampToBounds(priorLeverage ?? poolLeverage ?? bounds.maxLeverage.min);
  const buybackSeed = priorBuyback ?? poolBuyback;
  const buybackText = buyback ?? (buybackSeed === null ? "" : String(buybackSeed));
  const buybackParsed = parseWholePercent(buybackText);
  const buybackInvalid = buybackText.trim().length > 0 && buybackParsed === null;

  /* A knob reaches the request only when it has been moved **and** it differs
     from what the service already holds for this wallet. Re-sending an
     unchanged value is not free: the endpoint counts it against the rolling
     cap and the pool does not move. */
  const submitLeverage = leverage !== null && leverage !== priorLeverage ? leverage : undefined;
  const submitBuyback =
    buyback !== null && buybackParsed !== null && buybackParsed !== priorBuyback ? buybackParsed : undefined;
  const hasEdit = submitLeverage !== undefined || submitBuyback !== undefined;

  /**
   * The projection's `chainId` is load-bearing.
   *
   * This hook is not a react-query result — it takes a **top-level** `enabled`
   * (not `query.enabled`), returns `{ data, isLoading, error }` with no
   * `isPending` and no `refetch`, and composes three reads of its own. Omit the
   * `chainId` and its inner `useListingMarketDetail` resolves the *connected*
   * chain instead: the key forks from the detail above so the page fetches it
   * twice, and the read throws `LISTING_NOT_CONFIGURED` outright whenever the
   * wallet sits on a chain with no listing backend — which is most of them.
   */
  const projection = useListingMarketConfigProjection({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    buybackRatio: submitBuyback,
    maxLeverage: submitLeverage,
    enabled,
  });

  if (!supported) {
    return (
      <Panel>
        <PanelHeader eyebrow="Listing service" title="Market config" />
        <EmptyState
          title="No listing backend on this chain"
          body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK's chain registry, so there is no pool configuration to read or contribute to.`}
        />
      </Panel>
    );
  }

  if (!session.isSignedIn) {
    return (
      <Panel>
        <PanelHeader eyebrow="Listing service" title="Market config" />
        <ListingSignInPrompt>
          Leverage and buy-back are set by the LPs, weighted by what each of them deposited — so the service will only
          tell you your own opinion, and only take a new one, over a signed session.
        </ListingSignInPrompt>
      </Panel>
    );
  }

  const position = profit.data;
  const stake = position?.userBalanceInTokens;
  const hasStake = stake !== undefined && stake > 0n;
  /* Skeleton while either source could still deliver a pool value, not while
     both are in flight: a `404` on the authed read settles it instantly and
     would otherwise flip the column to a dash while the public detail — the
     fallback the dash would be wrong about — is still loading. */
  const isReading = poolLeverage === null && (marketConfig.isPending || detail.isPending);

  /* A `404` here is not a failure. The write and the read share `/v2/market/config`
     and the service ships them separately, so a backend can take an opinion
     without being able to hand one back. The SDK's own JSDoc says to read it as
     "opinion unknown" — a red band would tell the LP something is broken when
     the only thing missing is the prefill. */
  const opinionUnknown = isNotFound(marketConfig.error);
  const readFailed = marketConfig.error !== null && !opinionUnknown;

  /* Three states, not two. "None recorded" is a claim about the service's
     records, and it is only honest when something actually answered — the
     authed read, or this session's own save receipt. When neither did (a `404`,
     a failure) the truthful word is that the opinion is *not readable*: an LP
     who recorded 5% last week sees exactly the same dash, and telling them they
     have no opinion on file would invite them to spend an update re-recording
     one they already hold. */
  const opinionAnswered = marketConfig.data !== undefined || receipt !== undefined;
  const opinionReading = !opinionAnswered && marketConfig.isPending;
  const opinionUnreadable = !opinionAnswered && !opinionReading;
  const yoursNote = opinionUnreadable
    ? "not readable"
    : opinionAnswered && priorLeverage === null && priorBuyback === null
      ? "none recorded"
      : undefined;

  /* `LISTING_MARKET_CONFIG_BOUNDS` caps this editor at 20×, while `addMarket`
     takes up to 100× and the create-pool form enforces that — so a pool listed
     above 20× cannot be represented on the slider at all. Saying so is the only
     honest option: the service publishes no bounds endpoint, and guessing which
     of the two ceilings is real would either dead-end a legitimate submit or
     spend the LP's rejection on finding out. */
  const ceilingConflict = poolLeverage !== null && poolLeverage > bounds.maxLeverage.max;

  const cap = listingConfig.data?.rateLimits.marketConfigUpdatesPerDay;
  const canSubmit = hasStake && hasEdit && !buybackInvalid && !update.isPending;

  const onSubmit = () => {
    if (!canSubmit) return;
    void runWrite(
      {
        pending: "Recording your opinion…",
        success: "Opinion recorded",
        body: "The service re-blends every LP's opinion by deposit weight; the pool's own figures follow.",
        failure: "Opinion not recorded",
      },
      async () => {
        const next = await update.mutateAsync({
          accessToken: session.accessToken,
          tokenContractAddress: address,
          depositChain: chainId,
          chainId: POOLS_CHAIN_ID,
          ...(submitLeverage === undefined ? {} : { maxLeverage: submitLeverage }),
          ...(submitBuyback === undefined ? {} : { buybackRatio: submitBuyback }),
          /* The one call on this panel that is not a read of the LP's own data.
             `updateListingMarketConfig` defaults this to `true`, which quietly
             runs `getDepositAddress` — a get-**or-create** that provisions a
             custodial wallet. `your-position-panel` deliberately hides that same
             call behind an explicit button and a warn band, because a wrong-token
             or wrong-chain send to a freshly minted wallet is unrecoverable, and
             a config form must not do by accident what the app elsewhere refuses
             to do without being asked. It is safe to skip here precisely because
             the editor only exists for an LP with a live stake: the only way
             tokens reach this pool is through that deposit wallet, so a non-zero
             balance is proof the address already exists. */
          ensureDepositAddress: false,
        });

        /* Reconciled by *clearing* the editor rather than by copying the receipt
           into it. The seeds above already re-derive from `priorLeverage` /
           `priorBuyback`, which now prefer that same receipt, so the slider and
           the field land on exactly what was recorded either way — but only
           `null` also disarms the unchanged-value guard. Seeding the state with
           the receipt would leave `leverage !== null`, and the guard would then
           have to prove `leverage === priorLeverage` against a baseline that may
           be a slow refetch or a `404`; when it cannot, the LP can press Save
           again on an identical value and spend one of five updates on a write
           that moves the pool by nothing. `null` means "not moved", which is a
           fact about this form and needs no server to confirm it. */
        setLeverage(null);
        setBuyback(null);
        setSubmittedHere((count) => count + 1);
        return next;
      },
    );
  };

  return (
    /* Bounded rather than full-bleed: this is a form and a short receipt, and an
       input line stretched across a 1400px page is unusable to aim at. */
    <Panel className="w-full max-w-[880px]">
      <PanelHeader eyebrow="Listing service" title="Market config" actions={<ListingSignIn />} />

      <div className="flex flex-col gap-4 p-4">
        <p className="max-w-[80ch] text-sm leading-relaxed text-fg-2">
          The pool does not take one LP&rsquo;s word for its configuration. Everyone who has deposited submits an
          opinion on the two knobs below, and the service holds the deposit-weighted average of all of them — so what
          you save here moves the pool by your share of it, not to the number you typed.
        </p>

        {opinionUnknown ? (
          <ConfigNotice tone="neutral">
            This backend does not answer the read half of <span className="font-mono">/v2/market/config</span> yet, so{" "}
            {receipt
              ? "the figures under “Yours” are this session’s own save receipt rather than a fresh read — an opinion you recorded from another browser would not appear there."
              : "your recorded opinion cannot be shown."}{" "}
            Submitting still works, and the projection uses the pool’s own value as its baseline instead of yours —
            which makes it an approximation rather than an exact shift.
          </ConfigNotice>
        ) : readFailed ? (
          <ConfigNotice tone="short">
            Your recorded opinion could not be read: {marketConfig.error?.message}. The pool values below come from the
            public market detail instead.
          </ConfigNotice>
        ) : null}

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailSection title="In force" note="Every LP, by deposit">
            <DetailRow
              label="Max leverage"
              value={
                <Numeric size="sm" tone="strong">
                  {formatLeverage(poolLeverage)}
                </Numeric>
              }
              isLoading={isReading}
            />
            <DetailRow
              label="Buy-back ratio"
              tip={{
                title: "Buy-back ratio",
                body: "The share of this market's revenue spent buying its own token back. It is a percentage the service stores as a whole number — 50 means 50%.",
              }}
              value={
                <Numeric size="sm" tone="strong">
                  {sharePercent(poolBuyback)}
                </Numeric>
              }
              isLoading={isReading}
            />
          </DetailSection>

          <DetailSection title="Yours" note={yoursNote}>
            <DetailRow
              label="Your max leverage"
              value={
                <Numeric size="sm" tone={opinionTone(priorLeverage, opinionAnswered)}>
                  {priorLeverage === null ? ABSENT : formatLeverage(priorLeverage)}
                </Numeric>
              }
              isLoading={opinionReading}
            />
            <DetailRow
              label="Your buy-back ratio"
              value={
                <Numeric size="sm" tone={opinionTone(priorBuyback, opinionAnswered)}>
                  {priorBuyback === null ? ABSENT : sharePercent(priorBuyback)}
                </Numeric>
              }
              isLoading={opinionReading}
            />
            <DetailRow
              label="Your weight"
              tip={{
                title: "Deposit weight",
                body: "How much of the blend is yours. It is a deposit-value share, not a token count: the pool's USDC carries no opinion, so the token share is scaled down by the USDC sitting beside it. The SDK reports it as a 0–1 fraction; this is that figure as a percentage.",
              }}
              value={
                <Numeric size="sm" tone={projection.data && projection.data.share > 0 ? "accent" : "muted"}>
                  {projection.data ? sharePercent(projection.data.share * 100) : ABSENT}
                </Numeric>
              }
              isLoading={projection.isLoading}
            />
          </DetailSection>
        </div>

        {ceilingConflict ? (
          <ConfigNotice tone="warn">
            This pool is listed at {formatLeverage(poolLeverage)}, above the {formatLeverage(bounds.maxLeverage.max)}{" "}
            ceiling the SDK publishes for this editor — so the slider below cannot express the pool&rsquo;s current
            figure. The listing form and this one disagree about the ceiling, the service publishes no bounds endpoint,
            and it is the service that decides: an out-of-range value comes back as a 422.
          </ConfigNotice>
        ) : null}

        {!hasStake ? (
          <NoStakeNotice isLoading={profit.isPending} failed={profit.error !== null} />
        ) : (
          <>
            <EditorSection title="Set your opinion" note="At least one knob">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <LeverageSlider
                    value={leverageValue}
                    onChange={setLeverage}
                    min={bounds.maxLeverage.min}
                    max={bounds.maxLeverage.max}
                    disabled={update.isPending}
                  />
                  <span className="px-1 text-2xs text-fg-3">
                    {submitLeverage === undefined
                      ? "Unchanged — this knob will not be sent, and your current value stands."
                      : `Will be sent as ${formatLeverage(submitLeverage)}, the highest leverage you want this pool to offer.`}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Field
                    label="Buy-back ratio"
                    inputMode="numeric"
                    value={buybackText}
                    onChange={(event) => setBuyback(event.target.value)}
                    placeholder={String(bounds.buybackRatio.min)}
                    invalid={buybackInvalid}
                    disabled={update.isPending}
                    adornment={<span className="font-mono text-sm text-fg-2">%</span>}
                    footnote={
                      buybackInvalid
                        ? `A whole percent between ${bounds.buybackRatio.min} and ${bounds.buybackRatio.max}. The service stores no fractions.`
                        : submitBuyback === undefined
                          ? "Unchanged — this knob will not be sent, and your current value stands."
                          : `Will be sent as ${sharePercent(submitBuyback)} of revenue spent buying the token back.`
                    }
                  />
                  <Chips
                    options={BUYBACK_PRESETS}
                    value={BUYBACK_PRESETS.find((preset) => preset === `${buybackText.trim()}%`)}
                    onChange={(preset) => setBuyback(preset.replace("%", ""))}
                    /* The presets edit the same state the field does, so they
                       have to freeze with it: a chip pressed mid-flight rewrites
                       the value under a write that has already left, and the
                       success receipt would then describe a number the editor no
                       longer shows. */
                    disabled={update.isPending}
                  />
                </div>
              </div>
            </EditorSection>

            {hasEdit ? (
              <DetailSection title="If you save this" note="Estimate">
                <DetailRow
                  label="Pool max leverage"
                  value={
                    <Numeric size="sm" tone={submitLeverage === undefined ? "muted" : "strong"}>
                      {projectedText(
                        submitLeverage !== undefined,
                        projection.data?.projectedMaxLeverage,
                        formatLeverage,
                      )}
                    </Numeric>
                  }
                  sub={submitLeverage === undefined ? "not being sent" : undefined}
                  isLoading={projection.isLoading}
                />
                <DetailRow
                  label="Pool buy-back ratio"
                  value={
                    <Numeric size="sm" tone={submitBuyback === undefined ? "muted" : "strong"}>
                      {projectedText(submitBuyback !== undefined, projection.data?.projectedBuybackRatio, sharePercent)}
                    </Numeric>
                  }
                  sub={submitBuyback === undefined ? "not being sent" : undefined}
                  isLoading={projection.isLoading}
                />
              </DetailSection>
            ) : (
              <p className="px-1 text-2xs text-fg-3">
                Move the slider or the buy-back field to see where the pool lands. Nothing is sent until you save, and a
                knob you leave alone keeps the value the service already holds for you.
              </p>
            )}

            {projection.error && !opinionUnknown ? (
              <p className="px-1 text-2xs text-short">The projection is unavailable: {projection.error.message}</p>
            ) : null}

            <UpdateCapMeter limit={cap} usedHere={submittedHere} isLoading={listingConfig.isPending} />

            {update.error ? <ConfigNotice tone="short">{describeUpdateError(update.error, cap)}</ConfigNotice> : null}

            {receipt ? (
              <p className="px-1 text-2xs text-fg-3">
                Recorded. The pool now reads{" "}
                <span className="tnum text-fg-1">{sharePercent(receipt.buybackRatio)}</span> buy-back at{" "}
                <span className="tnum text-fg-1">{formatLeverage(receipt.maxLeverage)}</span>.
              </p>
            ) : null}

            <Button variant="primary" size="lg" loading={update.isPending} disabled={!canSubmit} onClick={onSubmit}>
              Save your opinion
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

interface EditorSectionProps {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}

/**
 * A titled block of controls, ruled like a `DetailSection`.
 *
 * `DetailSection` cannot be used for the editor: its body is a `<dl>`, and a
 * slider is not a definition of the term beside it. The header markup is
 * repeated rather than abstracted because it is three elements, and the two
 * blocks have to line up on the same rule to read as one panel.
 */
function EditorSection({ title, note, children }: EditorSectionProps) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <MicroLabel>{title}</MicroLabel>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-line-subtle" />
        {note ? <span className="text-2xs whitespace-nowrap text-fg-3">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

interface UpdateCapMeterProps {
  /** The service's cap, from `getListingConfig`. `undefined` while it is unread. */
  limit?: number;
  /** Successful saves made on this page since it loaded. */
  usedHere: number;
  isLoading: boolean;
}

/**
 * The rolling-24h update cap.
 *
 * Deliberately **not** the weekly listing meter's shape. That cap reports a
 * `remaining`, so a fill bar is a fact; this one does not — the service
 * publishes the limit and nothing else, and the window is per user, per pool,
 * rolling. The only figure that can honestly be filled in is what this browser
 * has spent since the page loaded, so that is what the bar shows and what the
 * caption scopes. Inventing a "remaining" from it would let a reader who saved
 * twice yesterday believe they have five left today.
 */
function UpdateCapMeter({ limit, usedHere, isLoading }: UpdateCapMeterProps) {
  if (isLoading || limit === undefined) return null;

  const scale = Math.max(1, limit);
  const spentHere = usedHere >= limit;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-2 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <MicroLabel>Updates per rolling 24h</MicroLabel>
        <span className="flex items-baseline gap-1">
          <Numeric size="sm" tone={spentHere ? "warn" : "strong"}>
            {usedHere}
          </Numeric>
          <span className="text-2xs text-fg-3">of</span>
          <Numeric size="sm" tone="muted">
            {limit}
          </Numeric>
        </span>
      </div>

      <span
        role="meter"
        aria-label="Config updates saved on this page"
        aria-valuemin={0}
        aria-valuemax={scale}
        aria-valuenow={Math.min(usedHere, scale)}
        aria-valuetext={`${usedHere} of ${limit} updates saved on this page`}
        className="block h-[5px] w-full overflow-hidden rounded-full bg-bg-0"
      >
        <span
          aria-hidden
          className={cn("block h-full rounded-full", spentHere ? "bg-warn" : "bg-accent")}
          style={{
            width: `${Math.min(1, usedHere / scale) * 100}%`,
            transition: "width var(--dur-slow) var(--ease-out)",
          }}
        />
      </span>

      <p className="text-2xs text-fg-3">
        Per wallet, per pool. The bar counts only what you saved on this page — the service does not report how much of
        the window you have already spent, and answers a 429 once it is gone.
      </p>
    </div>
  );
}

interface NoStakeNoticeProps {
  isLoading: boolean;
  /** The position read failed, so whether there is a stake is unknown. */
  failed: boolean;
}

/**
 * Why the editor is absent.
 *
 * An LP with no deposit has a weight of zero, so their opinion would move the
 * blend by nothing — a live form here would take five inputs and a signature to
 * change one figure by zero. It is also the case that submitting would mint a
 * custodial deposit wallet as a side effect (see `ensureDepositAddress` above),
 * which is a consequential thing to do on the way to a no-op.
 */
function NoStakeNotice({ isLoading, failed }: NoStakeNoticeProps) {
  if (isLoading) {
    return <p className="px-1 text-2xs text-fg-3">Reading your stake in this pool…</p>;
  }

  return (
    <ConfigNotice tone={failed ? "short" : "neutral"}>
      {failed
        ? "Your stake in this pool could not be read, so there is no way to tell what weight an opinion from this wallet would carry. The editor stays closed rather than sending one blind."
        : "You hold none of this pool, so an opinion from this wallet would be weighted at zero and the pool would not move. Deposit from the pool's overview tab first — the weight follows the deposit."}
    </ConfigNotice>
  );
}

interface ConfigNoticeProps {
  /** `warn` for a consequence, `short` for a failure, `neutral` for a missing capability. */
  tone: "warn" | "short" | "neutral";
  children: ReactNode;
}

/** A band the reader must not skim: a rejection, a caveat, or a gap in the backend. */
function ConfigNotice({ tone, children }: ConfigNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        tone === "warn"
          ? "border-[var(--warn-500)]/35 bg-warn-bg"
          : tone === "short"
            ? "border-[var(--short-500)]/35 bg-short-bg"
            : "border-line bg-bg-2",
      )}
    >
      {tone === "neutral" ? null : (
        <WarnGlyph className={cn("mt-0.5 size-3.5 shrink-0", tone === "warn" ? "text-warn" : "text-short")} />
      )}
      <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-relaxed text-fg-2">{children}</div>
    </div>
  );
}

/**
 * One projected pool figure.
 *
 * `projected*` is `null` both when the knob was not entered and when the pool's
 * own value is unknown, and those read as different things: a knob nobody
 * touched is "unchanged", a figure the service never reported is a dash.
 */
function projectedText(included: boolean, projected: number | null | undefined, render: (value: number) => string) {
  if (!included) return "Unchanged";
  if (projected === null || projected === undefined) return ABSENT;
  /* The `~` is not decoration. The service rounds the blend it stores, and this
     is a first-order estimate off a baseline that may itself be the pool value
     rather than this LP's prior opinion. */
  return `~${render(projected)}`;
}

/**
 * Tone for one figure under "Yours".
 *
 * A dash there carries two meanings and they are not interchangeable: the
 * service answered and holds nothing for this wallet, or nothing answered at
 * all. Muting the first is right — it is a settled, unremarkable fact, and the
 * section note says so. Muting the second would dress an unknown up as a
 * recorded zero, so it takes `warn` instead: the dash is a gap in the backend,
 * and the band above the section says which gap.
 */
function opinionTone(value: number | null, answered: boolean): "default" | "muted" | "warn" {
  if (!answered) return "warn";
  return value === null ? "muted" : "default";
}

/**
 * Parse the buy-back field, or `null` when it cannot be sent.
 *
 * Whole numbers only: the wire field takes an integer percent, so a `19.5`
 * typed here would be rounded somewhere the reader cannot see. The empty check
 * comes first because `Number("")` is `0`, which is a legal buy-back ratio and
 * would otherwise submit an untouched field as "spend nothing on buy-backs".
 */
function parseWholePercent(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return null;
  if (value < LISTING_MARKET_CONFIG_BOUNDS.buybackRatio.min || value > LISTING_MARKET_CONFIG_BOUNDS.buybackRatio.max) {
    return null;
  }
  return value;
}

/** Keep a server-supplied leverage inside the editor's own range. See `ceilingConflict`. */
function clampToBounds(value: number): number {
  const { min, max } = LISTING_MARKET_CONFIG_BOUNDS.maxLeverage;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Whether a failed read is the service saying "this route is not deployed". */
function isNotFound(error: SymmioRequestError | null): boolean {
  return error !== null && error.kind === "api" && error.status === 404;
}

/**
 * Turn a rejected save into the sentence that explains it.
 *
 * The three statuses this endpoint answers with mean three different things and
 * only one of them is worth retrying, so the raw message — which is the
 * service's own prose — is kept but framed.
 */
function describeUpdateError(error: SymmioRequestError, limit?: number): string {
  if (error.kind === "api" && error.status === 429) {
    const cap = limit === undefined ? "the" : `all ${limit}`;
    return `You have used ${cap} updates this pool allows in a rolling 24 hours. The next one is accepted once the oldest falls out of the window.`;
  }
  if (error.kind === "api" && error.status === 422) {
    return `The service refused the value: ${error.message}. It publishes no bounds, so it is the authority on what it will take — the range this form enforces is the listing team's UI, not a contract.`;
  }
  if (error.kind === "api" && error.status === 401) {
    return "The session expired. Sign in again and re-save — nothing was recorded.";
  }
  return error.message;
}
