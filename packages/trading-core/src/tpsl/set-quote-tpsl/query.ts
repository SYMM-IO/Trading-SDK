import type { Config } from "../../core/config";
import { setQuoteTpSl, type SetQuoteTpSlParameters } from "./set-quote-tpsl";

/**
 * Build TanStack Mutation options for {@link setQuoteTpSl}.
 *
 * Automatic retries are disabled: a failed response may follow an accepted write.
 * Reconcile state before explicitly submitting again.
 *
 * @example
 * ```ts
 * useMutation(setQuoteTpSlMutationOptions(config));
 * ```
 */
export function setQuoteTpSlMutationOptions(config: Config) {
  return {
    retry: false,
    mutationKey: ["setQuoteTpSl"] as const,
    mutationFn: (variables: SetQuoteTpSlParameters) => setQuoteTpSl(config, variables),
  };
}
