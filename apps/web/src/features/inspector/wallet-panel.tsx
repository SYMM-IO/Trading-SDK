"use client";

import { AddressTag } from "@/components/address-tag";
import { StatusDot } from "@/components/status-dot";
import { ConnectWalletButton } from "@/features/wallet/connect-wallet-button";
import { useDisconnectWallet, useSwitchToSymmioChain, useWalletAccount } from "@theoldvarorg/react";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { Button } from "@theoldvarorg/ui/components/button";
import { Card } from "@theoldvarorg/ui/components/card";
import { Spinner } from "@theoldvarorg/ui/components/spinner";

/**
 * Connection panel shared by the Inspector shells: shows the connected address
 * and network state, and the connect / switch-chain / disconnect actions.
 */
export function WalletPanel() {
  const { address, isConnected, isOnExpectedChain } = useWalletAccount();
  const { disconnect } = useDisconnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();

  const tone = !isConnected ? "neutral" : isOnExpectedChain ? "positive" : "warning";

  return (
    <Card data-testid="wallet-panel" size="sm" className="animate-enter-up overflow-hidden">
      <div className="flex flex-col gap-4 px-4 py-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground ring-border flex size-10 items-center justify-center rounded-xl ring-1">
            <WalletIcon />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <StatusDot tone={tone} pulse={isConnected && isOnExpectedChain} />
              Wallet
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="wallet-address" className="text-foreground text-sm font-medium">
                {address ? <AddressTag address={address} /> : "Not connected"}
              </span>
              {isConnected && isOnExpectedChain ? <Badge variant="positive">Connected</Badge> : null}
              {isConnected && !isOnExpectedChain ? <Badge variant="warning">Wrong network</Badge> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isConnected && <ConnectWalletButton />}

          {isConnected && !isOnExpectedChain && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => switchChain().catch(() => undefined)}
              disabled={switchStatus === "pending"}
              data-testid="switch-chain"
            >
              {switchStatus === "pending" ? <Spinner className="size-4" /> : null}
              Switch to HyperEVM
            </Button>
          )}

          {isConnected && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => disconnect().catch(() => undefined)}
              data-testid="disconnect"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M16 12h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M3 9h13a2 2 0 0 1 2 2v0" stroke="currentColor" strokeWidth="1.75" opacity="0.5" />
    </svg>
  );
}
