"use client";

import { ResultError, ResultNote, ResultWarning } from "@/components/result";
import {
  type SymmioRequestError,
  type UseInstantOpenWithTpSlData,
  type UseSetQuoteTpSlReturnType,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { TpSlConfirmationStatus } from "./tp-sl-confirmation-status";
import type { TpSlSubmissionStatus } from "./use-tp-sl-submission-feedback";

interface Props {
  idPrefix: string;
  data?: UseInstantOpenWithTpSlData;
  attaching: boolean;
  retry: Pick<UseSetQuoteTpSlReturnType, "isPending" | "isSuccess" | "error">;
  onRetry: () => void;
  confirmation: TpSlSubmissionStatus;
}

/** Only an explicit handler rejection enables this app's manual recovery button. */
export function canRetryAttachment(error?: Pick<SymmioRequestError, "code"> | null): boolean {
  return error?.code === "SET_TPSL_REJECTED";
}

/** Attachment outcome is separate from the accepted open displayed above it. */
export function TpSlAttachmentStatus({ idPrefix, data, attaching, retry, onRetry, confirmation }: Props) {
  if (attaching || retry.isPending) {
    return (
      <ResultNote loading testId={`${idPrefix}-tpsl-status`}>
        Setting TP/SL…
      </ResultNote>
    );
  }
  if (retry.isSuccess || data?.tpsl) {
    if (data?.tpslParameters) {
      return <TpSlConfirmationStatus idPrefix={`${idPrefix}-tpsl`} status={confirmation} />;
    }
    return (
      <ResultWarning testId={`${idPrefix}-tpsl-unconfirmed`}>
        TP/SL not confirmed yet — check current orders
      </ResultWarning>
    );
  }
  const error = retry.error ?? data?.tpslError;
  if (!error) return null;
  const rejected = canRetryAttachment(error);
  return (
    <div className="flex flex-col gap-2">
      {rejected ? (
        <ResultError
          testId={`${idPrefix}-tpsl-error`}
          kind="rejected"
          message={`Position open request accepted. TP/SL attachment request rejected: ${error.message}`}
        />
      ) : (
        <ResultWarning testId={`${idPrefix}-tpsl-unknown`}>
          Position open request accepted. TP/SL protection is unconfirmed: {error.message} Check current TP/SL orders
          before taking further action. Do not open the position again or blindly retry this attachment.
        </ResultWarning>
      )}
      {data?.tpslParameters ? (
        <ResultNote testId={`${idPrefix}-tpsl-parameters`}>
          Attachment quote {String(data.tpslParameters.quoteId)}, submitted quantity {data.tpslParameters.quantity}.
          SDK-managed TP/SL state; sizing uses the actual open submission.
        </ResultNote>
      ) : (
        <ResultNote>
          Attachment identifiers are unavailable. Inspect the accepted position before setting TP/SL.
        </ResultNote>
      )}
      {rejected && data?.tpslParameters ? (
        <Button type="button" onClick={onRetry} data-testid={`${idPrefix}-tpsl-retry`}>
          Retry TP/SL only
        </Button>
      ) : null}
    </div>
  );
}
