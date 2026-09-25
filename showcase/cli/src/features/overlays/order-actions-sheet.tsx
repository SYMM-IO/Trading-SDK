import {
  checkForceCloseEligibility,
  getCoolDownsOfMA,
  getForceCloseParams,
  OrderType,
  QuoteStatus,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatCountdown } from "../../lib/format.js";
import {
  useForceCancelClose,
  useForceCancelQuote,
  useForceClose,
  useRequestCancelClose,
  useRequestCancelQuote,
} from "../../sdk/mutations.js";
import { useCapabilities } from "../../sdk/use-capabilities.js";
import { useSdkScope } from "../../sdk/use-sdk-scope.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useToast } from "../toast.js";

/** Cancel, force-cancel, or force-close an anchored pending quote. */
export function OrderActionsSheet({ active, quote }: { active: boolean; quote: UnifiedQuote }) {
  const { config, chainId } = useSdkScope();
  const { subAccount } = useSubAccount();
  const { closeOverlay } = useAppState();
  const capabilities = useCapabilities();
  const toast = useToast();
  const [confirmForce, setConfirmForce] = useState(false);

  const cancelQuote = useRequestCancelQuote();
  const forceCancelQuote = useForceCancelQuote();
  const cancelClose = useRequestCancelClose();
  const forceCancelClose = useForceCancelClose();
  const forceClose = useForceClose();

  const cooldowns = useQuery({
    queryKey: ["quoteActionCooldowns", chainId],
    queryFn: () => getCoolDownsOfMA(config, { chainId }),
    staleTime: 10 * 60_000,
  });
  const forceParams = useQuery({
    queryKey: ["forceCloseParams", chainId, quote.symbolId.toString()],
    queryFn: () => getForceCloseParams(config, { chainId, symbolId: quote.symbolId }),
    enabled: quote.quoteStatus === QuoteStatus.CLOSE_PENDING && quote.orderType === OrderType.LIMIT,
    staleTime: 60_000,
  });

  const cancelCooldown = quote.quoteStatus === QuoteStatus.CANCEL_PENDING ? cooldowns.data?.[1] : cooldowns.data?.[2];
  const cancelReadyAt =
    cancelCooldown != null && quote.statusModifyTimestamp != null
      ? quote.statusModifyTimestamp + cancelCooldown
      : undefined;
  const cancelReady = cancelReadyAt == null || cancelReadyAt <= BigInt(Math.floor(Date.now() / 1000));
  const onchainQuote = quote.raw.onchain;
  const forceEligibility =
    onchainQuote && forceParams.data
      ? checkForceCloseEligibility({
          quote: onchainQuote,
          firstCooldown: forceParams.data.firstCooldown,
          secondCooldown: forceParams.data.secondCooldown,
          minSigPeriod: forceParams.data.minSigPeriod,
          now: BigInt(Math.floor(Date.now() / 1000)),
        })
      : undefined;

  const mutations = [cancelQuote, forceCancelQuote, cancelClose, forceCancelClose, forceClose];
  const pending = mutations.some((mutation) => mutation.isPending);
  const error = mutations.map((mutation) => mutation.error).find((value) => value != null);
  const succeeded = mutations.some((mutation) => mutation.isSuccess);

  useEffect(() => {
    if (!succeeded) return;
    toast.push("success", "Order action confirmed on-chain");
    closeOverlay();
  }, [succeeded, toast, closeOverlay]);

  function actionVariables() {
    if (!subAccount || quote.quoteId == null) return null;
    return { account: subAccount, quoteId: quote.quoteId };
  }

  function runPrimary(): void {
    const variables = actionVariables();
    if (!variables || pending) return;
    switch (quote.quoteStatus) {
      case QuoteStatus.PENDING:
      case QuoteStatus.LOCKED:
        cancelQuote.mutate(variables);
        break;
      case QuoteStatus.CANCEL_PENDING:
        if (cancelReady) forceCancelQuote.mutate(variables);
        break;
      case QuoteStatus.CLOSE_PENDING:
        cancelClose.mutate(variables);
        break;
      case QuoteStatus.CANCEL_CLOSE_PENDING:
        if (cancelReady) forceCancelClose.mutate(variables);
        break;
    }
  }

  function runForceClose(): void {
    const variables = actionVariables();
    if (!variables || pending || !forceEligibility?.eligible) return;
    forceClose.mutate(variables);
  }

  useInput(
    (input, key) => {
      if (confirmForce) {
        if (input === "y") runForceClose();
        else if (input === "n" || key.escape) setConfirmForce(false);
        return;
      }
      if (key.return) runPrimary();
      else if (input === "f" && forceEligibility?.eligible) setConfirmForce(true);
    },
    { isActive: active },
  );

  const primary = primaryAction(quote.quoteStatus);

  return (
    <Sheet title="Manage order" subtitle={quote.quoteId != null ? `quote #${quote.quoteId}` : "not anchored"}>
      <Box flexDirection="column">
        <KeyValue label="Status" value={quote.quoteStatus != null ? QuoteStatus[quote.quoteStatus] : "off-chain"} />
        <KeyValue label="Order type" value={quote.orderType === OrderType.LIMIT ? "LIMIT" : "MARKET"} />
        {cancelReadyAt != null && (
          <KeyValue
            label="Force-cancel"
            value={cancelReady ? "ready" : formatCountdown(cancelReadyAt)}
            color={cancelReady ? theme.positive : theme.warning}
          />
        )}
        {forceEligibility != null && (
          <KeyValue
            label="Force-close"
            value={forceEligibility.eligible ? "eligible" : (forceEligibility.reason ?? "not eligible")}
            color={forceEligibility.eligible ? theme.positive : theme.warning}
          />
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        {pending ? (
          <LoadingLine label="Submitting and waiting for receipt…" />
        ) : confirmForce ? (
          <Text>
            <Text color={theme.negative} bold>
              {" "}
              y{" "}
            </Text>
            <Text color={theme.text}>force close with a fresh Muon proof</Text>
            <Text color={theme.faint}> · n cancel</Text>
          </Text>
        ) : primary ? (
          <Text
            color={cancelReady ? theme.onAccent : theme.faint}
            backgroundColor={cancelReady ? theme.primary : undefined}
            bold
          >
            {` ${glyph.caret} ${primary}  ⏎ `}
          </Text>
        ) : (
          <Text color={theme.faint}>No order action is available for this state.</Text>
        )}
        {capabilities.limitOrder && forceEligibility?.eligible && !confirmForce && (
          <Text color={theme.faint}>
            <Text color={theme.negative}>f</Text> force close · requires confirmation
          </Text>
        )}
        {error != null && <ErrorLine message={formatError(error)} />}
      </Box>
    </Sheet>
  );
}

function primaryAction(status?: QuoteStatus): string | null {
  switch (status) {
    case QuoteStatus.PENDING:
    case QuoteStatus.LOCKED:
      return "Request order cancellation";
    case QuoteStatus.CANCEL_PENDING:
      return "Force-cancel order";
    case QuoteStatus.CLOSE_PENDING:
      return "Cancel pending close";
    case QuoteStatus.CANCEL_CLOSE_PENDING:
      return "Force-cancel close";
    default:
      return null;
  }
}
