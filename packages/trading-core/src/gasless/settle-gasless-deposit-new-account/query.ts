import type { Config } from "../../core/config";
import {
  settleGaslessDepositNewAccount,
  type SettleGaslessDepositNewAccountParameters,
  type SettleGaslessDepositNewAccountReturnType,
} from "./settle-gasless-deposit-new-account";

/**
 * Build TanStack Mutation options for {@link settleGaslessDepositNewAccount}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(settleGaslessDepositNewAccountMutationOptions(config));
 * ```
 */
export function settleGaslessDepositNewAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["settleGaslessDepositNewAccount"] as const,
    mutationFn: (
      variables: SettleGaslessDepositNewAccountParameters,
    ): Promise<SettleGaslessDepositNewAccountReturnType> => settleGaslessDepositNewAccount(config, variables),
  };
}
