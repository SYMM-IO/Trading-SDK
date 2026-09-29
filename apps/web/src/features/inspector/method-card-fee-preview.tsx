"use client";

import { GaslessFeePreview } from "@/features/gasless/gasless-fee-preview";
import { useGaslessWriteMode } from "@/features/gasless/gasless-write-mode-store";
import type { Address } from "viem";

/** What a relayable write card feeds its gasless fee preview. */
export interface MethodCardGaslessFee {
  /** The account the relayed write runs under and is billed to — a virtual account's parent for a margin write. */
  account?: Address;
  /**
   * The write's arguments as the contract function takes them, or `undefined`
   * while the card's inputs cannot build them yet. Where an argument does not
   * move the fee — an amount, an off-chain signature fetched at send time — a
   * placeholder keeps the estimate on screen while the rest is filled in: the
   * GaslessLayer prices a write by its selector and its payer, not its values.
   */
  args?: readonly unknown[];
}

interface Props {
  /** The card's method name — also the relayable function the preview prices. */
  method: string;
  /** The card's relay block, when its inputs cause one. */
  blockedReason?: string;
  fee: MethodCardGaslessFee;
  testId: string;
}

/**
 * The fee line a relayable write card closes with — shown only while the card's
 * next write will actually relay (its relay toggle, its session key, or the
 * chain config), since a wallet-paid write owes the GaslessLayer nothing.
 */
export function MethodCardFeePreview({ method, blockedReason, fee, testId }: Props) {
  const mode = useGaslessWriteMode(method, { blockedReason });
  if (!mode.available || !mode.enabled) return null;

  return (
    <GaslessFeePreview
      account={fee.account}
      calls={fee.args ? [{ functionName: method, args: fee.args }] : undefined}
      labels={[method]}
      testId={testId}
    />
  );
}
