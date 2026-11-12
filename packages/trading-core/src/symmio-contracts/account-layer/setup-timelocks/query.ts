import type { Config } from "../../../core/config";
import type { SetupTimelocksParameters } from "../timelock-types";
import { setupTimelocks } from "./setup-timelocks";

/** Build TanStack mutation options for {@link setupTimelocks}. */
export function setupTimelocksMutationOptions(config: Config) {
  return {
    mutationKey: ["setupTimelocks"] as const,
    retry: false as const,
    mutationFn: (variables: SetupTimelocksParameters) => setupTimelocks(config, variables),
  };
}
