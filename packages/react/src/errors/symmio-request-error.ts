import type { SymmioNormalizedErrorKind } from "./types";

/**
 * Options accepted by the {@link SymmioRequestError} constructor. Carries
 * the discriminator-specific fields the UI cares about.
 */
export interface SymmioRequestErrorOptions {
  kind: SymmioNormalizedErrorKind;
  message: string;
  /** Solidity revert reason. Only meaningful when `kind === "contract-revert"`. */
  reason?: string;
  /** viem's human-readable short message. Only meaningful when `kind === "rpc"`. */
  shortMessage?: string;
  /** The original underlying error, kept for debugging. */
  cause?: unknown;
}

/**
 * The single error class every SYMMIO React hook throws when a read or write
 * fails. Carries a discriminator (`kind`) the UI can switch on without
 * inspecting viem's internal error hierarchy.
 *
 * @example
 * const { error } = useUserSubAccounts({ user });
 * if (error?.kind === "user-rejected") return null;       // silent
 * if (error?.kind === "contract-revert") return <ShowReason reason={error.reason} />;
 * if (error) return <GenericError message={error.message} />;
 */
export class SymmioRequestError extends Error {
  override readonly name = "SymmioRequestError";
  /** Classification used by the UI to branch on this failure. */
  readonly kind: SymmioNormalizedErrorKind;
  /** Solidity revert reason when `kind === "contract-revert"`. */
  readonly reason?: string;
  /** viem's short message when `kind === "rpc"`. */
  readonly shortMessage?: string;

  constructor(options: SymmioRequestErrorOptions) {
    super(options.message, { cause: options.cause });
    this.kind = options.kind;
    this.reason = options.reason;
    this.shortMessage = options.shortMessage;
  }
}
