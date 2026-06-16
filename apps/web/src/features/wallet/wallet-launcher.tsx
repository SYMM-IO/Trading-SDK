"use client";

import { AddressTag } from "@/components/address-tag";
import { StatusDot } from "@/components/status-dot";
import { WalletConnectDialog, WalletGlyph } from "@/features/wallet/wallet-connect-dialog";
import { useDisconnectWallet, useSwitchToSymmioChain, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@symm-frontier/ui/components/popover";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useState } from "react";
import type { Address } from "viem";

/** Shared shape of the round-cornered navbar icon buttons (search, config, theme…). */
const ICON_BUTTON =
  "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 relative inline-flex size-9 items-center justify-center rounded-xl border bg-transparent transition-colors outline-none focus-visible:ring-3";

/**
 * Toolbar wallet control. While disconnected it is an icon button that opens the
 * wallet picker; once connected it becomes an account menu — address, network
 * state, and disconnect — with a corner dot marking whether the wallet sits on
 * the chain the SDK expects.
 */
export function WalletLauncher() {
  const { address, isConnected, isOnExpectedChain } = useWalletAccount();

  if (isConnected && address) {
    return <AccountMenu address={address} isOnExpectedChain={isOnExpectedChain} />;
  }

  return <ConnectTrigger />;
}

/** Disconnected state: a wallet glyph that opens the picker dialog. */
function ConnectTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Connect wallet"
        title="Connect wallet"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-testid="wallet-launcher"
        className={ICON_BUTTON}
      >
        <WalletGlyph className="size-[18px]" />
      </button>
      <WalletConnectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

interface AccountMenuProps {
  address: Address;
  isOnExpectedChain: boolean;
}

/** Connected state: a status-dotted glyph that opens a compact account popover. */
function AccountMenu({ address, isOnExpectedChain }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const { disconnect } = useDisconnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();
  const tone = isOnExpectedChain ? "positive" : "warning";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Wallet account"
          title={address}
          data-testid="wallet-launcher"
          className={ICON_BUTTON}
        >
          <WalletGlyph className="size-[18px]" />
          <span
            className={cn(
              "ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2",
              isOnExpectedChain ? "bg-positive" : "bg-warning",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={12} className="w-72 p-0">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="bg-muted text-muted-foreground ring-border flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
            <WalletGlyph className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <AddressTag address={address} />
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <StatusDot tone={tone} pulse={isOnExpectedChain} />
              {isOnExpectedChain ? "Connected · HyperEVM" : "Wrong network"}
            </span>
          </div>
        </div>

        <div className="border-border/60 flex flex-col gap-2 border-t p-3">
          {!isOnExpectedChain ? (
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => switchChain().catch(() => undefined)}
              disabled={switchStatus === "pending"}
              data-testid="wallet-switch-chain"
            >
              {switchStatus === "pending" ? <Spinner className="size-4" /> : null}
              Switch to HyperEVM
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => disconnect().catch(() => undefined)}
            data-testid="wallet-disconnect"
          >
            Disconnect
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
