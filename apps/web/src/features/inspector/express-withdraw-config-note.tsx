"use client";

import { ResultNote } from "@/components/result";
import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";

/**
 * Explains why Express reads fail (or routes fall back to classic) on a chain
 * with no Express Withdraw service. Renders nothing once the connected chain is
 * a v0.8.6 deployment with an `expressWithdraw` block.
 */
export function ExpressWithdrawConfigNote() {
  const chainId = useSymmioChainId();
  const chain = useSymmioConfig().getChainConfig(chainId);
  if (chain.contractsVersion === "0.8.6" && chain.expressWithdraw) return null;

  return (
    <ResultNote testId="express-withdraw-config-note">
      Express Withdraw is not configured on chain {chainId}: service reads fail and routes fall back to classic. Apply
      the Staging preset from the config panel to try it.
    </ResultNote>
  );
}
