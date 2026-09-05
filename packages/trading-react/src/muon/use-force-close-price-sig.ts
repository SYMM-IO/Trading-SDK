"use client";

import {
  getForceClosePriceSig,
  type ConfigParameter,
  type GetForceClosePriceSigParameters,
  type GetForceClosePriceSigReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useForceClosePriceSig}: an optional `config` override.
 * The window bounds, both parties, and the symbol id are passed as the mutation
 * `variables`.
 */
export type UseForceClosePriceSigParameters = ConfigParameter;

/** Return type of {@link useForceClosePriceSig}. */
export type UseForceClosePriceSigReturnType = UseMutationResult<
  GetForceClosePriceSigReturnType,
  SymmioRequestError,
  GetForceClosePriceSigParameters
>;

/**
 * Fetch a fresh Muon `priceRange` attestation, on demand, assembled into the
 * contract-ready `HighLowPriceSig` that `forceClosePosition` verifies.
 *
 * Modeled as a **mutation** rather than a query: the signature is timestamped
 * and short-lived, so it must be fetched at submit time, not eagerly on mount.
 * Force-close is a majors-only flow. For the raw, un-assembled attestation use
 * {@link useMuonPriceRange} instead.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useForceClosePriceSig();
 * const sig = await mutateAsync({
 *   partyA,
 *   partyB: solverAddress,
 *   symbolId: 1n,
 *   t0: windowStart,
 *   t1: windowEnd,
 * });
 * ```
 */
export function useForceClosePriceSig(
  parameters: UseForceClosePriceSigParameters = {},
): UseForceClosePriceSigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetForceClosePriceSigReturnType, SymmioRequestError, GetForceClosePriceSigParameters>({
    mutationKey: ["getForceClosePriceSig"],
    mutationFn: async (variables) => {
      try {
        return await getForceClosePriceSig(config, {
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
