import { addressExplorerUrl } from "@/lib/explorer";
import { CopyButton } from "@symm-frontier/ui/components/copy-button";
import { cn } from "@symm-frontier/ui/lib/utils";
import { shortenAddress } from "@symm-frontier/utils";
import type { Address } from "viem";

interface Props {
  address: string;
  /** Characters kept on each side of the ellipsis. Defaults to `4`. */
  chars?: number;
  /** Show the explorer link when a URL can be resolved. Defaults to `true`. */
  explorer?: boolean;
  copyLabel?: string;
  className?: string;
}

/**
 * Renders a checksummed, shortened address in mono with a copy control and an
 * optional block-explorer link. The full address is exposed via `title` and to
 * the clipboard.
 */
export function AddressTag({ address, chars = 4, explorer = true, copyLabel = "Copy address", className }: Props) {
  const href = explorer ? addressExplorerUrl(address) : undefined;

  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-sm", className)}>
      <span className="text-foreground" title={address}>
        {shortenAddress(address as Address, { chars })}
      </span>
      <CopyButton value={address} label={copyLabel} className="size-5" />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View on block explorer"
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
    </span>
  );
}
