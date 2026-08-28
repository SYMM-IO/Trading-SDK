"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { cn } from "@/lib/cn";
import { ListingMarketStatus, type ListingDepositChainId, type ListingStatus } from "@symmio/trading-core";
import { useListingStatus } from "@symmio/trading-react";
import { ListingStatusPill, WarnGlyph } from "./listing-chips";
import { listingStatusStyle } from "./listing-values";
import { POOLS_CHAIN_ID, usePoolsSupported } from "./pools-deployment";

/**
 * The lifecycle states the pipeline has finished on.
 *
 * Only `WAITING_FOR_DEPOSIT` and `UNDER_REVIEW` can still move on their own, so
 * these three end the poll: a rejected listing is not retried, and a listed or
 * delisted market needs a new listing, not another read.
 */
const SETTLED = new Set<ListingMarketStatus>([
  ListingMarketStatus.LISTED,
  ListingMarketStatus.REJECTED,
  ListingMarketStatus.DELISTED,
]);

/** Re-read cadence for an unsettled listing — and what the hint promises. */
const POLL_MS = 5_000;

interface PipelineCopy {
  /** Headline: what state the listing is in, in the reader's words. */
  title: string;
  /** What unblocks it, and what stays unavailable until it does. */
  body: string;
}

const PIPELINE_COPY: Record<ListingMarketStatus, PipelineCopy> = {
  [ListingMarketStatus.WAITING_FOR_DEPOSIT]: {
    title: "Waiting for the listing deposit",
    body: "No market exists yet. The listing service creates one once the listing deposit lands at this pool’s own custodial deposit wallet, and the steps below run from there. Until it does there is no symbol for the solver to quote, so nothing here can be traded.",
  },
  [ListingMarketStatus.UNDER_REVIEW]: {
    title: "This listing is under review",
    body: "The deposit landed and the listing service is working through the steps below. The market reaches the book — with a symbol the solver can quote — only after the last one passes.",
  },
  [ListingMarketStatus.REJECTED]: {
    title: "This listing was rejected",
    body: "The pipeline stopped before a market was created, so there is nothing to quote or trade. The marked step is where it stopped, and a rejected listing does not resume on its own.",
  },
  [ListingMarketStatus.DELISTED]: {
    title: "This market was delisted",
    body: "The solver no longer quotes it, so the trade side is gone. LP balances, rewards and history stay readable — a delisted pool is closed for new business rather than erased.",
  },
  [ListingMarketStatus.LISTED]: {
    title: "Listed, with a step still erroring",
    body: "The market is live on the book; this panel is here only because the listing service still reports an error on a pipeline step. That is a listing job failing, not the market’s quotes.",
  },
};

/** Copy for a state the SDK's enum does not name. The pipeline still renders. */
const UNKNOWN_COPY: PipelineCopy = {
  title: "This listing is still in the pipeline",
  body: "The listing service reported a state Prism has no copy for, so the pipeline below is shown exactly as it came back.",
};

export interface ListingStatusPanelProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's deposit chain: the other half of the pair that names a market. */
  chainId: ListingDepositChainId;
  /**
   * The status the market **detail** already resolved, when it has.
   *
   * Passed in so a live pool stays silent instead of flashing this panel for
   * the length of one request: without it, every pool page would render a
   * placeholder banner and then take it away again.
   */
  marketStatus?: ListingMarketStatus;
}

/**
 * Why this pool is not tradable yet.
 *
 * The rest of a pool page is numbers about a market that exists. This panel is
 * the exception and only earns its space while the market does *not* — so a
 * listing that has settled on `LISTED` with no step error renders nothing at
 * all. A permanent green "all fine" banner on every live pool is noise, and the
 * header pill already says the pool is live.
 *
 * The read is public despite being per-market: no bearer token and no session,
 * so it answers for a visitor who has never signed in. It polls while the
 * listing can still move and stops the moment it settles.
 */
