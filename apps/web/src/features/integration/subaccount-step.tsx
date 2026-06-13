"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { TxReceipt } from "@/components/tx-result";
import { formatUsd } from "@/lib/format";
import {
  SubAccountIsolationType,
  useAccountBalanceOf,
  useCreateSubAccounts,
  useSymmioConfig,
  useUserSubAccounts,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { cn } from "@symm-frontier/ui/lib/utils";
import { shortenAddress } from "@symm-frontier/utils";
import { useEffect, useState } from "react";
import type { Address } from "viem";

interface Props {
  owner?: Address;
  selected?: Address;
  onSelect: (account: Address) => void;
}

/**
 * Wizard step for choosing a subaccount. The subaccount list is fetched here —
 * only while this step is mounted — rather than ahead of time, so data loads in
 * the step that needs it. Each card also surfaces the subaccount's available
 * balance so the user picks the right one at a glance.
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
    return <CreateSubaccountInline owner={owner} onCreated={() => void subAccounts.refetch()} />;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="subaccount-step-list">
      {items.map((sub) => (
        <SubAccountOption
          key={sub.accountAddress}
          address={sub.accountAddress}
          name={sub.name}
          active={sub.accountAddress === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface SubAccountOptionProps {
  address: Address;
  name?: string;
  active: boolean;
  onSelect: (account: Address) => void;
}

/**
 * One row in {@link SubaccountStep}. Wraps the per-row balance query so the
 * hook can be called once per item.
 */
function SubAccountOption({ address, name, active, onSelect }: SubAccountOptionProps) {
  const balance = useAccountBalanceOf({ account: address });

  return (
    <button
      type="button"
      onClick={() => onSelect(address)}
      data-testid={`subaccount-${address}`}
      className={cn(
        "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
        active
          ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
          : "border-border/70 hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground truncate text-sm leading-tight font-medium">{name || "Unnamed"}</span>
        <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">{shortenAddress(address)}</span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <BalanceLabel balance={balance} testId={`subaccount-${address}-balance`} />
        {active ? <Badge variant="positive">Selected</Badge> : null}
      </span>
    </button>
  );
}

/**
 * Inline create-subaccount form shown when the connected wallet has zero
 * subaccounts. Defaults `affiliate` + `symmioCore` to the chain config and uses
 * MARKET_DIRECTION isolation with `singleVAMode` on — same defaults the
 * standalone Subaccounts page suggests.
 */
function CreateSubaccountInline({ owner, onCreated }: { owner: Address; onCreated: () => void }) {
  const { addresses } = useSymmioConfig().getChainConfig();
  const [name, setName] = useState("");
  const mutation = useCreateSubAccounts();

  useEffect(() => {
    if (mutation.isSuccess) onCreated();
  }, [mutation.isSuccess, onCreated]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !mutation.isPending;

  function handleCreate() {
    if (!canSubmit) return;
    mutation.mutate({
      affiliate: addresses.affiliatesAddress,
      accountsData: [
        {
          name: trimmed,
          metadata: "0x",
          symmioCore: addresses.symmioAddress,
          isolationType: SubAccountIsolationType.MARKET_DIRECTION,
          singleVAMode: true,
        },
      ],
    });
  }

  return (
    <div
      className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4"
      data-testid="subaccount-step-create"
    >
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">No subaccounts yet</span>
        <span className="text-muted-foreground text-xs leading-5">
          Create one for {shortenAddress(owner)}. Defaults to MARKET_DIRECTION isolation with single-VA mode on — you
          can tune those later on the Subaccounts page.
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="subaccount-step-create-name"
          data-testid="subaccount-step-create-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My Trading Account"
          maxLength={100}
          className="sm:flex-1"
        />
        <Button type="button" onClick={handleCreate} disabled={!canSubmit} data-testid="subaccount-step-create-submit">
          {mutation.isPending ? <Spinner className="size-4" /> : null}
          {mutation.isPending ? "Creating…" : "Create subaccount"}
        </Button>
      </div>

      {mutation.error ? (
        <ResultError
          testId="subaccount-step-create-error"
          kind={mutation.error.kind}
          message={mutation.error.message}
        />
      ) : null}
      {mutation.isSuccess ? (
        <ResultSuccess testId="subaccount-step-create-success">
          <span className="text-foreground">Submitted. New subaccount appears once mined.</span>
          <TxReceipt
            hash={mutation.data.hash}
            receipt={
              mutation.data.receipt
                ? { blockNumber: mutation.data.receipt.blockNumber, status: String(mutation.data.receipt.status) }
                : undefined
            }
          />
        </ResultSuccess>
      ) : null}
    </div>
  );
}

function BalanceLabel({ balance, testId }: { balance: ReturnType<typeof useAccountBalanceOf>; testId: string }) {
  if (balance.isLoading) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" data-testid={`${testId}-loading`}>
        <Spinner className="size-3" />
      </span>
    );
  }
  if (balance.error) {
    return (
      <span className="text-destructive text-xs" data-testid={`${testId}-error`}>
        —
      </span>
    );
  }
  if (balance.data === undefined) {
    return (
      <span className="text-muted-foreground text-xs" data-testid={`${testId}-empty`}>
        —
      </span>
    );
  }
  return (
    <span className="text-foreground font-mono text-xs leading-tight" data-testid={`${testId}-data`}>
      {formatUsd(balance.data)}
    </span>
  );
}
