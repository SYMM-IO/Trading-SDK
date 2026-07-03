"use client";

import { SymmioRequestError, useConnectWallet } from "@symmio/trading-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@symmio/ui/components/dialog";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { useMemo, useState } from "react";
import type { Connector } from "wagmi";

interface WalletConnectDialogProps {
  /** Whether the picker is open. */
  open: boolean;
  /** Called when the picker requests to open or close. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Controlled modal that lists every wallet connector registered in the host's
 * wagmi config. Each option shows the wallet's own icon, a connecting spinner,
 * and surfaces connect errors inline. Closes itself on a successful connect.
 *
 * Trigger it from any control by owning the `open` state — e.g. a toolbar icon
 * button or the full-width {@link ConnectWalletButton}.
 */
export function WalletConnectDialog({ open, onOpenChange }: WalletConnectDialogProps) {
  const { connectors, connect } = useConnectWallet();
  const [pendingUid, setPendingUid] = useState<string>();
  const [failure, setFailure] = useState<SymmioRequestError>();

  /** Surface installed (icon-bearing) wallets first; keep the generic fallbacks last. */
  const ordered = useMemo(() => [...connectors].sort((a, b) => rank(a) - rank(b)), [connectors]);

  async function handleConnect(connector: Connector) {
    setFailure(undefined);
    setPendingUid(connector.uid);
    try {
      await connect(connector);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof SymmioRequestError) setFailure(error);
    } finally {
      setPendingUid(undefined);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) setFailure(undefined);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(115%_100%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_15%,transparent),transparent)]"
        />

        <DialogHeader className="relative px-6 pt-6 pb-4">
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>Choose a wallet to connect to Symmio.</DialogDescription>
        </DialogHeader>

        <div className="relative flex flex-col gap-1.5 px-3 pb-3">
          {ordered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              No wallet detected. Install a browser wallet such as MetaMask or Rabby and reload.
            </p>
          ) : (
            ordered.map((connector) => (
              <WalletOption
                key={connector.uid}
                connector={connector}
                pending={pendingUid === connector.uid}
                disabled={pendingUid !== undefined && pendingUid !== connector.uid}
                onSelect={() => handleConnect(connector)}
              />
            ))
          )}
        </div>

        {failure ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive relative mx-3 mb-4 rounded-xl border px-3.5 py-2.5 text-xs">
            {failure.kind === "user-rejected" ? "Connection request rejected." : failure.message}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface WalletOptionProps {
  connector: Connector;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}

/** One selectable wallet row: icon tile, name, install state, and connecting spinner. */
function WalletOption({ connector, pending, disabled, onSelect }: WalletOptionProps) {
  const { name, detail, installed } = describe(connector);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      data-testid={`connect-${connector.id}`}
      className="group/wallet border-border/60 hover:border-primary/50 hover:bg-muted focus-visible:ring-ring/40 relative flex w-full items-center gap-3.5 rounded-xl border bg-transparent px-3 py-2.5 text-left transition-all duration-150 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="ring-border/70 bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1">
        {connector.icon ? (
          /**
           * Wallet icons are inline data-URIs (raw SVG, base64 PNG, …) supplied by the
           * connector. A plain `<img>` renders every format verbatim; CSS `background:
           * url()` breaks on unescaped SVG data-URIs (e.g. Phantom), and `next/image`
           * cannot optimize data-URIs — so the lint rule is intentionally suppressed.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connector.icon} alt="" className="size-full object-contain" />
        ) : (
          <WalletGlyph className="text-muted-foreground size-5" />
        )}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm leading-tight font-medium">{name}</span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs leading-tight">
          {installed ? <span className="bg-positive size-1.5 rounded-full" aria-hidden /> : null}
          {detail}
        </span>
      </span>

      <span className="ml-auto flex size-5 shrink-0 items-center justify-center">
        {pending ? (
          <Spinner className="text-primary size-4" />
        ) : (
          <ChevronRight className="text-muted-foreground/50 group-hover/wallet:text-foreground size-4 transition-transform duration-150 group-hover/wallet:translate-x-0.5" />
        )}
      </span>
    </button>
  );
}

/** Friendly label, secondary detail, and install state for a connector. */
function describe(connector: Connector): { name: string; detail: string; installed: boolean } {
  const installed = Boolean(connector.icon);
  if (connector.type === "mock" || connector.id === "mock") {
    return { name: connector.name, detail: "Test connector", installed: false };
  }
  if (connector.id === "injected") {
    return { name: "Browser Wallet", detail: "Default window provider", installed };
  }
  return { name: connector.name, detail: installed ? "Installed" : "Detected", installed };
}

/** Sort key: discovered wallets (with an icon) first, the generic fallbacks last. */
function rank(connector: Connector): number {
  if (connector.icon) return 0;
  if (connector.id === "injected") return 1;
  return 2;
}

/** The wallet outline glyph shared by the picker trigger and toolbar control. */
export function WalletGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-4", className)} aria-hidden>
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

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
