"use client";

import { PartyAField } from "@/features/inspector/party-a-field";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { LiveResult, type LiveQueryLike } from "./live-result";
import type { MagicMethodPanelProps } from "./magic-types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Args passed to a partyA-method's live-query hook. */
export interface PartyALiveArgs {
  /** Resolved partyA (zero address while the input is invalid — pair with `active`). */
  partyA: Address;
  /** Whether to actually run the source. */
  active: boolean;
  /** Poll cadence in milliseconds. */
  intervalMs: number;
}

interface Config {
  /** Namespaces the field id / picker test ids. */
  idPrefix: string;
  /** Field label. */
  label: string;
  /** Hook that runs the live source for the given partyA + cadence. */
  useLiveQuery: (args: PartyALiveArgs) => LiveQueryLike;
}

/**
 * Build a magic-method panel for any read keyed by a single partyA address. The
 * returned component renders a {@link PartyAField}, gates the source until a
 * valid address is entered, and streams the response into {@link LiveResult}.
 */
export function makePartyALivePanel(config: Config) {
  const { idPrefix, label, useLiveQuery } = config;

  return function PartyALivePanel({ intervalMs, enabled, initialInput }: MagicMethodPanelProps) {
    const [input, setInput] = useState(() => initialInput ?? "");
    const partyA = isAddress(input) ? (input as Address) : undefined;
    const active = enabled && Boolean(partyA);
    const query = useLiveQuery({ partyA: partyA ?? ZERO_ADDRESS, active, intervalMs });

    return (
      <div className="flex flex-col gap-3">
        <PartyAField
          idPrefix={idPrefix}
          label={label}
          value={input}
          onValueChange={setInput}
          invalid={input.length > 0 && !partyA}
        />
        <LiveResult query={query} active={active} idleHint="Enter a partyA address to start polling." />
      </div>
    );
  };
}
