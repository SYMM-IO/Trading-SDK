import type { Config } from "../../core/config";
import type { SimulateBeforeWriteParameter } from "../types/properties";

/**
 * Resolve whether a write should dry-run with `simulateContract` before sending.
 *
 * Precedence: the call's own `simulateBeforeWrite` wins; otherwise the config's
 * `simulateBeforeWrite` default applies (itself `true` unless overridden in
 * `createConfig`).
 *
 * @param config - The SDK config.
 * @param parameters - The write action's parameters (only `simulateBeforeWrite` is read).
 * @returns `true` when the write should pre-flight a simulation.
 *
 * @example
 * ```ts
 * if (shouldSimulateBeforeWrite(config, parameters)) {
 *   await simulateCreateSubAccounts(config, { ...parameters, from });
 * }
 * ```
 */
export function shouldSimulateBeforeWrite(config: Config, parameters: SimulateBeforeWriteParameter): boolean {
  return parameters.simulateBeforeWrite ?? config.simulateBeforeWrite;
}
