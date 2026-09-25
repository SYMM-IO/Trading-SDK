"use client";

import { Button } from "@/components/button";
import { DetailRow, DetailSection } from "@/components/detail-list";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { useToast } from "@/components/toast";
import {
  getGaslessUnconfirmedSubmit,
  type GaslessAcceptedRequest,
  type GaslessUnconfirmedSubmit,
} from "@symmio/trading-core";
import { useResubmitGaslessRequest } from "@symmio/trading-react";

interface Props {
  pending: GaslessUnconfirmedSubmit | null;
  onAccepted: (request: GaslessAcceptedRequest) => void;
  onPendingChange: (submit: GaslessUnconfirmedSubmit | null) => void;
}

/** Safe byte-for-byte recovery for a submit whose service response was lost. */
export function GaslessRecoveryPanel({ pending, onAccepted, onPendingChange }: Props) {
  const toast = useToast();
  const resubmit = useResubmitGaslessRequest({ onAccepted, abortOnUnmount: false });

  async function recover() {
    if (!pending) return;
    const toastId = toast.push({
      title: "Recovering exact submit",
      body: "Replaying the saved bytes under their original idempotency key.",
      tone: "pending",
    });
    try {
      const result = await resubmit.mutateAsync(pending);
      onPendingChange(null);
      toast.update(toastId, {
        title: "Request recovered",
        body: `Request ${result.accepted.requestId} was accepted and reconciled.`,
        tone: "long",
      });
    } catch (error) {
      const replacement = getGaslessUnconfirmedSubmit(error);
      if (replacement) onPendingChange(replacement);
      toast.update(toastId, {
        title: replacement ? "Outcome is still uncertain" : "Recovery failed",
        body: replacement
          ? "The exact recovery record remains saved locally. Try again later; do not repeat the original action."
          : error instanceof Error
            ? error.message
            : String(error),
        tone: replacement ? "warn" : "error",
      });
    }
  }

  function forget() {
    if (!pending) return;
    const confirmed = window.confirm(
      "Forget this recovery record? Only continue if you independently reconciled the request. The signed submit cannot be reconstructed later.",
    );
    if (confirmed) onPendingChange(null);
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="Recovery"
        title="Uncertain submit"
        actions={
          <Pill dot color={pending ? "var(--warn-500)" : "var(--long-500)"}>
            {pending ? "action required" : "clear"}
          </Pill>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        {pending ? (
          <>
            <p className="rounded-md border border-warn/30 bg-warn-bg px-3 py-2 text-sm leading-relaxed text-warn">
              The gateway may already have accepted this action. Prism saved the SDK’s exact signed body locally. Never
              repeat the original intent; safely replay this record instead.
            </p>
            <DetailSection title="Local recovery record" note="signed body hidden">
              <DetailRow
                label="Service"
                value={<span className="font-mono text-sm text-fg-1">{pending.service}</span>}
              />
              <DetailRow label="Route" value={<span className="font-mono text-sm text-fg-1">{pending.path}</span>} />
              <DetailRow
                label="Chain id"
                value={<span className="font-mono text-sm text-fg-1">{pending.chainId}</span>}
              />
              <DetailRow
                label="Idempotency"
                value={<span className="text-sm text-fg-1">preserved exactly</span>}
                sub="not editable"
              />
            </DetailSection>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button type="button" variant="primary" loading={resubmit.isPending} onClick={() => void recover()}>
                {resubmit.isPending ? resubmit.relay.phase : "Safely resubmit saved request"}
              </Button>
              <Button type="button" variant="ghost" disabled={resubmit.isPending} onClick={forget}>
                Forget record
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-fg-3">
            No inconclusive submit is stored. If a relay response is lost, Prism captures the SDK recovery record before
            showing an error and keeps it across reloads until it is reconciled.
          </p>
        )}
      </div>
    </Panel>
  );
}
