"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { PartyAField } from "./party-a-field";

interface Props {
  /** Namespaces the field `id` and the picker's `data-testid`s. */
  idPrefix: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  /** Owner whose subaccounts seed the picker. Defaults to the connected wallet. */
  owner?: Address;
}

/**
 * Address field for a SYMMIO Virtual Account (VA). Uses the same chained picker
 * as {@link PartyAField} — the owner's subaccounts are expandable groups whose
 * VAs load lazily — but only a VA is selectable; the subaccount rows act purely
 * as navigation to reach their VAs. A pasted/typed VA address is still accepted.
 * Use this anywhere a `virtualAccount` is the input (addMargin, removeMargin, the
 * deallocate uPnL signature).
 */
export function VirtualAccountField(props: Props) {
  return <PartyAField {...props} selectable="va" />;
}
