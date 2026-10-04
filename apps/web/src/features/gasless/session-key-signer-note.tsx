"use client";

import { KeyIcon } from "@/features/session-keys/session-key-icons";
import { shortenAddress } from "@symmio/utils";
import type { ReactNode } from "react";
import type { Address } from "viem";

interface Props {
  /**
   * The signer the action forwards — `useFlowWriteOption(...).from`. The note
   * renders only when it names the session key, so it can sit unconditionally
   * under the action.
   */
  signer?: Address;
  /** A condition this write adds, e.g. the grant it needs beyond the default set. */
  children?: ReactNode;
}

/**
 * One-line cue under a flow action that the session key, not the wallet, will
 * sign it. A flow has no key toggle of its own — it follows the wallet menu's
 * default — so without this a missing wallet prompt would be a surprise rather
 * than the point.
 */
export function SessionKeySignerNote({ signer, children }: Props) {
  if (!signer) return null;

  return (
    <p data-testid="session-key-signer-note" className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
      <KeyIcon filled className="text-primary mt-1 size-3.5 shrink-0" />
      <span>
        Signed by session key <span className="text-foreground font-mono">{shortenAddress(signer)}</span> — no wallet
        prompt, relayed with no gas. {children}
      </span>
    </p>
  );
}
