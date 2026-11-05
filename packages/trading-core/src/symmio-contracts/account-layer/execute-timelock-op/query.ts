import type { Config } from "../../../core/config";
import type { ExecuteTimelockOpParameters } from "../timelock-types";
import { executeTimelockOp } from "./execute-timelock-op";

/** Build TanStack mutation options for {@link executeTimelockOp}. */
export function executeTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["executeTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: ExecuteTimelockOpParameters) => executeTimelockOp(config, variables),
  };
}
