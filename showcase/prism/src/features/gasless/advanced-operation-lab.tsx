"use client";

import { Button } from "@/components/button";
import { DetailRow, DetailSection } from "@/components/detail-list";
import { Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { useToast } from "@/components/toast";
import { Numeric } from "@/components/value";
import { formatDate, shortenAddress } from "@/lib/format";
import {
  GaslessFeeSource,
  SymmioSupportedChainId,
  getGaslessUnconfirmedSubmit,
  type GaslessAcceptedRequest,
  type GaslessFeePayment,
  type GaslessUnconfirmedSubmit,
} from "@symmio/trading-core";
import { useGaslessFeeQuote, useRelayInstantOperations, useSymmioConfig } from "@symmio/trading-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import {
  getRelayReadinessIssues,
  parseOperationBundleJson,
  toFeeQuoteOperations,
  toRelayInstantOperationsVariables,
  verifyOperationBundleSignatures,
  type PreparedOperationBundle,
} from "./operation-bundle";

/** Host handoffs for accepted and transport-uncertain relay submissions. */
export interface AdvancedGaslessOperationLabProps {
  /** Persist and surface the accepted request immediately; it may keep running after this component unmounts. */
  onAccepted: (accepted: GaslessAcceptedRequest) => void;
  /** Persist the exact unconfirmed submit locally so it can be replayed byte-for-byte. */
  onUnconfirmed: (submit: GaslessUnconfirmedSubmit) => void | Promise<void>;
}

/**
 * Advanced direct-relay lab for batches prepared and signed by local tooling.
 *
 * Source JSON is discarded immediately after parsing. The component keeps the
 * parsed signatures only in React memory, never echoes the signed body, and
 * locks the batch as soon as a relay is accepted or becomes unconfirmed.
 */
