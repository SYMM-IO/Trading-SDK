import type { Config } from "../../../core/config";
import type { ScheduleTimelockOpParameters } from "../timelock-types";
import { scheduleTimelockOp } from "./schedule-timelock-op";

/** Build TanStack mutation options for {@link scheduleTimelockOp}. */
export function scheduleTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["scheduleTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: ScheduleTimelockOpParameters) => scheduleTimelockOp(config, variables),
  };
}
