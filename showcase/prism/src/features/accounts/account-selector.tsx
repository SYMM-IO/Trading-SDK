"use client";

import { MarginModeTag } from "@/components/margin-mode-tag";
import { getDeployment, type MarketFamily } from "@/config/deployments";
import { accountEquity, isCrossMargin, spendableMargin } from "@/features/accounts/account-math";
import { useFundingAccounts, type FundingAccount } from "@/features/accounts/account-provider";
import { cn } from "@/lib/cn";
import { formatUsd, fromWei, shortenAddress } from "@/lib/format";
import { useWalletAccount } from "@symmio/trading-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface AccountSelectorProps {
  /** Which deployment's accounts to offer — funds never cross a family. */
  family: MarketFamily;
  className?: string;
}

/**
 * The account a trade settles against, named and switchable.
 *
 * A SYMMIO sub-account is the *counterparty of record* for every order: it
 * holds the margin, it is the address the solver quotes against, and a wallet
 * can hold several of them per chain. Leaving that choice implicit — as Prism
 * did, resolving silently to the first account in the list and mentioning it
 * only in the ticket's footnote — means the user cannot tell which balance a
 * click is about to spend.
 *
 * So it is stated where the order is placed, with the balance that actually
 * funds it, and the switch is one click away.
 */
export function AccountSelector({ family, className }: AccountSelectorProps) {
  const { isConnected } = useWalletAccount();
  const { byFamily, selected, select, isLoading } = useFundingAccounts();
  const [open, setOpen] = useState(false);

  const deployment = getDeployment(family);
  const accounts = byFamily[family];
  const active = selected[family];

  /* Close on Escape wherever focus is — the panel traps nothing, so the key
     has to be handled at the document. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!isConnected) {
    return (
      <div className={cn("flex flex-col items-end gap-0.5", className)}>
        <span className="text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">{deployment.label} account</span>
        <span className="text-sm text-fg-3">Connect a wallet</span>
      </div>
    );
  }

  if (isLoading && accounts.length === 0) {
    return (
      <div className={cn("flex flex-col items-end gap-1", className)}>
        <span className="prism-pulse block h-2.5 w-20 rounded-sm bg-bg-3" />
        <span className="prism-pulse block h-3 w-28 rounded-sm bg-bg-3" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Link
        href="/portfolio"
        className={cn(
          "flex items-center gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-1.5",
          "transition-colors duration-[var(--dur-fast)] hover:border-warn",
          className,
        )}
      >
        <WarnIcon />
        <span className="flex flex-col">
          <span className="text-2xs font-semibold tracking-[0.12em] text-warn uppercase">
            No {deployment.label.toLowerCase()} account
          </span>
          <span className="text-sm text-fg-2">Create one on {deployment.chainName} →</span>
        </span>
      </Link>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-bg-2 px-3 py-1.5",
          "transition-colors duration-[var(--dur-fast)] hover:border-line-strong",
          open ? "border-line-strong" : null,
        )}
      >
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Trading account · {deployment.chainName}
          </span>
          <span className="flex items-center gap-2">
            <span className="max-w-[150px] truncate font-display text-md font-semibold text-fg-0">
              {active ? active.name : "Select an account"}
            </span>
            <span className="tnum text-sm text-fg-2">
              {active ? formatUsd(fromWei(spendableMargin(active)), { exact: true }) : "—"}
            </span>
          </span>
        </span>
        <ChevronIcon />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label={`${deployment.label} accounts`}
            className="prism-rise absolute right-0 z-40 mt-2 flex w-[340px] flex-col rounded-lg border border-line bg-bg-1 shadow-[var(--shadow-pop)]"
          >
            <p className="border-b border-line-subtle px-3 py-2 text-2xs leading-relaxed text-fg-3">
              Orders on <span className="text-fg-1">{deployment.label}</span> settle against this sub-account on{" "}
              {deployment.chainName}. Balances never cross to {deployment.family === "majors" ? "Lowcaps" : "Majors"}.
            </p>

            <div className="max-h-[320px] overflow-y-auto">
              {accounts.map((account) => (
                <AccountOption
                  key={account.address}
                  account={account}
                  selected={account.address === active?.address}
                  onSelect={() => {
                    select(family, account.address);
                    setOpen(false);
                  }}
                />
              ))}
            </div>

            <Link
              href="/portfolio"
              onClick={() => setOpen(false)}
              className="border-t border-line-subtle px-3 py-2 text-sm text-accent transition-colors duration-[var(--dur-fast)] hover:bg-bg-2"
            >
              Manage accounts, deposit and withdraw →
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface AccountOptionProps {
  account: FundingAccount;
  selected: boolean;
  onSelect: () => void;
}

/** One row of the account list: identity, margin model, and spendable margin. */
function AccountOption({ account, selected, onSelect }: AccountOptionProps) {
  /* Cross-margin vs isolated Virtual Accounts is a property of the sub-account,
     not of the chain — the SDK says to branch on the isolation type, so the row
     reports what this account actually is rather than what its solver usually
     does, and reads its balance out of the pot that model actually spends. */
  const crossMargin = isCrossMargin(account);
  const free = fromWei(spendableMargin(account));
  const equity = fromWei(accountEquity(account));

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1.5 px-3 py-2.5 text-left",
        "transition-colors duration-[var(--dur-fast)] hover:bg-bg-2",
        selected ? "bg-bg-2" : null,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-md font-semibold text-fg-0">{account.name}</span>
        {selected ? <CheckIcon /> : null}
      </span>

      <span className="flex items-center gap-2">
        <span className="tnum text-2xs text-fg-3">{shortenAddress(account.address)}</span>
        <MarginModeTag crossMargin={crossMargin} variant="full" className="ml-auto" />
      </span>

      <span className="flex items-baseline gap-3 text-2xs text-fg-3">
        <span>
          Free{" "}
          <span className={cn("tnum", free > 0 ? "text-fg-1" : "text-warn")}>{formatUsd(free, { exact: true })}</span>
        </span>
        <span>
          Equity <span className="tnum text-fg-2">{formatUsd(equity, { exact: true })}</span>
        </span>
      </span>
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0 text-fg-3" aria-hidden>
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0 text-accent" aria-hidden>
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0 text-warn" aria-hidden>
      <path d="M7 1.5 13 12H1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 5.5v3M7 10.2v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
