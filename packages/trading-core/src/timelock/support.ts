import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/** @internal Reject deployments explicitly configured without timelock support. */
export function assertTimelockSupported(config: Config, chainId?: number): void {
  if (config.getChainConfig(chainId).timelockSupported === false)
    throw new SymmError(
      "config",
      "TIMELOCK_NOT_SUPPORTED",
      "Timelocks are not available on this configured deployment.",
    );
}
