/**
 * Shared utility and parameter-helper types used across the SDK's actions and
 * query factories. These mirror the conventions in `@wagmi/core` so the public
 * surface reads the same way: single-property parameter mixins combined into an
 * action's parameter type via `Compute<A & B>`.
 */

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
 * Like `Partial<T>`, but each property is also explicitly `| undefined`. Used
 * for query-options shapes where every action parameter becomes optional.
 */
export type ExactPartial<type> = {
  [key in keyof type]?: type[key] | undefined;
};

/**
 * Recursive `Partial`. Used for per-chain config overrides passed to
 * {@link createConfig}, where a consumer may override a single nested address.
 */
export type DeepPartial<type> = type extends object ? { [key in keyof type]?: DeepPartial<type[key]> } : type;