export function AdvancedGaslessOperationLab({ onAccepted, onUnconfirmed }: AdvancedGaslessOperationLabProps) {
  const [source, setSource] = useState("");
  const [bundle, setBundle] = useState<PreparedOperationBundle | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastAcceptedId, setLastAcceptedId] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<GaslessUnconfirmedSubmit | null>(null);
  const acceptedRef = useRef<string | null>(null);
  const toast = useToast();
  const config = useSymmioConfig();

  const quoteOperations = useMemo(() => (bundle ? toFeeQuoteOperations(bundle) : []), [bundle]);
  const readinessIssues = useMemo(() => (bundle ? getRelayReadinessIssues(bundle) : []), [bundle]);
  const quote = useGaslessFeeQuote({
    chainId: SymmioSupportedChainId.ARBITRUM,
    operations: quoteOperations,
    query: {
      enabled: bundle !== null,
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  const handleAccepted = useCallback(
    (accepted: GaslessAcceptedRequest) => {
      acceptedRef.current = accepted.requestId;
      setLastAcceptedId(accepted.requestId);
      setBundle(null);
      setAcknowledged(false);
      try {
        onAccepted(accepted);
      } catch {
        setRelayError("The relay was accepted, but Prism could not hand it to the request monitor.");
      }
    },
    [onAccepted],
  );
  const relay = useRelayInstantOperations({ onAccepted: handleAccepted, abortOnUnmount: false });

  function loadBundle() {
    setImportError(null);
    setRelayError(null);
    setRecoveryNotice(null);
    setLastAcceptedId(null);
    acceptedRef.current = null;
    try {
      const parsed = parseOperationBundleJson(source);
      setBundle(parsed);
      setSource("");
      setAcknowledged(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Bundle could not be parsed.");
    }
  }

  function forgetBundle() {
    setBundle(null);
    setAcknowledged(false);
    setRelayError(null);
    relay.reset();
  }

  async function handOffRecovery(submit: GaslessUnconfirmedSubmit): Promise<boolean> {
    try {
      await onUnconfirmed(submit);
      setPendingRecovery(null);
      setRecoveryNotice("The exact submit was handed to Prism’s local recovery queue. Do not recreate the intent.");
      return true;
    } catch {
      setPendingRecovery(submit);
      setRecoveryNotice(
        "Recovery handoff failed. Keep this tab open and retry; do not submit the original intent again.",
      );
      return false;
    }
  }

  async function relayBundle() {
    if (!bundle) return;
    const latestIssues = getRelayReadinessIssues(bundle);
    if (latestIssues.length > 0) {
      setRelayError(latestIssues[0] ?? "Bundle is not relay-ready.");
      return;
    }

    setRelayError(null);
    setIsVerifying(true);
    acceptedRef.current = null;
    const toastId = toast.push({
      title: "Verifying local signatures",
      body: "Recovering every signer before anything is sent to the relayer.",
      tone: "pending",
    });

    try {
      await verifyOperationBundleSignatures(config, bundle);
      const variables = toRelayInstantOperationsVariables(bundle);
      const result = await relay.mutateAsync(variables);
      toast.update(toastId, {
        title: "Operation batch confirmed",
        body: `Request ${result.accepted.requestId} reached on-chain confirmation.`,
        tone: "long",
      });
    } catch (error) {
      const unconfirmed = getGaslessUnconfirmedSubmit(error);
      if (unconfirmed) {
        setBundle(null);
        setAcknowledged(false);
        setPendingRecovery(unconfirmed);
        await handOffRecovery(unconfirmed);
        toast.update(toastId, {
          title: "Submit outcome is unknown",
          body: "The exact signed submit was isolated for safe replay. Never rebuild or re-sign this intent.",
          tone: "warn",
        });
      } else if (acceptedRef.current) {
        setRelayError(
          `Request ${acceptedRef.current} was accepted. Follow it in the request monitor; do not relay again.`,
        );
        toast.update(toastId, {
          title: "Accepted request needs attention",
          body: "The request exists at the relayer. Continue from the request monitor instead of submitting it again.",
          tone: "warn",
        });
      } else {
        const message = safeErrorMessage(error);
        setRelayError(message);
        toast.update(toastId, { title: "Relay blocked", body: message, tone: "error" });
      }
    } finally {
      setIsVerifying(false);
    }
  }

  const signedCount = bundle?.operations.filter((entry) => entry.signature).length ?? 0;
  const walletIds = bundle ? [...new Set(bundle.operations.map((entry) => entry.walletId.toString()))] : [];
  const earliestDeadline = bundle
    ? bundle.operations.reduce(
        (earliest, entry) =>
          earliest === undefined || entry.operation.replayAttackHeader.deadline < earliest
            ? entry.operation.replayAttackHeader.deadline
            : earliest,
        undefined as bigint | undefined,
      )
    : undefined;
  const phase = isVerifying ? "verifying" : relay.isPending ? relay.relay.phase : bundle ? "loaded locally" : "idle";

  return (
    <Panel>
      <PanelHeader
        eyebrow="Advanced · direct SDK relay"
        title="Prepared operation lab"
        actions={
          <div className="flex items-center gap-2">
            <Pill>Arbitrum · 42161</Pill>
            <Pill dot color={bundle ? "var(--warn-500)" : "var(--fg-3)"}>
              {phase}
            </Pill>
          </div>
        }
      />

      <div className="flex flex-col gap-5 p-4">
        <div className="rounded-md border border-warn/30 bg-warn-bg px-3.5 py-3">
          <p className="text-sm font-semibold text-warn">Developer escape hatch</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-2">
            This bypasses Prism’s normal operation builders. Import only a batch produced by tooling you trust, verify
            every target, nonce and deadline, and never submit the same signed intent twice. Signatures stay in this tab
            until the SDK sends them to the configured Arbitrum relayer.
          </p>
        </div>

        {!bundle ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                Local operation bundle JSON
              </span>
              <textarea
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={'{ "chainId": 42161, "operations": [{ "operation": { … } }] }'}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
                disabled={isVerifying || relay.isPending || pendingRecovery !== null}
                className="tnum min-h-40 w-full resize-y rounded-md border border-line bg-bg-2 px-3 py-2.5 font-mono text-sm leading-relaxed text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
                aria-invalid={Boolean(importError)}
              />
              <span className="px-1 text-2xs leading-relaxed text-fg-3">
                Use decimal strings for uint values. Add a 65-byte <code>signature</code> and an explicit
                <code> signatureScheme</code> of <code>instant-layer</code> or <code>gasless-wallet</code> to relay. The
                source text is cleared immediately after a successful import.
              </span>
            </label>
            {importError ? (
              <p className="rounded-md border border-short/30 bg-short-bg px-3 py-2 text-sm text-short" role="alert">
                {importError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={!source} onClick={() => setSource("")}>
                Clear locally
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!source.trim() || isVerifying || relay.isPending || pendingRecovery !== null}
                onClick={loadBundle}
              >
                Validate and load
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DetailSection title="Local batch" note="source text discarded">
              <DetailRow
                label="Operations"
                value={<Numeric size="sm">{bundle.operations.length}</Numeric>}
                sub={`${signedCount} structurally signed`}
              />
              <DetailRow
                label="Tracked owner"
                value={<span className="font-mono text-sm text-fg-1">{shortenAddress(bundle.userAddress)}</span>}
                sub={bundle.operationType ?? "quote-only bundle"}
              />
              <DetailRow
                label="Wallet ids"
                value={<Numeric size="sm">{walletIds.join(", ")}</Numeric>}
                sub="one id per operation"
              />
              <DetailRow
                label="Earliest deadline"
                value={<Numeric size="sm">{earliestDeadline ? formatDate(Number(earliestDeadline)) : "—"}</Numeric>}
                sub="checked again before relay"
              />
            </DetailSection>

            {readinessIssues.length > 0 ? (
              <div className="rounded-md border border-line bg-bg-2 px-3.5 py-3">
                <p className="text-sm font-semibold text-fg-1">Quote ready · relay locked</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-fg-3">
                  {readinessIssues.slice(0, 4).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" variant="ghost" disabled={isVerifying || relay.isPending} onClick={forgetBundle}>
                Forget sensitive bundle
              </Button>
            </div>
          </>
        )}

        {bundle ? (
          <DetailSection
            title="On-chain fee preview"
            note={quote.data ? `block ${quote.data.blockNumber.toString()}` : "GaslessLayer previewFeeQuote"}
          >
            <DetailRow
              label="Estimated fees"
              value={<Numeric size="sm">{formatCore18(quote.data?.totalFee18)}</Numeric>}
              sub="18-decimal Core collateral"
              isLoading={quote.isLoading}
            />
            <DetailRow
              label="Estimated total debit"
              value={<Numeric size="sm">{formatCore18(quote.data?.totalDebit18)}</Numeric>}
              sub="fees plus native-gas collateral"
              isLoading={quote.isLoading}
            />
            <DetailRow
              label="Free operations applied"
              value={<Numeric size="sm">{quote.data?.freeOpsApplied.toString() ?? "—"}</Numeric>}
              isLoading={quote.isLoading}
            />
            <DetailRow
              label="Quote status"
              value={
                <Numeric size="sm" tone="warn">
                  {quote.data?.exact ? "exact" : "preview"}
                </Numeric>
              }
              sub={quote.data ? `at ${formatDate(Number(quote.data.timestamp))}` : "not yet available"}
              isLoading={quote.isLoading}
            />
            {quote.data?.payments.map((payment, index) => (
              <DetailRow
                key={`${payment.payer}-${index}`}
                label={`Payment ${index + 1}`}
                value={<Numeric size="sm">{formatCore18(paymentFee(payment))}</Numeric>}
                sub={`${feeSourceLabel(payment.source)} · payer ${shortenAddress(payment.payer)}`}
              />
            ))}
          </DetailSection>
        ) : null}

        {quote.error && bundle ? (
          <p className="rounded-md border border-short/30 bg-short-bg px-3 py-2 text-sm text-short" role="alert">
            Fee preview unavailable: {quote.error.message}
          </p>
        ) : null}

        {bundle && readinessIssues.length === 0 ? (
          <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
            <p className="text-sm leading-relaxed text-fg-2">
              The preview is not a guarantee and does not prove allowance, balance, nonce freshness or successful
              simulation. Before relay, Prism cryptographically recovers every signer under the declared EIP-712 domain.
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-bg-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span className="text-sm leading-relaxed text-fg-1">
                I verified the targets, calldata, wallet ids, nonces and deadlines, and understand that acceptance is
                the point of no return.
              </span>
            </label>
            <Button
              type="button"
              variant="danger"
              size="lg"
              loading={isVerifying || relay.isPending}
              disabled={!acknowledged}
              onClick={() => void relayBundle()}
            >
              Verify signatures and relay batch
            </Button>
          </div>
        ) : null}

        {relayError ? (
          <p className="rounded-md border border-short/30 bg-short-bg px-3 py-2 text-sm text-short" role="alert">
            {relayError}
          </p>
        ) : null}
        {lastAcceptedId ? (
          <p className="rounded-md border border-long/30 bg-long-bg px-3 py-2 text-sm text-long">
            Request {shortenAddress(lastAcceptedId, 10, 8)} was accepted and removed from this lab. Follow its durable
            id in the request monitor.
          </p>
        ) : null}
        {recoveryNotice ? (
          <div className="flex flex-col gap-2 rounded-md border border-warn/30 bg-warn-bg px-3 py-2.5 text-sm text-warn">
            <p>{recoveryNotice}</p>
            {pendingRecovery ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => void handOffRecovery(pendingRecovery)}>
                Retry local recovery handoff
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function paymentFee(payment: GaslessFeePayment): bigint {
  return payment.operationalFee18 + payment.depositFee18 + payment.walletCreationFee18 + payment.nativeTopUpFee18;
}

function feeSourceLabel(source: GaslessFeeSource): string {
  return source === GaslessFeeSource.SYMMIO_ACCOUNT ? "Core balance" : "wallet collateral";
}

function formatCore18(value: bigint | undefined): string {
  if (value === undefined) return "—";
  if (value === 0n) return "0";
  const [whole = "0", fraction = ""] = formatUnits(value, 18).split(".");
  const visible = fraction.slice(0, 6).replace(/0+$/, "");
  if (!visible && fraction.replace(/0/g, "")) return `<${whole === "0" ? "0.000001" : `${whole}.000001`}`;
  return visible ? `${whole}.${visible}` : whole;
}

function safeErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") return `The SDK blocked this batch (${code}). Review the prepared operation.`;
  return "The SDK blocked this batch before acceptance. Review its signature, nonce, deadline and relay policy.";
}
