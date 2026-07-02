import type { Config } from "../../core/config";
import { deleteQuoteTpSl, type DeleteQuoteTpSlParameters } from "./delete-quote-tpsl";

/**
 * Build TanStack Mutation options for {@link deleteQuoteTpSl}.
 *
 * @example
 * ```ts
 * useMutation(deleteQuoteTpSlMutationOptions(config));
 * ```
 */
export function deleteQuoteTpSlMutationOptions(config: Config) {
  return {
    mutationKey: ["deleteQuoteTpSl"] as const,
    mutationFn: (variables: DeleteQuoteTpSlParameters) => deleteQuoteTpSl(config, variables),
  };
}
