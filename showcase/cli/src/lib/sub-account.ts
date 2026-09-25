import { SubAccountIsolationType } from "@symmio/trading-core";

/** Whether this account trades cross-margin directly from its allocated balance. */
export function isCrossMarginIsolation(value: SubAccountIsolationType | undefined): boolean {
  return value === SubAccountIsolationType.CUSTOM;
}

/** Whether the active solver's instant-open adapter supports this account model. */
export function isIsolationCompatibleWithSolver(value: SubAccountIsolationType | undefined, solverId: string): boolean {
  if (value == null) return false;
  return solverId === "rasa"
    ? value === SubAccountIsolationType.CUSTOM
    : value === SubAccountIsolationType.MARKET_DIRECTION;
}

/** Human-readable isolation name for terminal diagnostics and account forms. */
export function isolationLabel(value: SubAccountIsolationType): string {
  switch (value) {
    case SubAccountIsolationType.POSITION:
      return "POSITION";
    case SubAccountIsolationType.MARKET:
      return "MARKET";
    case SubAccountIsolationType.MARKET_DIRECTION:
      return "MARKET + DIRECTION";
    case SubAccountIsolationType.CUSTOM:
      return "CUSTOM (cross-margin)";
  }
}
