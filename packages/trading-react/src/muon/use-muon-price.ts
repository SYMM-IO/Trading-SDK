"use client";

import {
  getMuonPrice,
  type ConfigParameter,
  type GetMuonPriceParameters,
  type GetMuonPriceReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonPrice}: an optional `config` override. The quote
 * ids are passed as the mutation `variables`.
 */
export type UseMuonPriceParameters = ConfigParameter;

/** Return type of {@link useMuonPrice}. */
export type UseMuonPriceReturnType = UseMutationResult<
  GetMuonPriceReturnType,
  SymmioRequestError,
  GetMuonPriceParameters
>;

/**
 * Fetch a fresh Muon `price` attestation for a set of quote ids, on demand,
 * normalized to typed fields (validated prices, mark prices, symbols, signature
 * envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ quoteIds })`. `chainId` and the `symmio` address are
 * resolved from the connected chain's config.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonPrice();
 * const p = await mutateAsync({ quoteIds: [10n, 11n] });
 * ```
 */
export function useMuonPrice(parameters: UseMuonPriceParameters = {}): UseMuonPriceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonPriceReturnType, SymmioRequestError, GetMuonPriceParameters>({
    mutationKey: ["getMuonPrice"],
    mutationFn: async (variables) => {
      try {
        return await getMuonPrice(config, {
          quoteIds: variables.quoteIds,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
