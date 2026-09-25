import {
  getSolverCapabilities,
  supportsGaslessService,
  supportsInventoryService,
  supportsTpSl,
} from "@symmio/trading-core";
import { useMemo } from "react";
import { useSdkScope } from "./use-sdk-scope.js";

/** Feature switches resolved from the active chain + solver configuration. */
export function useCapabilities() {
  const { config, chainId, solverId } = useSdkScope();

  return useMemo(() => {
    const solver = getSolverCapabilities(config, { chainId, solverId });
    return {
      ...solver,
      tpSl: supportsTpSl(config, { chainId, solverId }),
      inventory: supportsInventoryService(config, chainId),
      gasless: supportsGaslessService(config, { chainId }),
    };
  }, [config, chainId, solverId]);
}
