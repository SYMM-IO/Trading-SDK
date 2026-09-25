import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEPLOYMENTS, getDeployment, type Deployment } from "./deployments.js";
import { getInitialDeploymentId, getInitialEnvironment, type SdkEnvironment } from "./environment.js";

interface DeploymentContextValue {
  deployment: Deployment;
  environment: SdkEnvironment;
  selectDeployment: (id: Deployment["id"]) => void;
  cycleDeployment: (direction?: 1 | -1) => void;
  selectEnvironment: (environment: SdkEnvironment) => void;
  cycleEnvironment: () => void;
}

const DeploymentContext = createContext<DeploymentContextValue | null>(null);

/** Holds the chain/solver deployment currently browsed by the terminal. */
export function DeploymentProvider({ children }: { children: ReactNode }) {
  const initialEnvironment = getInitialEnvironment();
  const [environment, setEnvironment] = useState<SdkEnvironment>(initialEnvironment);
  const [deploymentId, setDeploymentId] = useState<Deployment["id"]>(() =>
    initialEnvironment === "staging" ? "arbitrum" : getInitialDeploymentId(),
  );
  const deployment = getDeployment(deploymentId);

  const selectDeployment = useCallback(
    (id: Deployment["id"]) => {
      if (environment === "staging" && id !== "arbitrum") return;
      setDeploymentId(id);
    },
    [environment],
  );

  const cycleDeployment = useCallback(
    (direction: 1 | -1 = 1) => {
      if (environment === "staging") return;
      setDeploymentId((current) => {
        const index = DEPLOYMENTS.findIndex((candidate) => candidate.id === current);
        return DEPLOYMENTS[(index + direction + DEPLOYMENTS.length) % DEPLOYMENTS.length]!.id;
      });
    },
    [environment],
  );

  const selectEnvironment = useCallback((next: SdkEnvironment) => {
    setEnvironment(next);
    if (next === "staging") setDeploymentId("arbitrum");
  }, []);

  const cycleEnvironment = useCallback(() => {
    selectEnvironment(environment === "production" ? "staging" : "production");
  }, [environment, selectEnvironment]);

  const value = useMemo<DeploymentContextValue>(
    () => ({ deployment, environment, selectDeployment, cycleDeployment, selectEnvironment, cycleEnvironment }),
    [deployment, environment, selectDeployment, cycleDeployment, selectEnvironment, cycleEnvironment],
  );

  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

/** Access the active chain/solver deployment. */
export function useDeployment(): DeploymentContextValue {
  const value = useContext(DeploymentContext);
  if (!value) throw new Error("useDeployment must be used within DeploymentProvider.");
  return value;
}
