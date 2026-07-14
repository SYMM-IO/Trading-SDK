/**
 * Brand lockup for the docs navbar — the Symmio brand mark plus the "Symmio
 * Frontier" wordmark, so the docs read as the same product as the app. The mark
 * is two bracket forms around a coral center bar; the brackets use
 * `currentColor` (light/dark adaptive) and the bar keeps the fixed Symmio coral.
 * Styling lives in globals.css (`.symm-mark`, `.symm-word`, `.symm-tag`).
 */
export function SymmioLogo() {
  return (
    <span className="symm-logo" aria-label="Symmio Frontier">
      <span className="symm-mark" aria-hidden="true">
        <svg viewBox="0 0 880 633" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      </span>
      <span className="symm-word">Symmio</span>
      <span className="symm-tag">Frontier</span>
    </span>
  );
}
