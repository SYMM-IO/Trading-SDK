import type { Config } from "../../core/config";
import {
  settleGaslessDepositExistingAccount,
  type SettleGaslessDepositExistingAccountParameters,
  type SettleGaslessDepositExistingAccountReturnType,
} from "./settle-gasless-deposit-existing-account";

/**
 * Build TanStack Mutation options for {@link settleGaslessDepositExistingAccount}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(settleGaslessDepositExistingAccountMutationOptions(config));
 * ```
 */
export function settleGaslessDepositExistingAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["settleGaslessDepositExistingAccount"] as const,
    mutationFn: (
      variables: SettleGaslessDepositExistingAccountParameters,
    ): Promise<SettleGaslessDepositExistingAccountReturnType> => settleGaslessDepositExistingAccount(config, variables),
  };
}
