import type { Config } from "../../core/config";
import { setQuoteTpSl, type SetQuoteTpSlParameters } from "./set-quote-tpsl";

/**
 * Build TanStack Mutation options for {@link setQuoteTpSl}.
 *
 * @example
 * ```ts
 * useMutation(setQuoteTpSlMutationOptions(config));
 * ```
 */
export function setQuoteTpSlMutationOptions(config: Config) {
  return {
    mutationKey: ["setQuoteTpSl"] as const,
    mutationFn: (variables: SetQuoteTpSlParameters) => setQuoteTpSl(config, variables),
  };
}
