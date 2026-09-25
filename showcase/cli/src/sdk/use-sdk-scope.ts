import { useDeployment } from "../config/deployment-context.js";
import { getConfig } from "../config/symmio.js";

/** The immutable SDK profile plus the active chain/solver selection. */
export function useSdkScope() {
  const { deployment, environment } = useDeployment();
  return {
    config: getConfig(environment),
    deployment,
    environment,
    chainId: deployment.chainId,
    solverId: deployment.solverId,
  };
}
