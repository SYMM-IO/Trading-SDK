import { cn } from "@symmio/ui/lib/utils";

interface Props {
  /** Size / colour overrides; defaults to `size-3.5` inheriting the current colour. */
  className?: string;
}

/**
 * Inline "info" glyph, for the affordance next to a label whose value is
 * calculated rather than read straight off a contract.
 *
 * Inline SVG on purpose: this app never imports lucide (that dependency belongs
 * to `@symmio/ui`).
 */
export function InfoIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
