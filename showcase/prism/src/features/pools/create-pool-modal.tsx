"use client";

import { Button } from "@/components/button";
import { Combobox } from "@/components/combobox";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { MicroLabel } from "@/components/panel";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { useWriteToast } from "@/features/portfolio/use-write-toast";
import { cn } from "@/lib/cn";
import { formatLeverage, shortenAddress } from "@/lib/format";
import { ListingDepositChainId, type CreatedPool, type ListingConfig } from "@symmio/trading-core";
import { useAddMarket, useListingConfig, useWeeklyListingLimit } from "@symmio/trading-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListingStatusPill, WarnGlyph } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn } from "./listing-sign-in";
import {
  ABSENT,
  depositChainColor,
  depositChainLabel,
  formatResetAt,
  listingStatusStyle,
  listingUsd,
  sharePercent,
} from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/** Share of trading fees the service treats as the norm for a new listing. */
const DEFAULT_BUY_BACK = "5";

/** Opening ceiling for a fresh lowcap market, in whole multiples. */
const DEFAULT_MAX_LEVERAGE = "20";

/** Inclusive bounds the listing service enforces on the buy-back ratio, in percent. */
const BUY_BACK_MIN = 0;
const BUY_BACK_MAX = 100;

/** Inclusive bounds the service enforces on max leverage, as a whole multiplier. */
const LEVERAGE_MIN = 1;
const LEVERAGE_MAX = 100;

/**
 * A primary action that navigates.
 *
 * `Button` renders a `<button>`, and a route change has to be an anchor for the
 * middle-click and the copy-link the reader will reach for on a page they were
 * told to track — so this carries the primary variant's geometry by hand.
 */
const TRACK_LINK = cn(
  "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-transparent bg-accent px-5",
  "text-lg font-semibold whitespace-nowrap text-fg-inverse",
  "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:brightness-110",
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
);

export interface CreatePoolModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * List a token — the one flow in Prism that creates a market instead of trading one.
 *
 * What it submits is an *application*, not a market. The service records the
 * token, resolves its name, ticker and decimals off the contract, and provisions
 * a custodial wallet to seed the pool; nothing is tradeable until the initial
 * deposit lands in that wallet. So the result panel leads with the deposit
 * address and the word "awaiting" rather than with a success tick.
 *
 * Two public reads frame the form and neither is decoration. The listing config
 * supplies the deposit chains — hardcoding that list is how an application gets
 * submitted for a chain the service will not take — and the deposit figures the
 * applicant has to meet. The weekly cap is protocol-wide rather than per wallet,
 * so it is stated above the form rather than discovered through a rejected
 * submit.
 *
 * Both numeric fields are range-checked here. In the SDK inspector the same two
 * inputs carried `min` / `max` as bare HTML attributes with no `<form>` around
 * them, so nothing enforced either bound and an out-of-range value reached the
 * backend; here an out-of-range field is marked invalid and the submit is dead.
 */
