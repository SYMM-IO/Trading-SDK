import { cn } from "@symmio/ui/lib/utils";

/**
 * The Symmio brand mark — two interlocking bracket forms around a coral center
 * bar. The same mark `apps/web` uses, so the two surfaces read as one product.
 * The brackets inherit `currentColor` (light/dark adaptive); the center bar
 * keeps the fixed Symmio coral. Size via className (defaults to `h-6 w-auto`).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 880 633"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Symmio"
      className={cn("text-foreground h-6 w-auto", className)}
    >
      <path
        d="M0 498.172V633H712.968V576.873C712.968 484.621 787.75 409.836 880 409.836V223.866H694.408V493.522L0 498.172Z"
        fill="currentColor"
      />
      <path
        d="M880 134.828V0H167.032V56.127C167.032 148.379 92.2495 223.164 0 223.164V409.134H185.592V139.478L880 134.828Z"
        fill="currentColor"
      />
      <path d="M270.175 223.866H609.825V409.134H270.175V223.866Z" fill="#ED4A3F" />
    </svg>
  );
}
