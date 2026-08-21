"use client";

import { getDeployment } from "@/config/deployments";
import { getEnigmaPriceServiceMetadataQueryOptions, type EnigmaMetadataByAddress } from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import type { PrismMarket } from "./types";

/** The price service accepts at most 50 addresses per request. */
const MAX_ADDRESSES_PER_REQUEST = 50;

/** One pool's vitals, as the Enigma price service reports them. */
export type PoolMetadata = EnigmaMetadataByAddress[string];

export interface UsePoolMetadataResult {
  /** Pool vitals for a market, or `undefined` if it is not pool-priced. */
  poolOf: (market: PrismMarket) => PoolMetadata | undefined;
  /** 24h price change percent for a pool-priced market. */
  changeOf: (market: PrismMarket) => number | undefined;
  isLoading: boolean;
}

/**
 * Pool vitals for a set of pool-priced markets.
 *
 * Lowcap markets have no exchange listing, so the solver's market-info endpoint
 * publishes no price change for them and the naive conclusion is that lowcaps
 * simply have no 24h figure. They do — it lives on the pool, and the price
 * service returns it alongside the pool's address, liquidity and market cap.
 *
 * Requests are chunked to the price service's 50-address limit and cached for a
 * minute, so the trade screen, the markets table and the pool panel all share
 * one set of responses rather than each fetching their own.
 */
export function usePoolMetadata(markets: readonly PrismMarket[]): UsePoolMetadataResult {
  const config = useSymmioConfig();

  /* Only Enigma markets carry a token address, and only a token address can be
     resolved to a pool. Deduped because one token can back several markets. */
  const addresses = useMemo(() => {
    const seen = new Set<string>();
    for (const entry of markets) {
      if (entry.market.kind !== "enigma") continue;
      const address = entry.market.tokenAddress;
      if (address) seen.add(address);
    }
    return [...seen];
  }, [markets]);

  const chunks = useMemo(() => {
    const groups: string[][] = [];
    for (let index = 0; index < addresses.length; index += MAX_ADDRESSES_PER_REQUEST) {
      groups.push(addresses.slice(index, index + MAX_ADDRESSES_PER_REQUEST));
    }
    return groups;
  }, [addresses]);

  const lowcapChainId = getDeployment("lowcaps").chainId;

  const results = useQueries({
    queries: chunks.map(
      (chunk) =>
        ({
          ...getEnigmaPriceServiceMetadataQueryOptions(config, {
            chainId: lowcapChainId,
            addresses: chunk,
          }),
          staleTime: 60_000,
          gcTime: 5 * 60_000,
        }) as UseQueryOptions<EnigmaMetadataByAddress, Error, EnigmaMetadataByAddress, readonly unknown[]>,
    ),
  });

  const byAddress = useMemo(() => {
    const merged = new Map<string, PoolMetadata>();
    for (const result of results) {
      for (const [address, pool] of Object.entries(result.data ?? {})) {
        if (pool) merged.set(address, pool as PoolMetadata);
      }
    }
    return merged;
  }, [results]);

  return useMemo(() => {
    function poolOf(market: PrismMarket): PoolMetadata | undefined {
      if (market.market.kind !== "enigma") return undefined;
      return byAddress.get(market.market.tokenAddress);
    }

    return {
      poolOf,
      changeOf: (market) => poolOf(market)?.price_change?.h24 ?? undefined,
      isLoading: results.some((result) => result.isLoading),
    };
  }, [byAddress, results]);
}