export function CreatePoolModal({ open, onClose }: CreatePoolModalProps) {
  const supported = usePoolsSupported();
  const session = useListingSession();
  const runWrite = useWriteToast();

  /* Gated on `open`, not just on support: the modal is mounted for the whole
     Pools screen, so an ungated read here would fetch the service config and
     the weekly cap on every catalog page view for a form nobody has opened. */
  const config = useListingConfig({ chainId: POOLS_CHAIN_ID, query: { enabled: supported && open } });
  const weekly = useWeeklyListingLimit({ chainId: POOLS_CHAIN_ID, query: { enabled: supported && open } });
  const create = useAddMarket({});

  const [token, setToken] = useState("");
  const [buyBack, setBuyBack] = useState(DEFAULT_BUY_BACK);
  const [leverage, setLeverage] = useState(DEFAULT_MAX_LEVERAGE);
  /* No default chain on purpose. The deposit wallet takes one token on one
     chain and nothing sent to the wrong one comes back, so the picker starts
     empty and the submit stays dead until the applicant names the chain. */
  const [depositChain, setDepositChain] = useState<ListingDepositChainId | undefined>(undefined);

  /* Re-opening starts a new application. Without this the previous listing's
     deposit wallet stays on screen while the next token is typed underneath it
     — one address, two tokens, and no way to tell which it belongs to. */
  const { reset } = create;
  useEffect(() => {
    if (!open) return;
    setToken("");
    setBuyBack(DEFAULT_BUY_BACK);
    setLeverage(DEFAULT_MAX_LEVERAGE);
    setDepositChain(undefined);
    reset();
  }, [open, reset]);

  const chainOptions = useMemo(
    () =>
      (config.data?.supportedDepositChains ?? []).map((chain) => ({
        value: String(chain.chainId),
        label: chain.chainName || depositChainLabel(chain.chainId),
        /* The SDK's own name for the chain, so searching "arbitrum" finds a row
           the service labelled "Arbitrum One" and vice versa. */
        keywords: depositChainLabel(chain.chainId),
      })),
    [config.data],
  );

  const trimmedToken = token.trim();
  const buyBackValue = parseBounded(buyBack, BUY_BACK_MIN, BUY_BACK_MAX);
  const leverageValue = parseBounded(leverage, LEVERAGE_MIN, LEVERAGE_MAX);

  /* A field only goes red once it holds something that cannot be sent. An empty
     required field blocks the submit without being accused of anything. */
  const buyBackInvalid = buyBack.trim().length > 0 && buyBackValue === undefined;
  const leverageInvalid = leverage.trim().length > 0 && leverageValue === undefined;

  /* Fails open while the cap is unread: the service enforces it server-side, so
     a failed read must not be the thing that stops a legitimate listing. */
  const capSpent = weekly.data ? weekly.data.remaining <= 0 : false;

  const created = create.data;
  const canSubmit =
    supported &&
    session.isSignedIn &&
    trimmedToken.length > 0 &&
    depositChain !== undefined &&
    buyBackValue !== undefined &&
    leverageValue !== undefined &&
    !capSpent &&
    !create.isPending;

  const onSubmit = () => {
    if (!canSubmit || depositChain === undefined || buyBackValue === undefined || leverageValue === undefined) return;
    void runWrite(
      {
        pending: "Submitting the listing…",
        success: "Listing application accepted",
        /* Warn, not long: the applicant has taken on an obligation — seed the
           wallet — rather than finished anything. */
        body: "Seed the deposit wallet the service returned to take the pool live.",
        tone: "warn",
        failure: "Listing not submitted",
      },
      async () => {
        const created = await create.mutateAsync({
          accessToken: session.accessToken,
          tokenContractAddress: trimmedToken,
          buyBackRatio: buyBackValue,
          maxLeverage: leverageValue,
          depositChain,
          chainId: POOLS_CHAIN_ID,
        });

        /* A listing spends one of the protocol's weekly slots, and the SDK's
           mutation invalidates only the two catalog queries — so without this
           the meter above (and the cap gate on this button) would keep showing
           the count from before the application for the rest of the session. */
        void weekly.refetch();

        return created;
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="wide"
      eyebrow="Listing service"
      title="List a token"
      footer={
        !supported ? null : created ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/pools/${created.depositChain}/${created.tokenContractAddress}`}
              onClick={onClose}
              className={TRACK_LINK}
            >
              Track the listing
            </Link>
            <Button variant="ghost" size="lg" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : !session.isSignedIn ? (
          <>
            <div className="flex justify-center">
              <ListingSignIn label="Sign in to list a token" />
            </div>
            <p className="text-center text-2xs text-fg-3">
              The listing service is custodial REST, not a contract — it takes an application over a signed session,
              never off a transaction.
            </p>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              Submit the listing
            </Button>
            <p className="text-center text-2xs text-fg-3">
              {capSpent && weekly.data
                ? `The protocol's weekly cap is spent — the next application can be submitted after ${formatResetAt(weekly.data.resetAt)} UTC.`
                : "This opens an application. The market only exists once the initial deposit lands."}
            </p>
          </>
        )
      }
    >
      {!supported ? (
        <EmptyState
          title={`No listing service on ${POOLS_DEPLOYMENT.chainName}`}
          body="Listing is a chain-level backend, and this chain carries no listing block in the SDK's registry. There is nothing to submit an application to."
        />
      ) : created ? (
        <ListingResult pool={created} config={config.data} isConfigLoading={config.isPending} />
      ) : (
        <>
          {weekly.error ? (
            <Notice tone="short">The weekly cap could not be read: {weekly.error.message}</Notice>
          ) : weekly.data ? (
            <WeeklyListingMeter
              limit={weekly.data.limit}
              remaining={weekly.data.remaining}
              resetAt={weekly.data.resetAt}
            />
          ) : (
            <Skeleton className="h-[70px] w-full" />
          )}

          {create.error ? <Notice tone="short">{create.error.message}</Notice> : null}

          <Field
            label="Token contract address"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            disabled={create.isPending}
            footnote="Not validated here — an EVM listing is 0x-prefixed and a Solana one is base58, and only the service knows which it will take. It reads the name, ticker and decimals off the contract itself."
          />

          <div className="flex flex-col gap-1.5">
            <MicroLabel>Deposit chain</MicroLabel>
            <Combobox
              label="Deposit chain"
              className="w-full"
              value={depositChain === undefined ? "" : String(depositChain)}
              onChange={(next) => setDepositChain(Number(next) as ListingDepositChainId)}
              options={chainOptions}
              searchable={chainOptions.length > 6}
              placeholder={config.isPending ? "Loading the service's chains…" : "Choose a chain"}
              disabled={create.isPending || chainOptions.length === 0}
              emptyText="The service listed no deposit chains"
            />
            <span className="px-1 text-2xs text-fg-3">
              Where the token lives and where its listing deposit must be sent. It is not where the perp settles — that
              is always {POOLS_DEPLOYMENT.chainName}.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Buy-back ratio"
              inputMode="decimal"
              value={buyBack}
              onChange={(event) => setBuyBack(event.target.value)}
              placeholder={DEFAULT_BUY_BACK}
              invalid={buyBackInvalid}
              disabled={create.isPending}
              adornment={<span className="font-mono text-sm text-fg-2">%</span>}
              footnote={
                buyBackInvalid
                  ? `Between ${BUY_BACK_MIN} and ${BUY_BACK_MAX}.`
                  : "Share of this market's trading fees spent buying the token back."
              }
            />
            <Field
              label="Max leverage"
              inputMode="numeric"
              value={leverage}
              onChange={(event) => setLeverage(event.target.value)}
              placeholder={DEFAULT_MAX_LEVERAGE}
              invalid={leverageInvalid}
              disabled={create.isPending}
              adornment={<span className="font-mono text-sm text-fg-2">×</span>}
              footnote={
                leverageInvalid
                  ? `Between ${LEVERAGE_MIN} and ${LEVERAGE_MAX}.`
                  : "The most leverage this market will ever offer a trader."
              }
            />
          </div>

          {config.error ? (
            <Notice tone="short">
              The listing service did not answer: {config.error.message}. Without it there is no deposit-chain list to
              pick from.
            </Notice>
          ) : (
            <DetailSection title="What it costs" note="From the listing service">
              <DetailRow
                label="Recommended first deposit"
                tip={{
                  title: "Recommended first deposit",
                  body: "What the service suggests seeding the pool with. Deposit less and the pool lists thinner, so its quotes move further per trade.",
                }}
                isLoading={config.isPending}
                value={
                  <Numeric size="sm" tone="strong">
                    {listingUsd(config.data?.recommendedInitialDepositUsdc, { exact: true })}
                  </Numeric>
                }
              />
              <DetailRow
                label="Minimum accepted"
                sub="after slippage"
                isLoading={config.isPending}
                value={
                  <Numeric size="sm">{listingUsd(config.data?.minimumInitialDepositUsdc, { exact: true })}</Numeric>
                }
              />
              <DetailRow
                label="Listing fee"
                isLoading={config.isPending}
                value={<Numeric size="sm">{listingUsd(config.data?.listingFeeUsdc, { exact: true })}</Numeric>}
              />
              <DetailRow
                label="Protocol share of revenue"
                sub="before buy-back and LPs"
                isLoading={config.isPending}
                value={<Numeric size="sm">{sharePercent(config.data?.protocolRewardSharePercent)}</Numeric>}
              />
            </DetailSection>
          )}

          {config.data ? <RateLimitNote limits={config.data} /> : null}
        </>
      )}
    </Modal>
  );
}

