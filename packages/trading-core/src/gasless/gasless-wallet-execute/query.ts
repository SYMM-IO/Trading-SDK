import type { Config } from "../../core/config";
import {
  gaslessWalletExecute,
  type GaslessWalletExecuteParameters,
  type GaslessWalletExecuteReturnType,
} from "./gasless-wallet-execute";

/**
 * Build TanStack Mutation options for {@link gaslessWalletExecute}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(gaslessWalletExecuteMutationOptions(config));
 * ```
 */
export function gaslessWalletExecuteMutationOptions(config: Config) {
  return {
    mutationKey: ["gaslessWalletExecute"] as const,
    mutationFn: (variables: GaslessWalletExecuteParameters): Promise<GaslessWalletExecuteReturnType> =>
      gaslessWalletExecute(config, variables),
  };
}
