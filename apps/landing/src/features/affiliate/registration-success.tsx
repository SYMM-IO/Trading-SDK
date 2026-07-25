"use client";

import { siteLinks } from "@/lib/site";
import { AffiliateState } from "@symmio/trading-core";
import { useAffiliateState } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { motion } from "motion/react";
import { hyperEvm } from "wagmi/chains";
import { AddressReadout } from "./address-readout";
import { CheckIcon } from "./icons";
import { truncateAddress } from "./registration-utils";
import { StatusBadge, type StatusTone } from "./status-badge";
import type { RegistrationResult } from "./use-registration-form";

/** Presentation for each lifecycle state while the success screen polls. */
const STATE_VIEW: Record<AffiliateState, { label: string; body: string; tone: StatusTone }> = {
  [AffiliateState.NONE]: {
    label: "Confirming",
    body: "Your request is being indexed on-chain.",
    tone: "muted",
  },
  [AffiliateState.PENDING]: {
    label: "Pending approval",
    body: "A protocol admin will review and approve your affiliate.",
    tone: "primary",
  },
  [AffiliateState.ACTIVE]: {
    label: "Active",
    body: "Your affiliate is live and can attribute trades.",
    tone: "positive",
  },
  [AffiliateState.PAUSED]: {
    label: "Paused",
    body: "This affiliate is currently paused by an approver.",
    tone: "muted",
  },
};

const explorerUrl = hyperEvm.blockExplorers?.default.url;

interface SuccessProps {
  result: RegistrationResult;
  onRegisterAnother: () => void;
}

/**
 * The post-registration takeover. Confirms the request is on-chain (still
 * awaiting admin approval), presents the affiliate name and its permanent
 * address, and live-polls lifecycle state so the badge advances from confirming
 * → pending → active without a refresh. Celebration lives on the status checker
 * once the affiliate is actually `ACTIVE`.
 */
export function RegistrationSuccess({ result, onRegisterAnother }: SuccessProps) {
  /** The exact address the registration transaction created — never a fresh derivation. */
  const affiliate = result.affiliate;

  const { data: state } = useAffiliateState({
    affiliate,
    query: { refetchInterval: 12_000 },
  });

  const view = STATE_VIEW[state ?? AffiliateState.NONE];

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="border-primary/30 bg-primary/10 text-primary relative flex size-16 items-center justify-center rounded-2xl border"
      >
        <CheckIcon width={30} height={30} strokeWidth={2.5} />
      </motion.div>

      <div className="flex flex-col gap-3">
        <motion.h2
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          {result.name} is registered
        </motion.h2>
        <p className="text-muted-foreground text-base leading-7 text-pretty">
          Your request is on-chain and awaiting approval. Save the address below, then use Check status to track when it
          goes live.
        </p>
      </div>

      {/* Live status */}
      <StatusBadge label={view.label} tone={view.tone} />

      <div className="border-border/70 bg-card/70 flex w-full flex-col gap-5 rounded-2xl border p-6 text-left shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            Affiliate address
          </span>
          <AddressReadout address={affiliate} loading={!affiliate} full />
          <p className="border-primary/25 bg-primary/5 text-foreground/90 rounded-lg border px-3 py-2.5 text-xs leading-5">
            <span className="text-foreground font-semibold">Save this address.</span> It&apos;s how you check your
            registration&apos;s status later — the status page looks it up by address, so copy it somewhere safe before
            you leave this page.
          </p>
          <p className="text-muted-foreground text-xs leading-5">{view.body}</p>
        </div>

        <div className="border-border/60 flex flex-col gap-2 border-t pt-5">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Transaction</span>
          <div className="flex items-center gap-2">
            <code className="text-foreground font-mono text-sm">{truncateAddress(result.hash, 8)}</code>
            <CopyButton value={result.hash} label="Copy transaction hash" className="shrink-0" />
            {explorerUrl ? (
              <Button asChild size="sm" className="ml-auto">
                <a href={`${explorerUrl}/tx/${result.hash}`} target="_blank" rel="noreferrer">
                  View ↗
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={onRegisterAnother}>
          Register another
        </Button>
        <Button asChild>
          <a href={siteLinks.docs} target="_blank" rel="noreferrer">
            Read the SDK docs
          </a>
        </Button>
      </div>
    </div>
  );
}