interface WeeklyListingMeterProps {
  limit: number;
  remaining: number;
  /** Unix timestamp of the window's reset, in whichever unit the service sent. */
  resetAt: number;
}

/**
 * The week's listing budget, as a meter.
 *
 * The cap is **protocol-wide**: every listing by every wallet draws on the same
 * allowance, so a full bar here is not a statement about this account and the
 * caption says so. A service reporting a zero cap would hand the meter an empty
 * range and a division by zero, so the scale floors at one and a zero cap reads
 * as spent — which is what a budget of nothing means.
 */
function WeeklyListingMeter({ limit, remaining, resetAt }: WeeklyListingMeterProps) {
  const used = Math.max(0, limit - remaining);
  const spent = remaining <= 0;
  const scale = Math.max(1, limit);
  const share = limit > 0 ? Math.min(1, used / limit) : 1;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-2 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <MicroLabel>Listings left this week</MicroLabel>
        <span className="flex items-baseline gap-1">
          <Numeric size="sm" tone={spent ? "warn" : "strong"}>
            {Math.max(0, remaining)}
          </Numeric>
          <span className="text-2xs text-fg-3">of</span>
          <Numeric size="sm" tone="muted">
            {limit}
          </Numeric>
        </span>
      </div>

      <span
        role="meter"
        aria-label="Weekly listings used across the protocol"
        aria-valuemin={0}
        aria-valuemax={scale}
        aria-valuenow={Math.min(used, scale)}
        aria-valuetext={`${used} of ${limit} listings used`}
        className="block h-[5px] w-full overflow-hidden rounded-full bg-bg-0"
      >
        <span
          aria-hidden
          className={cn("block h-full rounded-full", spent ? "bg-warn" : "bg-accent")}
          style={{ width: `${share * 100}%`, transition: "width var(--dur-slow) var(--ease-out)" }}
        />
      </span>

      <p className="text-2xs text-fg-3">
        Protocol-wide, not per wallet — resets <span className="tnum">{formatResetAt(resetAt)}</span> UTC.
      </p>
    </div>
  );
}

