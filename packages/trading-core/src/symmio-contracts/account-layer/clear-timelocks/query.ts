import type { Config } from "../../../core/config";
import type { ClearTimelocksParameters } from "../timelock-types";
import { clearTimelocks } from "./clear-timelocks";

/** Build TanStack mutation options for {@link clearTimelocks}. */
export function clearTimelocksMutationOptions(config: Config) {
  return {
    mutationKey: ["clearTimelocks"] as const,
    retry: false as const,
    mutationFn: (variables: ClearTimelocksParameters) => clearTimelocks(config, variables),
  };
}
