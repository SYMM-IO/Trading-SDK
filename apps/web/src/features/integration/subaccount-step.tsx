"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { useUserSubAccounts } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { cn } from "@symm-frontier/ui/lib/utils";
import { shortenAddress } from "@symm-frontier/utils";
import type { Address } from "viem";

interface Props {
  owner?: Address;
  selected?: Address;
  onSelect: (account: Address) => void;
}

/**
 * Wizard step for choosing a subaccount. The subaccount list is fetched here —
 * only while this step is mounted — rather than ahead of time, so data loads in
 * the step that needs it.
 */
export function SubaccountStep({ owner, selected, onSelect }: Props) {
  const subAccounts = useUserSubAccounts({ user: owner });
  const items = subAccounts.data ?? [];

  if (!owner) {
    return <ResultNote testId="subaccount-step-disconnected">Connect a wallet to load your subaccounts.</ResultNote>;
  }
  if (subAccounts.isLoading) {
    return <ListSkeleton rows={4} testId="subaccount-step-loading" />;
  }
  if (subAccounts.error) {
    return (
      <ResultError testId="subaccount-step-error" kind={subAccounts.error.kind} message={subAccounts.error.message} />
    );
  }
  if (items.length === 0) {
    return (
      <ResultNote testId="subaccount-step-empty">
        No subaccounts yet — create one on the{" "}
        <a href="/contracts/subaccounts" className="text-foreground underline underline-offset-2">
          Subaccounts
        </a>{" "}
        page.
      </ResultNote>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="subaccount-step-list">
      {items.map((sub) => {
        const active = sub.accountAddress === selected;
        return (
          <button
            key={sub.accountAddress}
            type="button"
            onClick={() => onSelect(sub.accountAddress)}
            data-testid={`subaccount-${sub.accountAddress}`}
            className={cn(
              "focus-visible:ring-ring/40 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
              active
                ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                : "border-border/70 hover:border-border hover:bg-muted/40",
            )}
          >
            <span className="flex flex-col">
              <span className="text-foreground text-sm leading-tight font-medium">{sub.name || "Unnamed"}</span>
              <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">
                {shortenAddress(sub.accountAddress)}
              </span>
            </span>
            {active ? <Badge variant="positive">Selected</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}
