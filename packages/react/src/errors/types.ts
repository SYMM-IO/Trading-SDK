/**
 * Classification of a normalized SYMMIO SDK error. The discriminator the UI
 * switches on to decide how to render a failed read or write.
 *
 * - `user-rejected` — the connected wallet popup was dismissed by the user.
 *   UIs typically silence this case (no toast, no banner).
 * - `contract-revert` — the on-chain call reverted. `reason` carries the
 *   Solidity revert string when one was emitted.
 * - `insufficient-funds` — the signing EOA had not enough native gas to send
 *   the transaction. Distinct from `contract-revert` because there is no
 *   revert reason and the remediation is "top up the wallet".
 * - `rpc` — a transport-layer failure (network, RPC node unreachable, bad
 *   response). `shortMessage` carries viem's human-readable form.
 * - `sdk` — an SDK-level precondition failed: unknown chain, missing config,
 *   missing wallet, etc. The `cause` is the underlying `SymmError` from
 *   `@symm-frontier/core`.
 * - `unknown` — fell through every classifier. Treat as a real bug to fix.
 */
export type SymmioNormalizedErrorKind =
  | "user-rejected"
  | "contract-revert"
  | "insufficient-funds"
  | "rpc"
  | "sdk"
  | "unknown";
