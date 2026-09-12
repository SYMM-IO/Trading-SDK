"use client";

import { chainLabel } from "@/config/symmio-config-schema";
import { useSymmioChainId, useWalletAccount } from "@symmio/trading-react";
import { cn } from "@symmio/ui/lib/utils";
import { useChains, useSwitchChain } from "wagmi";

interface Props {
  className?: string;
}

/**
 * Network picker shared by the wallet menu and the connect dialog: one chip per
 * configured wagmi chain (HyperEVM, Base, Arbitrum), the active one highlighted.
 * The chain picks the target solver (Enigma vs Rasa) and every SDK read, so it
 * sits with the wallet instead of taking header space of its own.
 *
 * Connected, a chip asks the wallet to switch and the highlight follows the
 * wallet — no chip is lit while it sits on an unsupported chain, so every chip
 * stays clickable to recover. Disconnected, a chip retargets the app's reads
 * directly, with no prompt.
 */
export function ChainSwitcher({ className }: Props) {
  const chains = useChains();
  const appChainId = useSymmioChainId();
  const { chainId: walletChainId, isConnected } = useWalletAccount();
  const { mutate: switchChain, isPending } = useSwitchChain();
  const activeChainId = isConnected ? walletChainId : appChainId;

  return (
    <div
      className={cn("border-border/70 grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl border p-0.5", className)}
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
              "rounded-[10px] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-default",
              active
                ? "bg-primary/10 text-primary ring-primary/30 ring-1"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {chainLabel(chain.id)}
          </button>
        );
      })}
    </div>
  );
}
