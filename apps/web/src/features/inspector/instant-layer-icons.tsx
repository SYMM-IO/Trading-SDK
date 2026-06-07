/** Trigger icons for the Instant Layer delegation pickers, in the app's inline-SVG style. */

/** A wallet glyph — marks the delegatee / delegated-signer picker. */
export function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M16 12h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Curly-brace glyph — marks the function-selector picker. */
export function SelectorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
      <path
        d="M8 4c-2 0-2.5 1.2-2.5 3 0 1.6.2 3-1.5 5 1.7 2 1.5 3.4 1.5 5 0 1.8.5 3 2.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 4c2 0 2.5 1.2 2.5 3 0 1.6-.2 3 1.5 5-1.7 2-1.5 3.4-1.5 5 0 1.8-.5 3-2.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
