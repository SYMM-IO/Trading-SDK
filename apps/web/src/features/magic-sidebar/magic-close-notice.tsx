"use client";

import { Button } from "@symmio/ui/components/button";
import { Checkbox } from "@symmio/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@symmio/ui/components/dialog";
import { Label } from "@symmio/ui/components/label";
import { useEffect, useState } from "react";

interface Props {
  /** Whether the notice is showing. */
  open: boolean;
  /** Number of currently pinned methods (drives the copy). */
  pinCount: number;
  /** Proceed with closing the sidebar; `dontShowAgain` opts out of future notices. */
  onConfirm: (dontShowAgain: boolean) => void;
  /** Dismiss the notice and leave the sidebar open. */
  onCancel: () => void;
}

/**
 * Heads-up shown when the user closes the magic sidebar while methods are pinned:
 * those methods keep polling and streaming in the background while the sidebar is
 * closed, so reopening shows their accumulated data (including socket messages
 * received while it was closed). Offers a persisted "don't show again" opt-out.
 */
export function MagicCloseNotice({ open, pinCount, onConfirm, onCancel }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  /** Reset the checkbox each time the notice is dismissed so it never re-opens pre-checked. */
  useEffect(() => {
    if (!open) setDontShowAgain(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pinned methods keep running</DialogTitle>
          <DialogDescription>
            {pinCount === 1 ? "Your pinned method" : `Your ${pinCount} pinned methods`} keep polling and streaming in
            the background while the sidebar is closed, so live sockets keep receiving and data stays fresh. Reopen the
            sidebar any time to pick up where they left off. Collapse a card to pause just that one.
          </DialogDescription>
        </DialogHeader>

        <Label className="mt-2 cursor-pointer font-normal">
          <Checkbox checked={dontShowAgain} onCheckedChange={(value) => setDontShowAgain(value === true)} />
          Don&apos;t show this again
        </Label>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onCancel}>
            Keep open
          </Button>
          <Button onClick={() => onConfirm(dontShowAgain)}>Close sidebar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
