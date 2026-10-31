"use client";

import { useSetQuoteTpSl, type UseInstantOpenWithTpSlReturnType } from "@symmio/trading-react";
import { useRef } from "react";
import { canRetryAttachment } from "./tp-sl-attachment-status";

/** App policy: offer manual attachment-only recovery after explicit rejection. */
export function useTpSlAttachmentRecovery(open: Pick<UseInstantOpenWithTpSlReturnType, "data" | "isPending">) {
  const retry = useSetQuoteTpSl();
  const inFlight = useRef(false);

  function retryAttachment() {
    const parameters = open.data?.tpslParameters;
    const error = retry.error ?? open.data?.tpslError;
    if (
      !parameters ||
      !canRetryAttachment(error) ||
      retry.isSuccess ||
      open.isPending ||
      retry.isPending ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    // Reuse the resolved quote, VA and submitted quantity. Never invoke the open again.
    retry.mutate(parameters, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  function resetForOpen() {
    if (inFlight.current || retry.isPending) return false;
    retry.reset();
    return true;
  }

  return { ...retry, retryAttachment, resetForOpen };
}
