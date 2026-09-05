"use client";

import { SymmioSupportedChainId } from "@symmio/trading-core";
import { Button } from "@symmio/ui/components/button";
import { Card } from "@symmio/ui/components/card";
import { useSwitchChain } from "wagmi";
import { useSolverKindActive } from "../solvers/solver-target";

/**
 * Shown while the active chain is not HyperEVM: the listing backend and the
 * inventory service only exist behind the Enigma solver, so every card on the
 * page is idle until the chain is switched. One notice with the switch, up
 * top, instead of the same "switch to Enigma" line repeated in every card.
 */
export function PoolsChainNotice() {
  const enigmaActive = useSolverKindActive("enigma");
  const { switchChain, isPending } = useSwitchChain();

  if (enigmaActive) return null;

  return (
    <Card size="sm" className="animate-enter-up border-warning/30 bg-warning/5" data-testid="pools-chain-notice">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-sm font-medium">Pools live on HyperEVM</span>
          <span className="text-muted-foreground text-sm">
            The listing backend and the inventory service sit behind the Enigma solver, so every card here idles on any
            other chain.
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => switchChain({ chainId: SymmioSupportedChainId.HYPER_EVM })}
          data-testid="pools-switch-chain"
        >
          {isPending ? "Switching…" : "Switch to HyperEVM"}
        </Button>
      </div>
    </Card>
  );
}
