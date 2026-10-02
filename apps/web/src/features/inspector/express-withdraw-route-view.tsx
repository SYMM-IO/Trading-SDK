import { DataList, DataRow } from "@/components/data-list";
import { formatUsd } from "@/lib/format";
import type { ExpressWithdrawOption, WithdrawRoute, WithdrawRouteChoice } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";

/** Format a Unix-seconds timestamp for display; `0` (never set) renders as `undefined`. */
export function formatUnixSeconds(seconds: number): string | undefined {
  if (seconds === 0) return undefined;
  return new Date(seconds * 1000).toLocaleString();
}

/** A service time estimate in seconds, as `45s` / `12m 30s` / `2h 5m`. */
export function formatEstimate(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * One-line summary of a prepared route: the kind badge, then the classic
 * `finalize` mode (and automatic `reason`, when the route carries one) or the
 * Express option type.
 */
export function WithdrawRouteSummary({ route }: { route: WithdrawRoute | WithdrawRouteChoice }) {
  if (route.kind === "express") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge>express</Badge>
        <span className="font-mono text-sm">{route.option.optionTypeName}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">classic</Badge>
      <span className="font-mono text-sm">finalize: {route.finalize}</span>
      {"reason" in route ? (
        <span className="text-muted-foreground font-mono text-xs">reason: {route.reason}</span>
      ) : null}
    </span>
  );
}

/** Every field of a signed Express option, amounts in collateral units. */
export function ExpressOptionDetails({
  option,
  decimals,
  testId,
}: {
  option: ExpressWithdrawOption;
  decimals: number;
  testId?: string;
}) {
  const usdc = (raw: bigint) => `${formatUsd(raw, decimals)} USDC`;
  const expired = option.deadline * 1000 < Date.now();

  return (
    <DataList data-testid={testId}>
      <DataRow label="optionType" value={`${option.optionTypeName} (${option.optionType})`} mono />
      <DataRow
        label="deadline"
        value={
          <span className="flex items-center gap-2">
            {expired ? <Badge variant="destructive">expired</Badge> : null}
            {formatUnixSeconds(option.deadline)}
          </span>
        }
      />
      <DataRow label="estimatedTime" value={formatEstimate(option.estimatedTimeSeconds)} mono />
      <DataRow label="expressAmount" value={usdc(option.expressAmount)} mono />
      <DataRow label="generalAmount" value={usdc(option.generalAmount)} mono />
      <DataRow label="affiliateAmount" value={usdc(option.affiliateAmount)} mono />
      <DataRow label="creditAmount" value={usdc(option.creditAmount)} mono />
      <DataRow label="fee" value={usdc(option.fee)} mono />
      <DataRow label="operatorFee" value={usdc(option.operatorFee)} mono />
      <DataRow label="maxUserFee" value={usdc(option.maxUserFee)} mono />
      <DataRow label="sponsorCoverage" value={usdc(option.sponsorCoverage)} mono />
      <DataRow label="affiliate" value={option.affiliate} mono copyValue={option.affiliate} />
      <DataRow label="nonce" value={option.nonce.toString()} mono />
      <DataRow
        label="validators"
        value={option.requiresValidators ? `required · min ${option.minValidatorSignatures}` : "not required"}
      />
      <DataRow label="parts" value={String(option.parts.length)} mono />
      <DataRow label="partsHash" value={option.partsHash} mono copyValue={option.partsHash} />
      <DataRow label="signature" value={option.signature} mono copyValue={option.signature} />
      <DataRow label="providerData" value={option.providerData} mono copyValue={option.providerData} />
      <DataRow label="requestDbId" value={String(option.requestDbId)} mono />
      {option.creditCapacityReason ? <DataRow label="creditCapacity" value={option.creditCapacityReason} /> : null}
    </DataList>
  );
}
