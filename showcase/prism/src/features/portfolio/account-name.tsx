"use client";

import { Button } from "@/components/button";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { useEditAccountName } from "@symmio/trading-react";
import { useState } from "react";
import { GatedSubmit } from "./gated-submit";
import { useWriteToast } from "./use-write-toast";

export interface AccountNameProps {
  account: FundingAccount;
}

/**
 * The account's on-chain name, editable in place.
 *
 * `editAccountName` is a real transaction, not a local label — the name lives on
 * the AccountLayer, so it survives a new browser and shows up in every other
 * front-end reading the same sub-account. The SDK invalidates both the list read
 * and the single-account read on success, so the row re-renders itself.
 *
 * The editor stacks its buttons under the input because it lives in the
 * ledger's account cell, which is too narrow for all three on one line.
 */
export function AccountName({ account }: AccountNameProps) {
  const runWrite = useWriteToast();
  const editName = useEditAccountName();
  const [draft, setDraft] = useState<string | undefined>(undefined);

  const isEditing = draft !== undefined;
  const trimmed = (draft ?? "").trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 100 && trimmed !== account.name;

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setDraft(account.name)}
        title="Rename this account"
        className="group flex min-w-0 cursor-pointer items-center gap-1.5 text-left"
      >
        <span className="truncate font-display text-md font-semibold tracking-[-0.01em] text-fg-0">{account.name}</span>
        <PencilIcon />
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <input
        autoFocus
        value={draft}
        maxLength={100}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDraft(undefined);
        }}
        className="w-full min-w-0 rounded-sm border border-accent bg-bg-2 px-2 py-1 font-display text-md font-semibold text-fg-0 outline-none"
      />
      <div className="flex items-center gap-1.5">
        <GatedSubmit
          deployment={account.deployment}
          label="Save"
          size="sm"
          disabled={!canSave}
          loading={editName.isPending}
          onSubmit={() => {
            void runWrite({ pending: "Renaming account…", success: "Account renamed" }, async () => {
              const result = await editName.mutateAsync({
                account: account.address,
                name: trimmed,
                chainId: account.deployment.chainId,
              });
              setDraft(undefined);
              return result;
            });
          }}
        />
        <Button variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      width="11"
      height="11"
      fill="none"
      aria-hidden
      className="shrink-0 text-fg-3 opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100"
    >
      <path
        d="M9.4 1.9l2.7 2.7L4.6 12.1 1.4 12.6l.5-3.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
