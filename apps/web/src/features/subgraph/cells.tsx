"use client";

import { AddressTag } from "@/components/address-tag";
import { useBlockExplorer } from "@/lib/explorer";
import { WEI_DECIMALS } from "@/lib/format";
import { Badge } from "@symmio/ui/components/badge";
import { formatTokenAmount } from "@symmio/utils";
import type { ColumnSpec } from "./read-catalog";

/** Format a unix-seconds timestamp as a local `YYYY-MM-DD HH:mm:ss` string. */
function formatTimestamp(seconds: number): string {
  const date = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Truncate a 32-byte tx hash for display (`shortenAddress` is 20-byte only). */
function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** A field the subgraph did not index for this row. Never shown as `0`, which would read as a real value. */
function NotIndexed() {
  return (
    <span className="text-muted-foreground" title="Not indexed: the SDK returned null or no value">
      —
    </span>
  );
}

function TxLink({ hash }: { hash: string }) {
  const { txUrl } = useBlockExplorer();
  const href = txUrl(hash);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="text-primary font-mono hover:underline"
      aria-label="View transaction on block explorer"
    >
      {shortenHash(hash)}
    </a>
  ) : (
    <span className="text-muted-foreground font-mono" title={hash}>
      {shortenHash(hash)}
    </span>
  );
}

interface Props {
  column: ColumnSpec;
  value: unknown;
  /** Collateral decimals, for `collateral` cells. */
  collateralDecimals: number;
}

/**
 * One result cell. Amounts show scaled with the raw integer on hover, so a
 * number can be checked against the subgraph or another branch digit for digit.
 */
export function ResultCell({ column, value, collateralDecimals }: Props) {
  if (value === null || value === undefined) return <NotIndexed />;

  switch (column.kind) {
    case "wei":
    case "collateral": {
      if (typeof value !== "bigint") return <span className="font-mono">{String(value)}</span>;
      const decimals = column.kind === "wei" ? WEI_DECIMALS : collateralDecimals;
      return (
        <span className="font-mono whitespace-nowrap" title={`${value.toString()} (raw, ${decimals} decimals)`}>
          {formatTokenAmount(value, decimals, { maxFractionDigits: 6 })}
        </span>
      );
    }
    case "address":
      return <AddressTag address={String(value)} chars={4} className="whitespace-nowrap" />;
    case "tx":
      return <TxLink hash={String(value)} />;
    case "time":
      return typeof value === "number" ? (
        <span className="text-muted-foreground whitespace-nowrap" title={`${value} (unix seconds)`}>
          {formatTimestamp(value)}
        </span>
      ) : (
        <span className="font-mono">{String(value)}</span>
      );
    case "bool":
      return <Badge variant={value ? "positive" : "secondary"}>{value ? "yes" : "no"}</Badge>;
    case "badge": {
      const label =
        typeof value === "number" && column.enumLabels ? (column.enumLabels[value] ?? String(value)) : String(value);
      return (
        <Badge variant="outline" className="font-mono" title={String(value)}>
          {label}
        </Badge>
      );
    }
    case "int":
      return <span className="font-mono">{String(value)}</span>;
    default:
      return (
        <span className="line-clamp-2 break-all" title={String(value)}>
          {String(value)}
        </span>
      );
  }
}
