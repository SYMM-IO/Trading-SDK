"use client";

import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { erc20Abi, type Address } from "viem";

/** Parameters for {@link useGaslessTokenBalance}. */
interface Parameters {
  /** The ERC-20 to read — the GaslessLayer's own `collateralToken()`. */
  token?: Address;
  /** Whose balance to read (a derived GaslessWallet address). */
  holder?: Address;
  /** Poll interval in ms while the card is mounted. */
  refetchInterval?: number;
}

/**
 * Balance of one ERC-20 for one holder, read through the SDK's own public
 * client.
 *
 * The gasless cards deliberately do not use `useCollateralBalance` for this:
 * that hook reads the *chain config's* collateral token, while a GaslessLayer
 * names its own `collateralToken()` and reports it (with its decimals) in the
 * deposit policy. A deployment whose gasless collateral differs from the
 * configured one would otherwise watch the wrong token — and format it at the
 * wrong scale.
 *
 * It carries its own query key, so the SDK's post-settlement invalidation does
 * not reach it; the caller polls instead, which is what a deposit address being
 * funded from outside the app needs anyway.
 *
 * @param parameters - Token, holder and poll interval. Disabled until both addresses are known.
 * @returns The TanStack query result with the raw balance in the token's own units.
 */
export function useGaslessTokenBalance({ token, holder, refetchInterval }: Parameters): UseQueryResult<bigint, Error> {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();

  return useQuery({
    queryKey: ["gasless-token-balance", chainId, token, holder],
    enabled: Boolean(token && holder),
    refetchInterval,
    queryFn: () =>
      config.getClient({ chainId }).readContract({
        address: token as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [holder as Address],
      }),
  });
}
