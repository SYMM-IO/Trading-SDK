import { txExplorerUrl } from "@/lib/explorer";
import { CopyButton } from "@theoldvarorg/ui/components/copy-button";
import { minifyHash } from "@theoldvarorg/utils";

interface Props {
  hash: string;
  receipt?: { blockNumber: bigint; status: string };
}

/** Compact confirmation row for a submitted transaction — hash, copy, explorer link, and receipt summary. */
export function TxReceipt({ hash, receipt }: Props) {
  const href = txExplorerUrl(hash);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground/60 font-mono text-xs">tx</span>
        <span className="text-foreground font-mono text-xs">{minifyHash(hash)}</span>
        <CopyButton value={hash} label="Copy transaction hash" className="size-5" />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View transaction on block explorer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex size-5 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
              <path
                d="M6 3.5H4.5A1.5 1.5 0 0 0 3 5v6.5A1.5 1.5 0 0 0 4.5 13H11a1.5 1.5 0 0 0 1.5-1.5V10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M9.5 3.5H13V7M12.5 4 7.5 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : null}
      </div>
      {receipt ? (
        <span className="text-foreground/70 text-xs">
          mined in block {String(receipt.blockNumber)} · status {receipt.status}
        </span>
      ) : null}
    </div>
  );
}