export function ListingStatusPanel({ address, chainId, marketStatus }: ListingStatusPanelProps) {
  const supported = usePoolsSupported();

  const status = useListingStatus({
    tokenContractAddress: address,
    depositChain: chainId,
    /* Addressed at the pools chain, never the connected one — the listing
       backend is resolved from the chain config, and a wallet sitting on Base
       must still be able to read a HyperEVM listing. */
    chainId: POOLS_CHAIN_ID,
    query: {
      enabled: supported && address.length > 0,
      refetchInterval: (query) => {
        /* Stop on a failure as well as on a settled listing. A pipeline read
           that errors is usually an endpoint that is not going to answer, and
           polling it every five seconds for as long as the page is open is a
           request loop nobody sees. */
        if (query.state.status === "error") return false;
        const current = query.state.data?.marketStatus;
        return current !== undefined && SETTLED.has(current) ? false : POLL_MS;
      },
    },
  });

  const pipeline = status.data;
  /* The detail's answer stands in until the pipeline read lands, which is what
     keeps the boring case below from flickering into view first. */
  const state = pipeline?.marketStatus ?? marketStatus;
  const style = state === undefined ? undefined : listingStatusStyle(state);
  const copy = pipelineCopy(state);

  /* A live pool with a clean pipeline is the boring case: say nothing. The
     error half of the test matters — a listed market can still carry a failed
     step, and that is worth a banner even though the market itself trades. */
  if (state === ListingMarketStatus.LISTED && !pipeline?.errorDetail) return null;

  /* Nothing to explain: the chain carries no listing backend, or the page has
     no address to key the read on. */
  if (!supported || address.length === 0) return null;

  /* Neither read has answered yet, so it is not yet known whether this panel
     applies. Claiming space now would move the page under the reader for the
     common case, where the answer turns out to be "live, render nothing". */
  if (!pipeline && !status.error && state === undefined) return null;

  const statusPill = state === undefined ? null : <ListingStatusPill status={state} dot />;

  if (!pipeline && status.error) {
    return (
      <Panel>
        <PanelHeader eyebrow="Listing pipeline" title="Listing pipeline unavailable" actions={statusPill} />
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-2.5 rounded-md border border-warn/40 bg-warn-bg px-3 py-2.5">
            <WarnGlyph />
            <p className="max-w-[92ch] text-sm text-fg-1">
              {status.error.message} — the pool’s own figures are unaffected; only where this listing sits in the
              pipeline is unknown.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const settled = state !== undefined && SETTLED.has(state);

  return (
    <Panel>
      <PanelHeader
        eyebrow="Listing pipeline"
        title={copy.title}
        actions={
          <>
            {settled ? null : <PollingHint />}
            {statusPill}
          </>
        }
      />

      <div className="flex flex-col gap-4 px-4 py-3.5">
        <p className="max-w-[92ch] text-sm leading-relaxed text-fg-2">{copy.body}</p>

        {pipeline ? <PipelineBody pipeline={pipeline} accent={style?.color ?? "var(--fg-2)"} /> : <PipelineSkeleton />}
      </div>
    </Panel>
  );
}

/** The read has fired but not answered, and the detail says the pool is not live. */
function PipelineSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-full max-w-[38ch]" />
      <Skeleton className="h-3 w-full max-w-[22ch]" />
    </div>
  );
}

/** The steps rail plus the retry counter — everything the service reported. */
function PipelineBody({ pipeline, accent }: { pipeline: ListingStatus; accent: string }) {
  return (
    <>
      {pipeline.steps.length > 0 ? (
        <StepRail steps={pipeline.steps} currentStep={pipeline.currentStep} accent={accent} />
      ) : (
        <p className="text-sm text-fg-3">
          {pipeline.currentStep ? (
            <>
              The service named the step <span className="font-mono text-fg-1">{pipeline.currentStep}</span> without
              listing the pipeline it belongs to.
            </>
          ) : (
            "The service reported no pipeline steps for this listing."
          )}
        </p>
      )}

      <RetryCounter count={pipeline.retryCount} limit={pipeline.retryLimit} />

      {pipeline.errorDetail ? <StepErrorBand code={pipeline.errorCode} detail={pipeline.errorDetail} /> : null}
    </>
  );
}

/**
 * The steps, left to right, with the one the listing sits on marked.
 *
 * Horizontal on purpose: the question a reader has is "how far along is this,
 * and which of the N steps is it stuck on", and a vertical checklist answers
 * the first half only by making them count.
 */
