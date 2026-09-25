import { SymmioSupportedChainId, type SolverId } from "@symmio/trading-core";
import { arbitrum, base, type Chain } from "viem/chains";

/** One tradeable SDK deployment exposed by the terminal. */
export interface Deployment {
  id: "arbitrum" | "base";
  label: string;
  product: string;
  chainId: SymmioSupportedChainId;
  chain: Chain;
  solverId: SolverId;
  solverLabel: string;
  rpcUrls: readonly string[];
}

/** Current production deployments shipped by `@symmio/trading-core`. */
export const DEPLOYMENTS: readonly Deployment[] = [
  {
    id: "arbitrum",
    label: "Arbitrum",
    product: "Lowcaps",
    chainId: SymmioSupportedChainId.ARBITRUM,
    chain: arbitrum,
    solverId: "enigma",
    solverLabel: "Enigma",
    rpcUrls: arbitrum.rpcUrls.default.http,
  },
  {
    id: "base",
    label: "Base",
    product: "Majors",
    chainId: SymmioSupportedChainId.BASE,
    chain: base,
    solverId: "rasa",
    solverLabel: "Rasa",
    rpcUrls: ["https://mainnet.base.org", "https://base.drpc.org"],
  },
] as const;

/** Resolve a configured deployment by its stable terminal id. */
export function getDeployment(id: Deployment["id"]): Deployment {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.id === id);
  if (!deployment) throw new Error(`Unknown deployment: ${id}`);
  return deployment;
}

/** Resolve a configured deployment by chain id. */
export function getDeploymentByChainId(chainId: number): Deployment {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.chainId === chainId);
  if (!deployment) throw new Error(`Unsupported CLI chain: ${chainId}`);
  return deployment;
}
