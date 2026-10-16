import type { Config } from "../../core/config";
import type { WithdrawWithExpressParameters } from "../types";
import { withdrawWithExpress } from "./withdraw-with-express";

/**
 * Build TanStack mutation options for {@link withdrawWithExpress}.
 *
 * @param config - SDK configuration.
 * @returns Mutation key and function.
 */
export function withdrawWithExpressMutationOptions(config: Config) {
  return {
    mutationKey: ["withdrawWithExpress"] as const,
    mutationFn: (variables: WithdrawWithExpressParameters) => withdrawWithExpress(config, variables),
  };
}
