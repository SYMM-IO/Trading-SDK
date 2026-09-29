"use client";

import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Address } from "viem";

/**
 * The connected wallet's **native** balance, read through the SDK's own public
 * client.
 *
 * The setup wizard needs it for one decision the SDK has no read for: whether
 * this wallet can pay for a transaction at all. A wallet with zero native
 * balance cannot create a sub-account or approve collateral, so the account
 * step leads with the cold-start route instead of offering a button that can
 * only fail.
 *
 * @param address - The wallet to read. The query stays disabled until it is known.
 * @returns The TanStack query result with the balance in wei.
 */
export function useNativeBalance(address?: Address): UseQueryResult<bigint, Error> {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();

  return useQuery({
    queryKey: ["native-balance", chainId, address],
    enabled: Boolean(address),
    queryFn: () => config.getClient({ chainId }).getBalance({ address: address as Address }),
  });
}
