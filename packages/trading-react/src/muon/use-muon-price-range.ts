"use client";

import {
  getMuonPriceRange,
  type ConfigParameter,
  type GetMuonPriceRangeParameters,
  type GetMuonPriceRangeReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonPriceRange}: an optional `config` override. The
 * window, parties, and symbol id are passed as the mutation `variables`.
 */
export type UseMuonPriceRangeParameters = ConfigParameter;

/** Return type of {@link useMuonPriceRange}. */
export type UseMuonPriceRangeReturnType = UseMutationResult<
  GetMuonPriceRangeReturnType,
  SymmioRequestError,
  GetMuonPriceRangeParameters
>;

/**
 * Fetch a fresh Muon `priceRange` attestation for a position over a `[t0, t1]`
 * window, on demand, normalized to typed fields (lowest/highest/mean/price,
 * uPnL, signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are
 * timestamped and short-lived, so they are fetched on an explicit action, not
 * eagerly on mount. Call `mutateAsync({ t0, t1, partyA, partyB, symbolId })`.
 * `chainId` and the `symmio` address are resolved from the connected chain's
 * config.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonPriceRange();
 * const r = await mutateAsync({
 *   t0: 1_700_000_000n,
 *   t1: 1_700_000_900n,
 *   partyA: "0xva…",
 *   partyB: "0xpb…",
 *   symbolId: 1n,
 * });
 * ```
 */
export function useMuonPriceRange(parameters: UseMuonPriceRangeParameters = {}): UseMuonPriceRangeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonPriceRangeReturnType, SymmioRequestError, GetMuonPriceRangeParameters>({
    mutationKey: ["getMuonPriceRange"],
    mutationFn: async (variables) => {
      try {
        return await getMuonPriceRange(config, {
          t0: variables.t0,
          t1: variables.t1,
          partyA: variables.partyA,
          partyB: variables.partyB,
          symbolId: variables.symbolId,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