interface ListingResultProps {
  pool: CreatedPool;
  /** The same public config the form read — the deposit figures come from it. */
  config?: ListingConfig;
  isConfigLoading: boolean;
}

/**
 * What the service accepted, and the one thing still outstanding.
 *
 * The application is worth nothing until the initial deposit lands, so the
 * deposit wallet is the loudest thing on the panel and everything it will not
 * forgive — wrong chain, wrong token, a memo that does not exist — is spelled
 * out next to it rather than left for the applicant to assume.
 */
function ListingResult({ pool, config, isConfigLoading }: ListingResultProps) {
  const status = listingStatusStyle(pool.marketStatus);
  const chainName = depositChainLabel(pool.depositChain);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display text-xl font-bold tracking-[-0.02em] text-fg-0">
          {pool.tokenTicker || ABSENT}
        </span>
        <span className="min-w-0 truncate text-md text-fg-2">{pool.tokenName}</span>
        <ListingStatusPill status={pool.marketStatus} className="ml-auto" />
      </div>

      <div className="flex flex-col gap-1.5">
        <MicroLabel>Deposit wallet</MicroLabel>
        {pool.walletPublicKey ? (
          <div className="flex items-start gap-2 rounded-md border border-line bg-bg-2 px-3 py-2.5">
            <span className="tnum min-w-0 flex-1 font-mono text-sm break-all text-fg-0">{pool.walletPublicKey}</span>
            <CopyAction value={pool.walletPublicKey} label="Deposit wallet" />
          </div>
        ) : (
          <p className="rounded-md border border-line bg-bg-2 px-3 py-2.5 text-sm text-fg-2">
            The service accepted the application without returning a wallet yet. It appears on the pool&rsquo;s own page
            once custody has provisioned one.
          </p>
        )}
      </div>

      <Notice tone="warn">
        <p>
          Nothing is listed yet. The pool stays at <span className="text-fg-0">{status.label}</span> until the initial
          deposit arrives — traders cannot see this market before then.
        </p>
        <p>
          That address takes {pool.tokenTicker || "the token"} on {chainName} and nothing else. There is no memo, no
          amount field, and no recovery for a transfer sent on another chain or in another token.
        </p>
      </Notice>

      <DetailSection title="Seed it with" note="From the listing service">
        <DetailRow
          label="Recommended"
          isLoading={isConfigLoading}
          value={
            <Numeric size="sm" tone="strong">
              {listingUsd(config?.recommendedInitialDepositUsdc, { exact: true })}
            </Numeric>
          }
        />
        <DetailRow
          label="Minimum accepted"
          sub="after slippage"
          isLoading={isConfigLoading}
          value={<Numeric size="sm">{listingUsd(config?.minimumInitialDepositUsdc, { exact: true })}</Numeric>}
        />
      </DetailSection>

      <DetailSection title="As submitted">
        <DetailRow
          label="Token contract"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(pool.tokenContractAddress)}</span>}
          action={<CopyAction value={pool.tokenContractAddress} label="Token address" />}
        />
        <DetailRow
          label="Deposit chain"
          value={
            <span className="flex items-center gap-1.5 text-sm text-fg-1">
              <span
                aria-hidden
                className="size-[6px] shrink-0 rounded-full"
                style={{ background: depositChainColor(pool.depositChain) }}
              />
              {chainName}
            </span>
          }
        />
        <DetailRow label="Buy-back ratio" value={<Numeric size="sm">{sharePercent(pool.buyBackRatio)}</Numeric>} />
        <DetailRow label="Max leverage" value={<Numeric size="sm">{formatLeverage(pool.maxLeverage)}</Numeric>} />
        <DetailRow label="Token decimals" value={<Numeric size="sm">{pool.tokenDecimal}</Numeric>} />
        <DetailRow
          label="Main pool"
          sub={pool.mainPool ? undefined : "assigned once the deposit lands"}
          value={
            <span className="tnum text-sm text-fg-1">{pool.mainPool ? shortenAddress(pool.mainPool) : ABSENT}</span>
          }
        />
      </DetailSection>
    </>
  );
}

