"use client";

import { cn } from "@symmio/ui/lib/utils";
import { useChainId, useSwitchChain } from "wagmi";

/** Short display names for the switcher chips; falls back to the chain's own name. */
const CHAIN_SHORT_NAMES: Record<number, string> = {
  8453: "Base",
  999: "HyperEVM",
  42161: "Arbitrum",
};

/**
 * Compact chain switcher for the site header: one chip per configured wagmi
 * chain (HyperEVM, Base, Arbitrum). Clicking a chip asks the connected wallet to switch
 * networks; the active chain is highlighted. Rendered on every page so the
 * target chain — and with it the target solver (Enigma vs Rasa) — is always
 * one click away.
 */
export function ChainSwitcher() {
  const activeChainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();

  return (
    <div
      className="border-border/70 hidden items-center gap-0.5 rounded-xl border p-0.5 @sm/header:inline-flex"
      data-testid="chain-switcher"
      role="group"
      aria-label="Switch network"
    >
      {chains.map((chain) => {
        const active = chain.id === activeChainId;
        return (
          <button
            key={chain.id}
            type="button"
            disabled={isPending || active}
            onClick={() => switchChain({ chainId: chain.id })}
            data-testid={`chain-switcher-${chain.id}`}
            aria-pressed={active}
            className={cn(
              "rounded-[10px] px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
              active
                ? "bg-primary/10 text-primary ring-primary/30 ring-1"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {CHAIN_SHORT_NAMES[chain.id] ?? chain.name}
          </button>
        );
      })}
    </div>
  );
}
