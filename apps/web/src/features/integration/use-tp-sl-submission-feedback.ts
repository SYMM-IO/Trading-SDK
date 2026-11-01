"use client";

import type { SetQuoteTpSlParameters, SolverId, TpSlNotification } from "@symmio/trading-core";
import { useInstantOpenQuoteId, useWatchTpSlNotifications } from "@symmio/trading-react";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";

export type TpSlSubmissionStatus = "pending" | "active" | "triggered" | "failed" | "unconfirmed";

interface Attempt {
  token: symbol;
  parameters?: SetQuoteTpSlParameters;
  acceptedAt?: number;
  reports: TpSlNotification[];
}

/** Reference-app result policy, separate from the SDK's REST-backed order display. */
export function useTpSlSubmissionFeedback({
  account,
  chainId,
  solverId,
  instantOpen = false,
  enabled = true,
}: {
  account: Address;
  chainId: number;
  solverId?: SolverId;
  instantOpen?: boolean;
  enabled?: boolean;
}) {
  const [attempt, setAttempt] = useState<Attempt>();
  const live = useRef<Attempt | undefined>(undefined);
  const mounted = useRef(false);
  const resolvedId = useRef<bigint | undefined>(undefined);
  const [expiredToken, setExpiredToken] = useState<symbol>();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      live.current = undefined;
    };
  }, []);

  // Subscribe before dispatch, including while the open has not returned its ID.
  // SDK transport pooling shares the physical socket with current-order readers.
  useWatchTpSlNotifications({
    account,
    chainId,
    enabled,
    onNotification: (report) => {
      const current = live.current;
      if (!mounted.current || !current || report.account?.toLowerCase() !== account.toLowerCase()) return;
      if (report.successful && report.state === "pending") return;
      // Bound pre-response/anchoring buffering. A dropped report leaves the UI
      // unconfirmed; it never authorizes a write retry or fabricates success.
      const reports = current.reports.filter(
        (previous) =>
          previous.quoteId !== report.quoteId || previous.conditionalOrderType !== report.conditionalOrderType,
      );
      reports.push(report);
      const unknown = reports.filter((item) => !matchesReport(item, current.parameters?.quoteId, resolvedId.current));
      const retained = new Set(unknown.slice(-128));
      const next = {
        ...current,
        reports: reports.filter(
          (item) => retained.has(item) || matchesReport(item, current.parameters?.quoteId, resolvedId.current),
        ),
      };
      live.current = next;
      setAttempt(next);
    },
  });

  const tempQuoteId = Number(attempt?.parameters?.quoteId ?? 0n);
  const resolveId =
    instantOpen && attempt?.acceptedAt !== undefined && Number.isSafeInteger(tempQuoteId) && tempQuoteId !== 0;
  const resolved = useInstantOpenQuoteId({
    chainId,
    solverId,
    tempQuoteId,
    query: {
      enabled: resolveId,
      refetchInterval: (query) => (query.state.data == null ? 2_000 : false),
      staleTime: Infinity,
    },
  });
  const quoteId =
    resolveId && resolved.data != null && Number.isSafeInteger(resolved.data) && resolved.data > 0
      ? BigInt(resolved.data)
      : undefined;
  useEffect(() => {
    resolvedId.current = quoteId;
  }, [quoteId]);

  const token = attempt?.token;
  const acceptedAt = attempt?.acceptedAt;
  useEffect(() => {
    if (acceptedAt === undefined || token === undefined) return;
    const timer = setTimeout(() => setExpiredToken(token), Math.max(0, acceptedAt + 90_000 - Date.now()));
    return () => clearTimeout(timer);
  }, [acceptedAt, token]);

  /** Call synchronously before a write. Its completion belongs only to this attempt. */
  function begin(parameters?: SetQuoteTpSlParameters) {
    const current: Attempt = { token: Symbol(), parameters, reports: [] };
    resolvedId.current = undefined;
    live.current = current;
    setAttempt(current);
    return (accepted: SetQuoteTpSlParameters) => {
      if (!mounted.current || live.current?.token !== current.token) return;
      const next = { ...live.current, parameters: accepted, acceptedAt: Date.now() };
      live.current = next;
      setAttempt(next);
    };
  }

  const status = submissionStatus(attempt, quoteId, expiredToken === token);
  return { begin, status };
}

/** Interpret only reports observed during this form's current submission. */
function submissionStatus(
  attempt: Attempt | undefined,
  quoteId: bigint | undefined,
  expired: boolean,
): TpSlSubmissionStatus {
  if (!attempt?.parameters || attempt.acceptedAt === undefined) return "pending";
  const { parameters } = attempt;
  const outcomes: Partial<Record<"take_profit" | "stop_loss", TpSlSubmissionStatus>> = {};
  for (const report of attempt.reports) {
    if (!matchesReport(report, parameters.quoteId, quoteId)) continue;
    const side = report.conditionalOrderType;
    if (!side) {
      if (!report.successful) return "failed";
      continue;
    }
    if ((side === "take_profit" && !parameters.tp) || (side === "stop_loss" && !parameters.sl)) continue;
    if (!report.successful || ["cancel", "canceled", "cancelled"].includes(report.state)) outcomes[side] = "failed";
    else if (["trigger", "triggered", "close"].includes(report.state)) outcomes[side] = "triggered";
    else if (report.state === "new" || report.state === "edit") outcomes[side] = "active";
  }
  const submitted = [parameters.tp ? outcomes.take_profit : undefined, parameters.sl ? outcomes.stop_loss : undefined];
  if (submitted.includes("failed")) return "failed";
  const confirmed = (state?: TpSlSubmissionStatus) => state === "active" || state === "triggered";
  if (
    (parameters.tp || parameters.sl) &&
    (!parameters.tp || confirmed(outcomes.take_profit)) &&
    (!parameters.sl || confirmed(outcomes.stop_loss))
  ) {
    return submitted.includes("triggered") ? "triggered" : "active";
  }
  return expired ? "unconfirmed" : "pending";
}

function matchesReport(report: TpSlNotification, originalId?: bigint, resolvedId?: bigint): boolean {
  return [report.quoteId, report.primaryIdentifier, report.secondaryIdentifier].some(
    (id) => Number.isSafeInteger(id) && id !== 0 && (BigInt(id) === originalId || BigInt(id) === resolvedId),
  );
}
