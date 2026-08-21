"use client";

import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import { useEffect, useState } from "react";
import type { Address } from "viem";

export interface AccountAddressProps {
  address: Address;
  /** Characters kept at each end. Ignored when `full` is set. */
  lead?: number;
  tail?: number;
  /** Show the whole address rather than a shortened one. */
  full?: boolean;
  /** `2xs` for a caption under a name, `sm` for an address that is the line's subject. */
  size?: "2xs" | "sm";
  className?: string;
}

/**
 * An on-chain address, copyable in one click.
 *
 * A sub-account's address is what a solver sees, and the session key's is what
 * a grant names — both get pasted into explorers and support threads, so
 * copying is the primary action and the button is the whole thing.
 *
 * The affordance is a glyph rather than the word "copy": the address already
 * spends the cell's width, and in a column of them the repeated label read as
 * part of the data. The tick that replaces it is the confirmation, in place.
 */
export function AccountAddress({
  address,
  lead = 6,
  tail = 4,
  full = false,
  size = "2xs",
  className,
}: AccountAddressProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      title={address}
      aria-label={copied ? "Address copied" : `Copy address ${address}`}
      onClick={() => {
        void navigator.clipboard?.writeText(address);
        setCopied(true);
      }}
      className={cn(
        "group tnum flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-sm transition-colors duration-[var(--dur-fast)]",
        size === "sm" ? "text-sm text-fg-1 hover:text-fg-0" : "text-2xs text-fg-3 hover:text-fg-1",
        className,
      )}
    >
      <span className="truncate">{full ? address : shortenAddress(address, lead, tail)}</span>
      <span
        className={cn(
          "shrink-0 transition-colors duration-[var(--dur-fast)]",
          copied ? "text-long" : "text-fg-3 group-hover:text-fg-1",
        )}
      >
        {copied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
      </span>
    </button>
  );
}

interface IconProps {
  size: "2xs" | "sm";
}

function CopyIcon({ size }: IconProps) {
  const px = size === "sm" ? 13 : 11;

  return (
    <svg viewBox="0 0 14 14" width={px} height={px} fill="none" aria-hidden>
      <rect x="5.1" y="1.4" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9 10.6v.6a1.8 1.8 0 0 1-1.8 1.8H3.2a1.8 1.8 0 0 1-1.8-1.8V7.2a1.8 1.8 0 0 1 1.8-1.8h.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ size }: IconProps) {
  const px = size === "sm" ? 13 : 11;

  return (
    <svg viewBox="0 0 14 14" width={px} height={px} fill="none" aria-hidden>
      <path
        d="M2.6 7.4 5.5 10.3 11.4 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
