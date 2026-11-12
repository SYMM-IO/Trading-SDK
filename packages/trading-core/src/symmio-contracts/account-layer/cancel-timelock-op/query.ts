import type { Config } from "../../../core/config";
import type { CancelTimelockOpParameters } from "../timelock-types";
import { cancelTimelockOp } from "./cancel-timelock-op";

/** Build TanStack mutation options for {@link cancelTimelockOp}. */
export function cancelTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["cancelTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: CancelTimelockOpParameters) => cancelTimelockOp(config, variables),
  };
}
