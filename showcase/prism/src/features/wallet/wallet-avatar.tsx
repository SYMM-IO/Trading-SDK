import { cn } from "@/lib/cn";
import type { Address } from "viem";

/**
 * A two-stop gradient derived from the address itself.
 *
 * Deterministic, so the same wallet always looks the same across sessions and
 * screens; distinct enough that two wallets a user switches between are told
 * apart at a glance, which a six-character address prefix is not. Saturation
 * and lightness are fixed so every result sits on the dark surfaces with the
 * same weight.
 */
export function walletGradient(address: Address): string {
  const lead = Number.parseInt(address.slice(2, 8), 16) || 0;
  const tail = Number.parseInt(address.slice(8, 14), 16) || 0;
  const first = lead % 360;
  const second = (first + 40 + (tail % 80)) % 360;
  return `linear-gradient(135deg, hsl(${first} 85% 66%), hsl(${second} 80% 50%))`;
}

interface Props {
  address: Address;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/** The wallet's identity dot. Purely visual — the address beside it is the label. */
export function WalletAvatar({ address, size = 16, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]", className)}
      style={{ width: size, height: size, background: walletGradient(address) }}
    />
  );
}
