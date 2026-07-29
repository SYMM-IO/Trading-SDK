/**
 * Shared utility and parameter-helper types used across the SDK's actions and
 * query factories. These mirror the conventions in `@wagmi/core` so the public
 * surface reads the same way: single-property parameter mixins combined into an
 * action's parameter type via `Compute<A & B>`.
 */
import type { Address } from "viem";
import type { SymmioSolverKind } from "../../core/chains/types";

/**
 * Flatten an intersection of object types into a single, readable object type.
 *
 * Purely cosmetic — it has no runtime effect, but it makes hover tooltips show
 * `{ chainId?: number; user: Address }` instead of `ChainIdParameter & { ... }`.
 */
export type Compute<type> = { [key in keyof type]: type[key] } & unknown;

/**
 * Optional chain-id override mixin. When omitted, an action falls back to the
 * config's `defaultChainId`.
 */
export interface ChainIdParameter {
  /** Target chain id. Defaults to the config's `defaultChainId` when omitted. */
  chainId?: number;
}

/**
 * Optional config-fingerprint mixin. `configKey` is folded into a query key so a
 * runtime config override (which changes the resolved chain config but not the
 * `chainId`) yields a fresh key — TanStack refetches with the new config instead
 * of serving stale cache, and the previous config's data stays cached.
 *
 * The query option factories set this automatically from
 * `config.getChainConfigKey(chainId)`; you do not normally pass it by hand.
 */
export interface ConfigKeyParameter {
  /** Stable fingerprint of the resolved chain config; see {@link ConfigKeyParameter}. */
  configKey?: string;
}

/**
 * Optional sender mixin for simulations. `from` is the address a dry-run
 * (`simulateContract`) executes as — it becomes `msg.sender` for the call. When
 * omitted, viem simulates from the zero address. Named `from` (not `account`) so
 * it never collides with an action's own `account` / `user` parameter.
 */
export interface FromParameter {
  /** Address the simulation runs as (becomes `msg.sender`). Defaults to the connected wallet in the React layer. */
  from?: Address;
}

/**
 * Opt-out mixin for the pre-send dry-run on write actions. When the resolved
 * value is `true`, a write runs `simulateContract` first and aborts (throwing the
 * decoded revert) if the transaction would fail — so nothing is signed or
 * broadcast. Resolution is `parameters.simulateBeforeWrite ?? config.simulateBeforeWrite`,
 * and `config.simulateBeforeWrite` itself defaults to `true`.
 */
export interface SimulateBeforeWriteParameter {
  /** Dry-run via `simulateContract` before sending; abort if it would revert. Defaults to the config's `simulateBeforeWrite` (`true` by default). */
  simulateBeforeWrite?: boolean;
}

/**
 * Optional solver-selection mixin. Picks which configured solver an action
 * targets by its id — which is its kind (`"enigma" | "rasa"`); when omitted, the
 * config's default solver for the chain is used
 * (`config.getSolver({ chainId, solverId })`).
 */
export interface SolverIdParameter {
  /** Solver kind to target. Defaults to the chain's default solver. */
  solverId?: SymmioSolverKind;
}

/**
 * Standard mixin set every solver/hedger **read** action accepts: optional chain
 * id plus optional solver selection.
 */
export type ReadSolverParameter = ChainIdParameter & SolverIdParameter;

/**
 * Standard mixin set every on-chain write action accepts.
 *
 * Bundles the three mixins every write supports — optional chain id, optional
 * signer/from override, and the dry-run opt-out — into one alias so an action's
 * parameter type stays focused on its action-specific fields:
 *
 * ```ts
 * export type DepositForAccountParameters = Compute<
 *   WriteContractParameter & {
 *     account: Address;
 *     amount: bigint;
 *   }
 * >;
 * ```
 */
export type WriteContractParameter = ChainIdParameter & FromParameter & SimulateBeforeWriteParameter;

/**
 * Standard mixin set every off-chain solver/hedger write action accepts.
 *
 * Bundles the two mixins solver writes need — optional chain id and optional
 * signer/from override — into one alias. Solver writes never simulate
 * on-chain (they POST to an HTTP endpoint), so the `simulateBeforeWrite` flag
 * is intentionally omitted; that's the only difference from
 * {@link WriteContractParameter}.
 *
 * ```ts
 * export type InstantCloseParameters = Compute<
 *   WriteSolverParameter & {
 *     partyA: Address;
 *     order: InstantCloseOrder;
 *   }
 * >;
 * ```
 */
export type WriteSolverParameter = ChainIdParameter & FromParameter & SolverIdParameter;

/**
 * Like `Partial<T>`, but each property is also explicitly `| undefined`. Used
 * for query-options shapes where every action parameter becomes optional.
 */
export type ExactPartial<type> = {
  [key in keyof type]?: type[key] | undefined;
};

/**
 * Recursive `Partial`. Used for per-chain config overrides passed to
 * {@link createConfig}, where a consumer may override a single nested address.
 *
 * Arrays are treated as leaves: an array-valued field stays optional but its
 * element type is left untouched (no `| undefined` is injected into items), so
 * an overriding array is replaced wholesale rather than partially patched.
 */
export type DeepPartial<type> = type extends readonly unknown[]
  ? type
  : type extends object
    ? { [key in keyof type]?: DeepPartial<type[key]> }
    : type;
