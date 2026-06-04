import { cn } from "@symm-frontier/ui/lib/utils";

/**
 * Brand glyph — a primary-filled rounded square with stacked up-chevrons,
 * nodding to upward market motion. Size via className (defaults to `size-9`).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground relative inline-flex size-9 items-center justify-center rounded-xl shadow-sm",
        "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-white/25 before:to-transparent",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="relative size-[18px]">
        <path
          d="M5 13.5 12 7l7 6.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 18 12 11.5 19 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
    </span>
  );
}
