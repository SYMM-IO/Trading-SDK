import { getQuoteFunding, getQuotePendingFunding } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useSdkScope } from "./use-sdk-scope.js";

/** Settled (subgraph) and pending (on-chain) funding for one active quote. */
export function usePositionFunding(quoteId?: bigint) {
  const { config, chainId } = useSdkScope();

  const settled = useQuery({
    queryKey: ["positionFunding", chainId, quoteId?.toString(), "settled"],
    queryFn: async () => (await getQuoteFunding(config, { chainId, quoteIds: [quoteId as bigint] })).rows[0],
    enabled: quoteId != null,
    staleTime: 30_000,
  });

  const pending = useQuery({
    queryKey: ["positionFunding", chainId, quoteId?.toString(), "pending"],
    queryFn: async () => (await getQuotePendingFunding(config, { chainId, quoteIds: [quoteId as bigint] }))[0],
    enabled: quoteId != null,
    refetchInterval: 30_000,
  });

  return {
    settled: settled.data?.netReceived,
    pending: pending.data?.pendingNetReceived,
    isLoading: settled.isLoading || pending.isLoading,
    error: settled.error ?? pending.error,
  };
}
