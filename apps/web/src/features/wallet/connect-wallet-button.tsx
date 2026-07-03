"use client";

import { WalletConnectDialog, WalletGlyph } from "@/features/wallet/wallet-connect-dialog";
import { Button } from "@symmio/ui/components/button";
import { useState } from "react";

interface Props {
  /** Button size forwarded to the trigger. Defaults to `"sm"` to slot into toolbars. */
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * A full-width "Connect Wallet" button that opens the wallet picker
 * ({@link WalletConnectDialog}). Use it where a labelled call to action fits;
 * for a compact toolbar control, reach for the navbar wallet launcher instead.
 */
export function ConnectWalletButton({ size = "sm", className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        data-testid="connect-wallet"
      >
        <WalletGlyph />
        Connect Wallet
      </Button>

      <WalletConnectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
