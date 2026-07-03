import type { SymmioTpSlConfig } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";

/**
 * Resolve the TP/SL handler config for a chain. Throws when the solver does
 * not declare a `tpsl` block — phase 1 only supports chains that do.
 */
export function resolveTpSlConfig(config: Config, chainId?: number): SymmioTpSlConfig {
  const chainConfig = config.getChainConfig(chainId);
  const tpsl = chainConfig.solver.tpsl;
  if (!tpsl) {
    throw new SymmError(
      "config",
      "TPSL_NOT_CONFIGURED",
      `TP/SL handler is not configured for chain ${chainConfig.chainId}. Solver "${chainConfig.solver.name}" has no \`tpsl\` block.`,
    );
  }
  return tpsl;
}