function StepRail({ steps, currentStep, accent }: { steps: string[]; currentStep: string | null; accent: string }) {
  /* `-1` covers both "not in a step" and a step name absent from the list; in
     either case nothing is marked done, because "before the current one" has
     no meaning without a current one. */
  const currentIndex = currentStep === null ? -1 : steps.indexOf(currentStep);

  return (
    <ol aria-label="Listing pipeline steps" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = currentIndex > index;

        return (
          <li
            key={`${index}-${step}`}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-1.5"
          >
            {index > 0 ? (
              <span aria-hidden className={cn("h-px w-5 shrink-0", isDone ? "bg-line-strong" : "bg-line")} />
            ) : null}
            <StepDot isCurrent={isCurrent} isDone={isDone} accent={accent} />
            <MicroLabel tone={isCurrent ? "strong" : isDone ? "default" : "muted"}>{stepLabel(step)}</MicroLabel>
          </li>
        );
      })}
    </ol>
  );
}

/** Filled for a passed step, filled and pulsing for the current one, hollow ahead. */
function StepDot({ isCurrent, isDone, accent }: { isCurrent: boolean; isDone: boolean; accent: string }) {
  if (isCurrent) {
    return <span aria-hidden className="prism-pulse size-[7px] shrink-0 rounded-full" style={{ background: accent }} />;
  }
  if (isDone) {
    return <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-fg-3" />;
  }
  return <span aria-hidden className="size-[7px] shrink-0 rounded-full border border-line-strong" />;
}

/** How many times the current step has been retried, and against what ceiling. */
function RetryCounter({ count, limit }: { count: number; limit: number }) {
  /* "0 / 0" is the service reporting nothing, not a step with no retries left:
     the SDK normalizes both absent counters to `0`, so the pair only carries
     meaning once one of them is non-zero. */
  const reported = count > 0 || limit > 0;
  const exhausted = reported && limit > 0 && count >= limit;

  return (
    <div className="flex items-center gap-2">
      <MicroLabel>Retries on this step</MicroLabel>
      <Numeric size="sm" tone={!reported ? "muted" : exhausted ? "warn" : "default"}>
        {`${count} / ${limit}`}
      </Numeric>
      {reported ? null : <span className="text-2xs text-fg-3">not reported</span>}
    </div>
  );
}

/** The current step's failure, verbatim, with the service's own code beside it. */
function StepErrorBand({ code, detail }: { code: number | null; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-[var(--short-500)]/40 bg-short-bg px-3 py-2.5">
      <WarnGlyph className="mt-px size-3.5 shrink-0 text-short" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel tone="short">Step error</MicroLabel>
          {code === null ? null : <span className="tnum font-mono text-2xs text-fg-3">code {code}</span>}
        </div>
        <p className="max-w-[92ch] text-sm leading-relaxed text-fg-1">{detail}</p>
      </div>
    </div>
  );
}

/** Says the page updates itself, so an unsettled reader does not sit reloading. */
function PollingHint() {
  return (
    <span className="flex items-center gap-1.5 text-2xs whitespace-nowrap text-fg-3">
      <span aria-hidden className="prism-pulse size-[5px] shrink-0 rounded-full bg-fg-3" />
      Polling every {POLL_MS / 1000}s
    </span>
  );
}

/**
 * Copy for a lifecycle state.
 *
 * Looked up rather than indexed blind: `marketStatus` is a wire value the
 * service can extend between releases, and the enum only carries what the SDK
 * knew when it shipped.
 */
function pipelineCopy(state: ListingMarketStatus | undefined): PipelineCopy {
  if (state === undefined) return UNKNOWN_COPY;
  return PIPELINE_COPY[state] ?? UNKNOWN_COPY;
}

/**
 * Turn a pipeline step into a label.
 *
 * The steps are wire strings — the SDK types them `string[]` and the service
 * owns the vocabulary, so one can arrive snake_cased, kebabbed or camelCased,
 * and a new step can appear without an SDK release. Splitting on every
 * separator and letting the label render uppercase keeps an unknown token
 * readable instead of guessing at prose for it.
 */
function stepLabel(step: string): string {
  return step
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}