/**
 * The two rolling-24h caps that apply *after* listing.
 *
 * Prose rather than rows: they are a constraint on how often the market can be
 * retuned later, which is worth knowing before applying but is not one of the
 * figures being compared.
 */
function RateLimitNote({ limits }: { limits: ListingConfig }) {
  return (
    <p className="px-1 text-2xs leading-relaxed text-fg-3">
      Once listed, the market&rsquo;s config can be updated{" "}
      <span className="tnum">{limits.rateLimits.marketConfigUpdatesPerDay}</span> times and profit claimed{" "}
      <span className="tnum">{limits.rateLimits.profitClaimsPerDay}</span> times per rolling 24 hours, per market.
    </p>
  );
}

interface NoticeProps {
  /** `warn` for a consequence to read before acting; `short` for a failure. */
  tone: "warn" | "short";
  children: ReactNode;
}

/** A block the reader must not skim: an irreversible step, or a rejection. */
function Notice({ tone, children }: NoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        tone === "warn" ? "border-[var(--warn-500)]/35 bg-warn-bg" : "border-[var(--short-500)]/35 bg-short-bg",
      )}
    >
      <WarnGlyph className={cn("mt-0.5 size-3.5 shrink-0", tone === "warn" ? "text-warn" : "text-short")} />
      <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-relaxed text-fg-2">{children}</div>
    </div>
  );
}

/**
 * Parse one bounded economics field, or `undefined` when it cannot be sent.
 *
 * The empty check has to come first: `Number("")` is `0`, which is a legal
 * buy-back ratio, so an empty field would otherwise submit itself as zero.
 */
function parseBounded(input: string, min: number, max: number): number | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}
