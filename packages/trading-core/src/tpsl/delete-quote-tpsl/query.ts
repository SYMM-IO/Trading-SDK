import type { Config } from "../../core/config";
import { deleteQuoteTpSl, type DeleteQuoteTpSlParameters } from "./delete-quote-tpsl";

/**
 * Build TanStack Mutation options for {@link deleteQuoteTpSl}.
 *
 * Automatic retries are disabled: a failed response may follow an accepted write.
 * Reconcile state before explicitly submitting again.
 *
 * @example
 * ```ts
 * useMutation(deleteQuoteTpSlMutationOptions(config));
 * ```
 */
export function deleteQuoteTpSlMutationOptions(config: Config) {
  return {
    retry: false,
    mutationKey: ["deleteQuoteTpSl"] as const,
    mutationFn: (variables: DeleteQuoteTpSlParameters) => deleteQuoteTpSl(config, variables),
  };
}
