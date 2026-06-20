/**
 * Brand lockup for the docs navbar — a faithful port of apps/web's `LogoMark`
 * plus the "Symmio Frontier" wordmark, so the docs read as the same product as
 * the app. The mark is a cobalt rounded square with a top-left sheen and the
 * stacked up-chevrons that nod to upward market motion; styling lives in
 * globals.css (`.symm-mark`, `.symm-word`, `.symm-tag`).
 */
export function SymmioLogo() {
  return (
    <span className="symm-logo" aria-label="Symmio Frontier">
      <span className="symm-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
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
      <span className="symm-word">Symmio</span>
      <span className="symm-tag">Frontier</span>
    </span>
  );
}
