import { getBinanceHealth, getEnigmaPriceServiceHealth, getSolverReadiness } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useSdkScope } from "./use-sdk-scope.js";

/** Lightweight endpoint probes used by the terminal diagnostics screen. */
export function useSystemHealth() {
  const { config, chainId, solverId } = useSdkScope();
  const chain = config.getChainConfig(chainId);
  const solver = config.getSolver({ chainId, solverId });
  const priceProvider = solver.priceService?.type ?? chain.priceService.type;

  const rpc = useQuery({
    queryKey: ["systemHealth", chainId, "rpc"],
    queryFn: () => config.getClient({ chainId }).getBlockNumber(),
    refetchInterval: 15_000,
    retry: 1,
  });

  const price = useQuery({
    queryKey: ["systemHealth", chainId, solverId, "price", priceProvider],
    queryFn: async () => {
      if (priceProvider === "binance") return getBinanceHealth(config, { chainId, solverId });
      await getEnigmaPriceServiceHealth(config, { chainId });
      return true;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const solverReady = useQuery({
    queryKey: ["systemHealth", chainId, solverId, "solver"],
    queryFn: async () => (await getSolverReadiness(config, { chainId, solverId })).isReady,
    enabled: solver.id === "rasa",
    refetchInterval: 30_000,
    retry: 1,
  });

  return { rpc, price, solverReady, priceProvider };
}
