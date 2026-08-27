"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { ListingDepositChainId, ListingMarketStatus } from "@symmio/trading-core";
import { useListingConfig, useListingStatus } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Input } from "@symmio/ui/components/input";
import { cn } from "@symmio/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { LISTING_STATUS_DISPLAY } from "./format-listing-value";

/** Lifecycle statuses at which the listing has settled and no longer needs polling. */
const SETTLED_STATUSES = new Set<ListingMarketStatus>([
  ListingMarketStatus.LISTED,
  ListingMarketStatus.REJECTED,
  ListingMarketStatus.DELISTED,
]);

/**
 * "Listing status" — a market's lifecycle status and where it sits in the listing
 * backend's pipeline: the current step, all steps, retry count/limit, and any step
 * error.
 *
 * A **public** read (no sign-in): enter a market's token address and pick its
 * deposit chain and the card reads `getListingStatus`. While the listing is still
 * progressing it polls every few seconds, stopping once the status settles
 * (listed / rejected / delisted). Deposit chains come from
 * {@link useListingConfig}, mirroring the create-pool card.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing cards.
 */
export function ListingStatusCard() {
  const enigmaActive = useSolverKindActive("enigma");

  const config = useListingConfig();
  const chains = useMemo(() => config.data?.supportedDepositChains ?? [], [config.data]);

  const [tokenContractAddress, setTokenContractAddress] = useState("");
  const [depositChain, setDepositChain] = useState<ListingDepositChainId>(ListingDepositChainId.HYPER_EVM);

  // Keep the selection valid once the config's chains land.
  useEffect(() => {
    if (chains.length > 0 && !chains.some((chain) => chain.chainId === depositChain)) {
      setDepositChain(chains[0]!.chainId);
    }
  }, [chains, depositChain]);

  const address = tokenContractAddress.trim();
  const status = useListingStatus({
    tokenContractAddress: address,
    depositChain,
    query: {
      enabled: enigmaActive && address.length > 0,
      refetchInterval: (query) => {
        const current = query.state.data?.marketStatus;
        // Poll while the listing is still progressing; stop once it settles.
        return current && SETTLED_STATUSES.has(current) ? false : 5000;
      },
    },
  });

  const statusDisplay = status.data ? LISTING_STATUS_DISPLAY[status.data.marketStatus] : undefined;

  return (
    <MethodCard
      testId="method-getListingStatus"
      name="getListingStatus"
      mutability="view"
      description="Listing status — a market's lifecycle status and where it sits in the listing pipeline (current step, steps, retries, errors), by token address and deposit chain. Public; polls while the listing is still progressing. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="listing-status-gate">
          Switch to Enigma (HyperEVM) to read a market&rsquo;s listing status.
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="tokenContractAddress" htmlFor="listing-status-token">
            <Input
              id="listing-status-token"
              data-testid="listing-status-token"
              value={tokenContractAddress}
              onChange={(e) => setTokenContractAddress(e.target.value)}
              placeholder="0x…"
              className="font-mono"
            />
          </Field>

          <Field label="depositChain" htmlFor="listing-status-chain">
            <select
              id="listing-status-chain"
              data-testid="listing-status-chain"
              value={depositChain}
              onChange={(e) => setDepositChain(Number(e.target.value) as ListingDepositChainId)}
              disabled={config.isPending}
              className="border-border bg-input/40 h-9 w-full rounded-md border px-3 text-sm"
            >
              {chains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.chainName} ({chain.chainId})
                </option>
              ))}
            </select>
          </Field>

          {address.length === 0 ? (
            <ResultNote testId="listing-status-idle">Enter a market address to read its listing status.</ResultNote>
          ) : status.error ? (
            <ResultError kind={status.error.kind} message={status.error.message} testId="listing-status-error" />
          ) : status.isPending || status.data === undefined ? (
            <ResultNote testId="listing-status-loading" loading>
              Loading the listing status…
            </ResultNote>
          ) : (
            <div className="flex flex-col gap-4" data-testid="listing-status">
              <div className="border-info/30 bg-info/5 grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1" data-testid="listing-status-market">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status</span>
                  <Badge variant={statusDisplay?.variant ?? "outline"} className="w-fit">
                    {statusDisplay?.label ?? status.data.marketStatus}
                  </Badge>
                </div>
                <Stat
                  label="Current step"
                  value={status.data.currentStep ?? "—"}
                  hint="Where the listing pipeline is now."
                />
                <Stat
                  label="Retries"
                  value={`${status.data.retryCount} / ${status.data.retryLimit}`}
                  hint="Retries taken on the current step."
                />
              </div>

              {status.data.steps.length > 0 ? (
                <ol className="flex flex-col gap-1.5" data-testid="listing-status-steps">
                  {status.data.steps.map((step) => {
                    const active = step === status.data.currentStep;
                    return (
                      <li
                        key={step}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          active ? "text-foreground font-medium" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn("size-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")}
                          aria-hidden
                        />
                        {step}
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {status.data.errorDetail ? (
                <ResultError
                  kind={status.data.errorCode ?? undefined}
                  message={status.data.errorDetail}
                  testId="listing-status-step-error"
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </MethodCard>
  );
}
