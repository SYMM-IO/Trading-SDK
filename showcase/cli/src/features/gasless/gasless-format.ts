import { GaslessRequestStatus, type GaslessRequestTransaction } from "@symmio/trading-core";
import { maxUint256 } from "viem";
import { theme } from "../../config/theme.js";
import { formatDateTime, formatToken } from "../../lib/format.js";

/** Compact a request id or transaction hash without hiding its identity entirely. */
export function shortGaslessId(value: string | null, lead = 12, tail = 8): string {
  if (!value) return "—";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Human-readable collateral amount using the policy token's own decimals. */
export function formatGaslessToken(raw: bigint | undefined | null, decimals: number, symbol = "tokens"): string {
  return raw == null ? "—" : `${formatToken(raw, decimals)} ${symbol}`;
}

/** A bounded operational-fee allowance in 18-decimal Core units. */
export function formatGaslessAllowance(raw: bigint | undefined): string {
  if (raw === undefined) return "—";
  if (raw >= maxUint256 / 2n) return "effectively uncapped (still decremented)";
  return `${formatToken(raw, 18)} Core`;
}

/** Terminal color for one request state. */
export function gaslessStatusColor(status: GaslessRequestStatus): string {
  switch (status) {
    case GaslessRequestStatus.SUCCEEDED:
      return theme.positive;
    case GaslessRequestStatus.REJECTED:
    case GaslessRequestStatus.REVERTED:
    case GaslessRequestStatus.FAILED:
      return theme.negative;
    case GaslessRequestStatus.SUBMITTED:
      return theme.warning;
    default:
      return theme.info;
  }
}

/** One compact line for an EVM attempt, whose outcome can differ from the request's final outcome. */
export function formatGaslessAttempt(attempt: GaslessRequestTransaction): string {
  const when = attempt.createdAt ? new Date(attempt.createdAt) : null;
  const at = when && Number.isFinite(when.getTime()) ? formatDateTime(Math.floor(when.getTime() / 1000)) : "—";
  return `#${attempt.attemptNumber} ${attempt.status} ${shortGaslessId(attempt.txHash)} · ${at}`;
}
