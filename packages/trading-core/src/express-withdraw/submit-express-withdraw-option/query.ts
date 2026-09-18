import type { Config } from "../../core/config";
import type { SubmitExpressWithdrawOptionParameters } from "../types";
import { submitExpressWithdrawOption } from "./submit-express-withdraw-option";

/**
 * Build TanStack mutation options for {@link submitExpressWithdrawOption}.
 *
 * @param config - SDK configuration.
 * @returns Mutation key and function.
 */
export function submitExpressWithdrawOptionMutationOptions(config: Config) {
  return {
    mutationKey: ["submitExpressWithdrawOption"] as const,
    mutationFn: (variables: SubmitExpressWithdrawOptionParameters) => submitExpressWithdrawOption(config, variables),
  };
}
